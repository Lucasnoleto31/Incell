# Mover o Supabase da Incell para São Paulo

O projeto do Supabase da Incell (`qnvnkulblwhbwzioecrr`) foi criado em
**Oregon (us-west-2)**. A função da Vercel está em Oregon também
(`vercel.json`, desde 21/10/2026) para não pagar uma travessia por consulta,
mas o certo é banco e função em **São Paulo (sa-east-1)**: a equipe e a
Vercel ficam a 20 ms do banco, em vez de 150.

O Supabase não muda a região de um projeto existente. O caminho é criar um
projeto novo em São Paulo, copiar tudo para ele e apontar a Vercel. O roteiro
abaixo faz isso em uma hora, com o sistema parado por uns 30 minutos. Quem
executa é o Lucas (dono das contas); os comandos rodam no Mac dele.

**O que viaja:** o banco inteiro (tabelas, dados, funções, gatilhos, RLS), os
usuários do Auth com as senhas (a equipe entra com as mesmas senhas), os
arquivos dos buckets de mídia. **O que não muda:** o código, o domínio
`incellatende.vercel.app`, a Meta (webhook e token continuam os mesmos,
porque apontam para a Vercel, não para o banco).

## 0. Antes de começar

1. **Hora**: fora do expediente da loja. Mensagem que chegar enquanto o
   sistema estiver parado cai no banco antigo (seção 7 diz como recuperar).
2. **Ferramentas no Mac**, uma vez:

   ```bash
   brew install libpq && echo 'export PATH="/opt/homebrew/opt/libpq/bin:$PATH"' >> ~/.zshrc && source ~/.zshrc && psql --version
   ```

   O Supabase CLI roda sem instalar, por `npx supabase@latest`.
3. **Pasta de trabalho fora do repositório** (os arquivos têm dados de
   clientes e nunca entram no git):

   ```bash
   mkdir -p ~/incell-migracao && cd ~/incell-migracao
   ```

4. **Endereço do banco antigo**: no painel do projeto atual, botão
   **Connect** › aba **Session pooler** (o endereço direto `db.<ref>` só tem
   IPv6 e não responde da maioria das redes). Fica assim:

   ```
   postgresql://postgres.qnvnkulblwhbwzioecrr:SENHA@aws-0-us-west-2.pooler.supabase.com:5432/postgres
   ```

   A senha é a do banco (Project Settings › Database › Reset password, se
   ninguém souber).

## 1. Criar o projeto novo

1. supabase.com › **New project**, na mesma organização.
2. Nome `Incell`, região **South America (São Paulo)**, senha forte do
   banco (guardar no cofre).
3. Depois de criado: **Project Settings › Compute and Disk › Small**, o
   mesmo do atual.
4. Anotar, de **Project Settings › API** (ou **Connect**): a URL
   (`https://<ref-novo>.supabase.co`), a `anon key`, a `service_role key`
   e o endereço do Session pooler (`aws-0-sa-east-1.pooler.supabase.com`).
5. Não rodar migração nenhuma no projeto novo: o passo 3 traz o esquema
   inteiro do antigo.

## 2. Parar as escritas no antigo

Na Vercel, projeto `incellatende` › Settings › Environment Variables:
troque `NEXT_PUBLIC_SUPABASE_ANON_KEY` por um valor inválido (por exemplo,
acrescente `-parado` no fim) e faça **Redeploy**. A partir daí ninguém
entra no sistema e o webhook da Meta recusa (a Meta guarda e tenta de novo
por horas; o que ela mandar nesse intervalo chega ao banco novo sozinho
depois do passo 6). Anote a hora.

## 3. Copiar o banco

Com as duas URLs do pooler nas variáveis (cole as suas):

```bash
export ANTIGO='postgresql://postgres.qnvnkulblwhbwzioecrr:SENHA@aws-0-us-west-2.pooler.supabase.com:5432/postgres'
export NOVO='postgresql://postgres.REFNOVO:SENHA@aws-0-sa-east-1.pooler.supabase.com:5432/postgres'
```

Três arquivos saem do antigo (papéis, esquema e dados):

```bash
npx supabase@latest db dump --db-url "$ANTIGO" -f papeis.sql --role-only
```

```bash
npx supabase@latest db dump --db-url "$ANTIGO" -f esquema.sql
```

```bash
npx supabase@latest db dump --db-url "$ANTIGO" -f dados.sql --use-copy --data-only
```

O dump de dados inclui as tabelas `auth` (os usuários e as senhas) e
`storage` (a lista de arquivos, não os arquivos). Depois, tudo entra no
novo numa transação só; com qualquer erro, nada fica pela metade:

```bash
psql --single-transaction --variable ON_ERROR_STOP=1 --file papeis.sql --file esquema.sql --command 'SET session_replication_role = replica' --file dados.sql --dbname "$NOVO"
```

Os avisos de "role já existe" do `papeis.sql` são normais. Se parar com
erro, leia a linha, corrija e rode de novo (o novo volta ao estado
anterior pela transação).

**Conferir**, nos dois bancos, que os números batem:

```bash
for url in "$ANTIGO" "$NOVO"; do psql "$url" -c "select (select count(*) from auth.users) usuarios, (select count(*) from leads) contatos, (select count(*) from lead_interactions) mensagens, (select count(*) from profiles) perfis, (select count(*) from whatsapp_instances) numeros, (select count(*) from storage.objects) arquivos;"; done
```

**Realtime**: o dump não leva a publicação. No novo:

```bash
psql "$NOVO" -c "alter publication supabase_realtime add table lead_interactions;" -c "alter publication supabase_realtime add table ordens_servico;" -c "select tablename from pg_publication_tables where pubname = 'supabase_realtime';"
```

Tem de listar `lead_interactions` e `ordens_servico`. Sem isso o chat não
recebe mensagem em tempo real (só pelo polling de reserva).

## 4. Copiar os arquivos dos buckets

A lista de arquivos veio no passo 3; os arquivos em si são copiados pelo
script do repositório. Crie `~/incell-migracao/.env.migracao` com as quatro
chaves (service role dos dois projetos):

```
ANTIGO_URL=https://qnvnkulblwhbwzioecrr.supabase.co
ANTIGO_SERVICE_ROLE_KEY=...
NOVO_URL=https://REFNOVO.supabase.co
NOVO_SERVICE_ROLE_KEY=...
```

E rode, de dentro do repositório:

```bash
node --env-file=$HOME/incell-migracao/.env.migracao scripts/copiar-buckets.mjs
```

Ele cria os buckets que faltarem (`midia-whatsapp` público, `importacoes`
privado), copia arquivo por arquivo com o mesmo tipo e pula o que já está
no destino: pode rodar de novo quantas vezes precisar. No fim imprime
quantos copiou e quantos faltaram.

## 5. O que se configura à mão no projeto novo

- **Authentication › Sign In / Providers › Email**: "Confirm email"
  desligado não importa (os usuários nascem confirmados pelo admin), mas
  **"Allow new users to sign up" desligado**, como no antigo: só a
  Administração cria conta.
- **Authentication › Rate limits**: os padrões servem.
- **Project Settings › JWT Keys**: deixar a chave assimétrica (ES256), que
  é o padrão dos projetos novos. O middleware confere o token localmente
  com ela.
- **Database › Extensions**: `pgcrypto` já veio no esquema. `pg_cron` só se
  alguém tiver ligado no antigo (hoje não).

## 6. Apontar a Vercel

Em Settings › Environment Variables, trocar as três:

| Variável | Valor novo |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://REFNOVO.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | a anon key do novo (a de verdade, não a "-parado") |
| `SUPABASE_SERVICE_ROLE_KEY` | a service role do novo |

No repositório, voltar a função para São Paulo: `vercel.json` com
`"regions": ["gru1"]` e o commit na `main`. O push já faz o deploy com as
variáveis novas. Esperar o deploy terminar.

## 7. Conferir

1. Entrar em `incellatende.vercel.app` com o seu usuário e a mesma senha.
2. Chat: as conversas estão lá, com as mensagens; uma foto ou áudio antigo
   abre (bucket copiado).
3. Mandar um WhatsApp de um celular para o número da loja: aparece no Chat
   em segundos (webhook e realtime). Responder: chega com ✓✓.
4. Administração › WhatsApp: "Último evento recebido" com a hora de agora.
5. Loja › Ordens de serviço abre (migração 0070 veio junto no esquema).

**Mensagens do intervalo parado**: a Meta reenvia o que o webhook recusou
no passo 2, então em geral não falta nada. Se faltar alguma, ela está no
banco antigo:

```bash
psql "$ANTIGO" -c "select l.nome, i.tipo, i.conteudo, i.criado_em from lead_interactions i join leads l on l.id = i.lead_id where i.criado_em > 'AAAA-MM-DD HH:MM-03' order by i.criado_em;"
```

## 8. Voltar atrás, se preciso

O projeto antigo não foi tocado. Para voltar: as três variáveis antigas na
Vercel, `vercel.json` em `pdx1`, redeploy. Nada se perde.

Depois de uma semana com tudo certo no novo: **Project Settings › General ›
Pause project** no antigo (pausado não cobra compute e ainda pode voltar);
apagar só depois de um mês. Atualizar a ficha da Incell em
`docs/NOVO-CLIENTE.md` com o ref novo e a região.
