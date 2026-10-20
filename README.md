# Incell

Sistema de gestão para a **Incell**, loja especializada em **assistência técnica e venda de iPhones**.

## Sobre a Incell

A Incell atua em duas frentes:

- **Assistência técnica Apple:** reparos de iPhone como troca de tela, bateria, conector de carga, câmeras e demais componentes, com diagnóstico e orçamento.
- **Venda de iPhones:** aparelhos novos e seminovos, além de acessórios, com garantia.

## Objetivo do projeto

Este repositório vai concentrar o software da Incell: controle de ordens de serviço, estoque de aparelhos e peças, vendas e atendimento ao cliente.

## Status

O chat de atendimento (abaixo) é o primeiro módulo, em implantação em outubro de 2026. Ordens de serviço, estoque e vendas vêm depois.

## Atendimento (chat)

O primeiro módulo é o chat de atendimento, importado do Zeve Atendimento (repositório `Lucasnoleto31/Atendimento`, branch `marca-por-variavel`, commit `4d69240`) e configurado com o nome e a marca da Incell pelo `.env` do repositório (`NEXT_PUBLIC_*`, lidas em `src/lib/marca.ts`). Os arquivos originais da marca estão em `design/marca/`. A implantação (Supabase, Vercel, Meta no Business Manager da Incell) segue `docs/NOVO-CLIENTE.md`; os ids da Meta já lidos estão na ficha no fim desse roteiro.

Chat de atendimento: as conversas do WhatsApp (Meta Cloud API) e do
Instagram Direct chegam numa caixa de entrada compartilhada pela equipe, com
atribuição, etiquetas, templates da Meta, mensagens padrão, anexos e áudio.
Em volta do chat ficam a lista de contatos (com importação por planilha e
exportação em CSV), os disparos em massa, o relatório de atendimento da
equipe e o log de acesso.

### Stack

- **Next.js 16** (App Router, Server Actions) — aplicação e API em um só deploy.
- **Supabase** — Postgres com RLS, Auth, Storage e Realtime.
- **Resend** — e-mail do código de 6 dígitos da recuperação de senha e do
  aviso de senha trocada.
- **Meta WhatsApp Cloud API** e **API do Instagram** (Direct) — envio e
  recebimento direto, sem intermediário.
- **Vercel** — função na região `gru1` (São Paulo), a mesma do Supabase
  (`vercel.json`).

### Como começar

1. Siga o passo a passo de [`docs/SETUP.md`](docs/SETUP.md) — projeto Supabase,
   migrações, variáveis de ambiente e primeiro usuário.
2. Para conectar o número do WhatsApp, veja
   [`docs/META-WHATSAPP.md`](docs/META-WHATSAPP.md).
3. As migrações do banco (ordem e estado de cada uma) estão documentadas em
   [`supabase/migrations/README.md`](supabase/migrations/README.md).
4. Para subir o sistema para outra empresa, com o nome e a marca dela, veja
   [`docs/NOVO-CLIENTE.md`](docs/NOVO-CLIENTE.md).

```bash
npm install
npm run dev
```

A aplicação sobe em [http://localhost:3000](http://localhost:3000). Se o
`.env.local` apontar para o banco de produção, defina `MOTORES_DESLIGADOS=1`
antes de abrir qualquer página (ver `.env.local.example`).

### Scripts úteis

- `scripts/usuario.mjs` — cria o primeiro admin / recuperação de acesso
  (a tela Admin cobre o dia a dia).
