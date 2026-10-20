-- =============================================================================
-- 0070: Loja da Incell — ordens de serviço, estoque e vendas
-- =============================================================================
-- Os três módulos da loja de iPhones, em cima da base do chat:
--
--   · o CLIENTE é o contato do chat (leads): a OS e a venda apontam para a
--     mesma ficha que a conversa, sem cadastro duplicado;
--   · a EQUIPE é profiles (técnico da OS, vendedor da venda, quem lançou o
--     movimento de estoque);
--   · dinheiro em CENTAVOS (bigint), como no resto do banco. Nunca float.
--
-- As tabelas antigas do CRM (products, sales, customers) ficam intocadas:
-- os nomes aqui são em português e não colidem com elas.
--
-- Permissão: toda a equipe lê e grava (a loja trabalha junta); só a gestão
-- apaga; o compliance não grava nada (restritiva, como na 0067); o segundo
-- fator vale aqui também (restritiva da 0067/0068, replicada porque o laço
-- de lá só alcançou as tabelas que existiam na hora).
--
-- Script reexecutável.
-- =============================================================================

-- 1. Tipos --------------------------------------------------------------------
do $$ begin
  create type os_status as enum (
    'aberta',               -- entrou na bancada, ainda sem diagnóstico
    'em_analise',           -- técnico avaliando
    'aguardando_aprovacao', -- orçamento passado ao cliente
    'em_reparo',            -- aprovado, mão na massa
    'aguardando_peca',      -- parado esperando peça
    'pronta',               -- concluída, aguardando retirada
    'entregue',             -- cliente levou
    'cancelada'             -- cliente recusou ou desistiu
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type estoque_tipo as enum ('aparelho', 'peca', 'acessorio');
exception when duplicate_object then null; end $$;

do $$ begin
  create type estoque_condicao as enum ('novo', 'seminovo', 'recondicionado');
exception when duplicate_object then null; end $$;

do $$ begin
  create type estoque_movimento_tipo as enum ('entrada', 'saida', 'ajuste');
exception when duplicate_object then null; end $$;

do $$ begin
  create type venda_status as enum ('aberta', 'concluida', 'cancelada');
exception when duplicate_object then null; end $$;

do $$ begin
  create type forma_pagamento as enum (
    'dinheiro', 'pix', 'cartao_credito', 'cartao_debito', 'transferencia', 'outro'
  );
exception when duplicate_object then null; end $$;

-- 2. Quem sou eu (para as policies) -------------------------------------------
-- Admin ou gestor: quem apaga e quem mexe no que não é dele.
create or replace function sou_gestao()
returns boolean language sql stable
as $$ select coalesce(meu_papel_texto() in ('admin', 'gestor'), false); $$;
grant execute on function sou_gestao() to authenticated;

-- 3. Estoque ------------------------------------------------------------------
-- Um item por linha. Aparelho (iPhone) entra como item próprio, com IMEI e
-- condição, quantidade 1; peça e acessório têm quantidade livre. A
-- quantidade NUNCA é editada à mão: nasce dos movimentos (gatilho abaixo).
create table if not exists estoque_itens (
  id                    uuid primary key default gen_random_uuid(),
  tipo                  estoque_tipo not null default 'peca',
  nome                  text not null,
  sku                   text,
  descricao             text,
  -- Só para aparelho.
  condicao              estoque_condicao,
  imei                  text,
  custo_centavos        bigint not null default 0 check (custo_centavos >= 0),
  preco_centavos        bigint not null default 0 check (preco_centavos >= 0),
  quantidade            integer not null default 0 check (quantidade >= 0),
  estoque_minimo        integer not null default 0 check (estoque_minimo >= 0),
  ativo                 boolean not null default true,
  criado_por            uuid references profiles (id) on delete set null,
  criado_em             timestamptz not null default now(),
  atualizado_em         timestamptz not null default now()
);

create unique index if not exists estoque_itens_sku_idx
  on estoque_itens (lower(sku)) where sku is not null;
create unique index if not exists estoque_itens_imei_idx
  on estoque_itens (imei) where imei is not null;
create index if not exists estoque_itens_tipo_idx on estoque_itens (tipo) where ativo;
create index if not exists estoque_itens_nome_idx on estoque_itens (lower(nome));

comment on column estoque_itens.quantidade is
  'Saldo atual. Mantido pelo gatilho de estoque_movimentos; não editar direto.';

drop trigger if exists estoque_itens_atualizado_em on estoque_itens;
create trigger estoque_itens_atualizado_em
  before update on estoque_itens
  for each row execute function set_atualizado_em();

-- Cada entrada, saída e acerto do saldo. `delta` é com sinal: entrada > 0,
-- saída < 0, ajuste qualquer um (menos zero). A origem diz de onde veio
-- (compra, venda, OS, inventário…) e a referência liga à venda ou OS.
create table if not exists estoque_movimentos (
  id                    uuid primary key default gen_random_uuid(),
  item_id               uuid not null references estoque_itens (id) on delete cascade,
  tipo                  estoque_movimento_tipo not null,
  delta                 integer not null check (delta <> 0),
  origem                text not null default 'manual',
  venda_id              uuid,
  os_id                 uuid,
  custo_unitario_centavos bigint check (custo_unitario_centavos >= 0),
  observacao            text,
  por                   uuid references profiles (id) on delete set null,
  criado_em             timestamptz not null default now(),
  constraint estoque_movimentos_sinal check (
    (tipo = 'entrada' and delta > 0)
    or (tipo = 'saida' and delta < 0)
    or tipo = 'ajuste'
  )
);

create index if not exists estoque_movimentos_item_idx
  on estoque_movimentos (item_id, criado_em desc);
create index if not exists estoque_movimentos_venda_idx
  on estoque_movimentos (venda_id) where venda_id is not null;
create index if not exists estoque_movimentos_os_idx
  on estoque_movimentos (os_id) where os_id is not null;

-- O saldo acompanha os movimentos. Saldo negativo é recusado pelo check de
-- estoque_itens.quantidade: a venda de um item zerado falha na gravação.
create or replace function estoque_aplicar_movimento()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update estoque_itens set quantidade = quantidade + new.delta where id = new.item_id;
  elsif tg_op = 'DELETE' then
    update estoque_itens set quantidade = quantidade - old.delta where id = old.item_id;
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists estoque_movimentos_aplicar on estoque_movimentos;
create trigger estoque_movimentos_aplicar
  after insert or delete on estoque_movimentos
  for each row execute function estoque_aplicar_movimento();

-- 4. Ordens de serviço --------------------------------------------------------
create table if not exists ordens_servico (
  id                    uuid primary key default gen_random_uuid(),
  numero                bigint generated by default as identity unique,
  cliente_id            uuid not null references leads (id) on delete restrict,
  tecnico_id            uuid references profiles (id) on delete set null,
  status                os_status not null default 'aberta',
  -- O aparelho como chegou.
  aparelho              text not null,
  imei                  text,
  cor                   text,
  acessorios            text,
  estado_aparelho       text,
  defeito_relatado      text not null,
  diagnostico           text,
  -- Valores: o orçamento passado ao cliente e o total dos itens (gatilho).
  valor_orcado_centavos bigint check (valor_orcado_centavos >= 0),
  valor_total_centavos  bigint not null default 0 check (valor_total_centavos >= 0),
  prazo_previsto        date,
  garantia_dias         integer not null default 90 check (garantia_dias >= 0),
  aprovado_em           timestamptz,
  pronta_em             timestamptz,
  entregue_em           timestamptz,
  cancelada_em          timestamptz,
  observacao            text,
  criado_por            uuid references profiles (id) on delete set null,
  criado_em             timestamptz not null default now(),
  atualizado_em         timestamptz not null default now()
);

create index if not exists ordens_servico_status_idx
  on ordens_servico (status, criado_em desc);
create index if not exists ordens_servico_cliente_idx on ordens_servico (cliente_id);
create index if not exists ordens_servico_tecnico_idx on ordens_servico (tecnico_id);

drop trigger if exists ordens_servico_atualizado_em on ordens_servico;
create trigger ordens_servico_atualizado_em
  before update on ordens_servico
  for each row execute function set_atualizado_em();

-- Peças e serviços da OS. Peça pode vir do estoque (item_id) ou ser avulsa.
create table if not exists ordens_servico_itens (
  id                    uuid primary key default gen_random_uuid(),
  os_id                 uuid not null references ordens_servico (id) on delete cascade,
  tipo                  text not null default 'servico' check (tipo in ('peca', 'servico')),
  item_id               uuid references estoque_itens (id) on delete set null,
  descricao             text not null,
  quantidade            integer not null default 1 check (quantidade > 0),
  valor_unitario_centavos bigint not null default 0 check (valor_unitario_centavos >= 0),
  criado_em             timestamptz not null default now()
);

create index if not exists ordens_servico_itens_os_idx on ordens_servico_itens (os_id);

-- O total da OS acompanha os itens.
create or replace function ordens_servico_somar_total()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare alvo uuid := coalesce(new.os_id, old.os_id);
begin
  update ordens_servico
     set valor_total_centavos = coalesce((
       select sum(quantidade * valor_unitario_centavos)
       from ordens_servico_itens where os_id = alvo
     ), 0)
   where id = alvo;
  return coalesce(new, old);
end;
$$;

drop trigger if exists ordens_servico_itens_total on ordens_servico_itens;
create trigger ordens_servico_itens_total
  after insert or update or delete on ordens_servico_itens
  for each row execute function ordens_servico_somar_total();

-- A linha do tempo da OS: cada troca de status e cada nota da equipe.
create table if not exists ordens_servico_eventos (
  id                    uuid primary key default gen_random_uuid(),
  os_id                 uuid not null references ordens_servico (id) on delete cascade,
  tipo                  text not null default 'nota' check (tipo in ('status', 'nota')),
  de_status             os_status,
  para_status           os_status,
  nota                  text,
  por                   uuid references profiles (id) on delete set null,
  criado_em             timestamptz not null default now()
);

create index if not exists ordens_servico_eventos_os_idx
  on ordens_servico_eventos (os_id, criado_em desc);

-- 5. Vendas -------------------------------------------------------------------
create table if not exists vendas (
  id                    uuid primary key default gen_random_uuid(),
  numero                bigint generated by default as identity unique,
  cliente_id            uuid references leads (id) on delete set null,
  vendedor_id           uuid not null references profiles (id) on delete restrict,
  status                venda_status not null default 'aberta',
  forma_pagamento       forma_pagamento,
  parcelas              integer not null default 1 check (parcelas >= 1),
  desconto_centavos     bigint not null default 0 check (desconto_centavos >= 0),
  -- Soma dos itens menos o desconto (gatilho).
  total_centavos        bigint not null default 0 check (total_centavos >= 0),
  observacao            text,
  concluida_em          timestamptz,
  cancelada_em          timestamptz,
  criado_em             timestamptz not null default now(),
  atualizado_em         timestamptz not null default now()
);

create index if not exists vendas_status_idx on vendas (status, criado_em desc);
create index if not exists vendas_vendedor_idx on vendas (vendedor_id, criado_em desc);
create index if not exists vendas_cliente_idx on vendas (cliente_id);

drop trigger if exists vendas_atualizado_em on vendas;
create trigger vendas_atualizado_em
  before update on vendas
  for each row execute function set_atualizado_em();

create table if not exists vendas_itens (
  id                    uuid primary key default gen_random_uuid(),
  venda_id              uuid not null references vendas (id) on delete cascade,
  item_id               uuid references estoque_itens (id) on delete set null,
  descricao             text not null,
  quantidade            integer not null default 1 check (quantidade > 0),
  valor_unitario_centavos bigint not null default 0 check (valor_unitario_centavos >= 0),
  criado_em             timestamptz not null default now()
);

create index if not exists vendas_itens_venda_idx on vendas_itens (venda_id);

create or replace function vendas_somar_total()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare alvo uuid;
begin
  if tg_table_name = 'vendas' then
    alvo := new.id;
  else
    alvo := coalesce(new.venda_id, old.venda_id);
  end if;
  update vendas v
     set total_centavos = greatest(0, coalesce((
       select sum(quantidade * valor_unitario_centavos)
       from vendas_itens where venda_id = alvo
     ), 0) - v.desconto_centavos)
   where v.id = alvo;
  return coalesce(new, old);
end;
$$;

drop trigger if exists vendas_itens_total on vendas_itens;
create trigger vendas_itens_total
  after insert or update or delete on vendas_itens
  for each row execute function vendas_somar_total();

-- O desconto mudou: o total refaz a conta. AFTER e só na coluna, para não
-- entrar em laço com o próprio update do total.
drop trigger if exists vendas_desconto_total on vendas;
create trigger vendas_desconto_total
  after update of desconto_centavos on vendas
  for each row execute function vendas_somar_total();

-- As referências dos movimentos às vendas e OS (as tabelas já existem).
do $$ begin
  alter table estoque_movimentos
    add constraint estoque_movimentos_venda_fk
    foreign key (venda_id) references vendas (id) on delete set null;
exception when duplicate_object then null; end $$;
do $$ begin
  alter table estoque_movimentos
    add constraint estoque_movimentos_os_fk
    foreign key (os_id) references ordens_servico (id) on delete set null;
exception when duplicate_object then null; end $$;

-- 6. RLS ----------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'estoque_itens', 'estoque_movimentos',
    'ordens_servico', 'ordens_servico_itens', 'ordens_servico_eventos',
    'vendas', 'vendas_itens'
  ] loop
    execute format('alter table %I enable row level security', t);

    -- A loja inteira lê e grava; só a gestão apaga.
    execute format('drop policy if exists loja_le on %I', t);
    execute format('create policy loja_le on %I for select to authenticated using (true)', t);
    execute format('drop policy if exists loja_insere on %I', t);
    execute format('create policy loja_insere on %I for insert to authenticated with check (true)', t);
    execute format('drop policy if exists loja_edita on %I', t);
    execute format('create policy loja_edita on %I for update to authenticated using (true) with check (true)', t);
    execute format('drop policy if exists loja_apaga on %I', t);
    execute format('create policy loja_apaga on %I for delete to authenticated using ((select sou_gestao()))', t);

    -- Compliance não grava nada (0067, item 7).
    execute format('drop policy if exists compliance_nao_insere on %I', t);
    execute format(
      'create policy compliance_nao_insere on %I as restrictive for insert to authenticated with check (not (select sou_compliance()))', t);
    execute format('drop policy if exists compliance_nao_edita on %I', t);
    execute format(
      'create policy compliance_nao_edita on %I as restrictive for update to authenticated using (not (select sou_compliance())) with check (not (select sou_compliance()))', t);
    execute format('drop policy if exists compliance_nao_apaga on %I', t);
    execute format(
      'create policy compliance_nao_apaga on %I as restrictive for delete to authenticated using (not (select sou_compliance()))', t);

    -- Segundo fator também aqui (0067, item 8; 0068, item 5).
    execute format('drop policy if exists exige_segundo_fator on %I', t);
    execute format(
      'create policy exige_segundo_fator on %I as restrictive for all to authenticated using ((select not exige_2fa()) or (select coalesce(auth.jwt() ->> ''aal'', ''aal1'')) = ''aal2'') with check ((select not exige_2fa()) or (select coalesce(auth.jwt() ->> ''aal'', ''aal1'')) = ''aal2'')', t);
  end loop;
end $$;

-- Movimento de estoque não se edita: é lançamento. Corrigir é lançar o
-- ajuste contrário (a gestão pode apagar o errado, e o gatilho desfaz o
-- saldo).
drop policy if exists loja_edita on estoque_movimentos;

-- As linhas de uma OS ou venda em aberto a equipe tira à vontade (a peça
-- errada, o serviço que não vai ser feito): a action devolve a peça ao
-- estoque. Apagar a OS ou a venda em si continua só com a gestão.
drop policy if exists loja_apaga on ordens_servico_itens;
create policy loja_apaga on ordens_servico_itens for delete to authenticated using (true);
drop policy if exists loja_apaga on vendas_itens;
create policy loja_apaga on vendas_itens for delete to authenticated using (true);

-- 7. Tempo real (a lista de OS acompanha a bancada) ---------------------------
do $$ begin
  alter publication supabase_realtime add table ordens_servico;
exception when duplicate_object or undefined_object then null; end $$;
