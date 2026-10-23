# Como o Glitch Lab funciona

Este guia explica onde cada parte do Glitch Lab roda, como elas conversam, como o deploy e o cron funcionam e como o código está organizado. Se você só quer rodar o projeto, pule para [Rodar na sua máquina](#rodar-na-sua-máquina).

## Sumário

1. [O que é o Glitch Lab](#o-que-é-o-glitch-lab)
2. [Onde cada coisa roda](#onde-cada-coisa-roda)
3. [O caminho de uma requisição](#o-caminho-de-uma-requisição)
4. [Vercel: o site](#vercel-o-site)
5. [Render: a API](#render-a-api)
6. [GitHub Actions: o cron diário](#github-actions-o-cron-diário)
7. [Supabase: banco e tempo real](#supabase-banco-e-tempo-real)
8. [Gemini: a IA](#gemini-a-ia)
9. [Variáveis de ambiente](#variáveis-de-ambiente)
10. [Arquitetura do backend](#arquitetura-do-backend)
11. [Arquitetura do front-end](#arquitetura-do-front-end)
12. [Os fluxos do produto](#os-fluxos-do-produto)
13. [Segurança](#segurança)
14. [Rodar na sua máquina](#rodar-na-sua-máquina)
15. [Publicar uma mudança](#publicar-uma-mudança)
16. [Quando algo dá errado](#quando-algo-dá-errado)

---

## O que é o Glitch Lab

Um laboratório de debug para quem está aprendendo a programar. Em vez de entregar a correção, ele explica por que o código quebrou, guarda o erro como um caso e treina a pessoa com bugs parecidos até ela parar de errar.

O nome do hackathon (GLITCHATHON 2026) é a trilha "Glitch Detective". O produto cresceu além de investigar bugs, então virou Glitch Lab.

## Onde cada coisa roda

São quatro serviços. Cada um faz uma coisa só.

```
                 ┌────────────────────────────┐
  Navegador ───► │ VERCEL                     │  o site (HTML, JS, CSS)
                 │ glitch-lab-app.vercel.app  │
                 └──────────┬─────────────────┘
                            │ /api/*  (a Vercel repassa)
                            ▼
                 ┌────────────────────────────┐
                 │ RENDER                     │  a API (Node + Express)
                 │ glitch-lab-api.onrender.com│
                 └──────┬──────────────┬──────┘
                        │              │
                        ▼              ▼
              ┌──────────────┐  ┌──────────────┐
              │ SUPABASE     │  │ GEMINI       │
              │ Postgres     │  │ a IA         │
              └──────┬───────┘  └──────────────┘
                     │ Realtime (x1 ao vivo, direto do navegador)
                     ▲
  Navegador ─────────┘

  GITHUB ACTIONS, todo dia 03:00 UTC ──► chama a API no Render ──► gera o conteúdo do dia
```

| Serviço | Faz o quê | Custa |
|---|---|---|
| Vercel | Serve o site e repassa `/api/*` para o Render | Grátis (Hobby) |
| Render | Roda a API | Grátis (Free), dorme sem uso |
| GitHub Actions | Acorda a API e roda o cron uma vez por dia | Grátis |
| Supabase | Banco Postgres e o tempo real do x1 | Grátis |
| Gemini | Análise de erros, desafios, dicas, coach, conteúdo do dia | Grátis, com limite diário |

## O caminho de uma requisição

Exemplo: você clica em "Testar demo".

1. O navegador chama `POST /api/auth/demo` no endereço da Vercel.
2. A Vercel vê que o caminho começa com `/api/` e repassa a chamada para `https://glitch-lab-api.onrender.com/api/auth/demo`. Para o navegador, tudo parece vir do mesmo site, então não existe problema de CORS.
3. No Render, o Express recebe a chamada e ela passa pelas camadas: rota, controller, service e repositório.
4. O repositório grava a conta demo no Supabase.
5. A resposta volta pelo mesmo caminho com um token de sessão.
6. O navegador guarda o token e manda ele em toda chamada seguinte, no cabeçalho `Authorization: Bearer ...`.

## Vercel: o site

A Vercel roda `vite build` e publica a pasta `dist/` (o site pronto). Ela não roda código de servidor.

O arquivo [vercel.json](../vercel.json) tem duas regras:

```json
{ "source": "/api/:path*", "destination": "https://glitch-lab-api.onrender.com/api/:path*" }
{ "source": "/((?!api/).*)", "destination": "/index.html" }
```

- A primeira repassa a API para o Render.
- A segunda faz qualquer outra URL (por exemplo `/board` ou `/u/ana`) abrir o app. O React Router decide a tela no navegador.

**Deploy:** todo push no `main` publica sozinho. O status aparece no commit do GitHub.

**Variáveis que a Vercel precisa:** só as do navegador, `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` (para o x1 ao vivo). Elas entram no momento do build. As chaves secretas não precisam mais estar na Vercel.

## Render: a API

### O que é o Render

Um serviço que roda um processo Node 24 horas por dia, como um servidor de verdade. Diferente da Vercel, onde cada chamada liga uma função e desliga, no Render o servidor fica de pé. Por isso ele aguenta coisas demoradas, como o cron que espera a IA por minutos.

### O que você criou: um Blueprint

Um **Blueprint** é uma receita de infraestrutura escrita num arquivo, o [render.yaml](../render.yaml). Você aponta o Render para o repositório, ele lê o arquivo e cria tudo que está descrito. Sem blueprint, você teria que clicar em cada opção no painel.

O nosso descreve um serviço só:

```yaml
services:
  - type: web                 # um servidor web
    name: glitch-lab-api      # vira glitch-lab-api.onrender.com
    runtime: node
    plan: free
    buildCommand: npm install # instala as dependências
    startCommand: node server/index.js # liga a API
    healthCheckPath: /healthz # o Render chama isso para saber se está vivo
    envVars: ...              # as variáveis de ambiente
```

Nas variáveis:

- `generateValue: true`: o Render cria um valor aleatório uma vez e guarda (`AUTH_SECRET`, `GLITCHDLE_SECRET`).
- `sync: false`: o Render pede o valor quando o blueprint é criado, e ele nunca fica no Git (`GEMINI_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`).
- `value: ...`: valor fixo que pode ficar no Git (`NODE_ENV`, `NODE_VERSION`, `GEMINI_MODEL`).

Se você mudar o `render.yaml` e der push, o Render sincroniza o blueprint. Se mudar o nome de um serviço, ele cria um serviço novo. Foi por isso que apareceu o `glitch-detective-api` duplicado.

### Como ele publica

- Todo push no `main` dispara um deploy novo (auto-deploy).
- O Render roda o `buildCommand`, depois o `startCommand`, espera o `/healthz` responder 200 e só então troca a versão antiga pela nova.
- Logs, deploys e variáveis ficam em **dashboard.render.com → glitch-lab-api**.

### O plano grátis dorme

Sem nenhuma visita por 15 minutos, o serviço desliga. A próxima visita espera uns 50 segundos enquanto ele liga de novo. Na prática:

- Antes de mostrar o projeto para alguém, abra o site um minuto antes.
- O cron já lida com isso: ele chama `/healthz` e espera a API acordar antes de pedir o conteúdo.

## GitHub Actions: o cron diário

### O que é

O GitHub Actions roda scripts em máquinas do GitHub. Normalmente ele roda quando você dá push (testes, por exemplo), mas também aceita **horário agendado**, igual um cron. Nesse horário, o GitHub liga uma máquina, roda o script e desliga.

Quem gera o conteúdo é a nossa API. O GitHub só serve de despertador.

### O nosso cron

Arquivo: [.github/workflows/daily-cron.yml](../.github/workflows/daily-cron.yml)

```yaml
on:
  schedule:
    - cron: '0 3 * * *'   # todo dia 03:00 UTC = meia-noite em Brasília
  workflow_dispatch:      # permite rodar na mão pelo site do GitHub
jobs:
  cron:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4     # baixa o repositório
      - uses: actions/setup-node@v4   # instala o Node
      - run: node scripts/run-cron.mjs
        env:
          APP_URL: ${{ secrets.APP_URL }}         # endereço da API
          CRON_SECRET: ${{ secrets.CRON_SECRET }} # a senha do cron
```

O script [scripts/run-cron.mjs](../scripts/run-cron.mjs) faz duas coisas:

1. Chama `/healthz` até a API acordar (até 5 tentativas).
2. Chama `POST /api/cron/daily` com `Authorization: Bearer <CRON_SECRET>`. Sem essa senha, a API responde 401. (O endereço antigo, `GET /api/challenge?cron=1`, ainda funciona por uma versão.)

A API então gera e salva no Supabase:

- os 3 desafios diários de hoje e de amanhã, e o desafio global da semana
- o Glitchdle de hoje e de amanhã (pistas novas da IA, com reserva curada se a IA falhar)
- a Caça à linha de hoje e de amanhã

### Os secrets

Secrets são variáveis secretas do repositório. O workflow lê, mas ninguém consegue ver o valor depois de salvo. Ficam em **GitHub → glitch-lab → Settings → Secrets and variables → Actions**.

| Secret | Valor |
|---|---|
| `APP_URL` | `https://glitch-lab-api.onrender.com` |
| `CRON_SECRET` | o mesmo valor que está no Render |

Se os dois `CRON_SECRET` forem diferentes, o cron recebe 401 e falha.

### Rodar na mão e ver o resultado

- Pelo site: **GitHub → glitch-lab → Actions → daily-cron → Run workflow**.
- Pelo terminal: `gh workflow run daily-cron.yml`, depois `gh run watch`.
- Cada execução mostra o log e a resposta da API. Se falhar, o GitHub manda email.

### Criar outro cron do zero

1. Crie um arquivo em `.github/workflows/`, por exemplo `limpeza.yml`.
2. Coloque `on: schedule: - cron: '<minuto> <hora> * * *'` (sempre em UTC).
3. Nos `steps`, rode o comando que quiser.
4. Se precisar de senha, crie um secret e leia com `${{ secrets.NOME }}`.
5. Dê push. O GitHub passa a rodar no horário.

Atenção: o agendamento do GitHub pode atrasar alguns minutos em horário de pico. Para conteúdo diário isso não importa.

## Supabase: banco e tempo real

### Banco

Postgres com 26 tabelas. A estrutura está em [supabase/schema.sql](../supabase/schema.sql) e pode ser aplicada de novo sem quebrar nada (tudo usa `if not exists`).

- **Row Level Security ligado em todas as tabelas, sem nenhuma política.** Na prática, ninguém consegue ler ou escrever direto do navegador. Só a API, com a chave secreta (`SUPABASE_SERVICE_ROLE_KEY`), entra no banco.
- O código acessa o banco por uma interface única, o **store**. Existem duas implementações com o mesmo contrato: uma para o Supabase e outra que salva num arquivo JSON local (`.data/db.json`), usada no desenvolvimento e nos testes. Um conjunto de testes de contrato garante que as duas se comportam igual.

### Tempo real (x1)

No x1, cada jogador precisa saber na hora que o outro respondeu. Em vez de WebSocket próprio, o navegador usa o **Supabase Realtime**:

1. Cada página do duelo entra no canal `duel:<id>`.
2. Quando você responde, sua página manda um aviso "mudou" no canal. O aviso leva só um número de versão, nunca a resposta.
3. A página do oponente recebe o aviso e busca o estado novo na API, em cerca de 50 ms.
4. Se o canal cair, a página volta a perguntar à API a cada 1 a 4 segundos.

Quem decide quem acertou e quanto tempo levou é sempre o servidor, então um aviso falso não muda nada.

## Gemini: a IA

Toda chamada passa por uma função só, `generateJson`, que:

- manda um prompt de sistema, o pedido e um **schema JSON** (a IA é obrigada a responder nesse formato)
- tem tempo limite e uma nova tentativa quando falha
- respeita um **limite diário de chamadas por pessoa**
- responde no idioma de quem pediu (inglês ou português)

Onde a IA é usada: análise de erros, criação de desafios, dicas, correção do código, trilha de estudos, coach do Interrogatório, assistente lateral e o conteúdo novo do cron. Quando ela falha ou demora, cada lugar tem um plano B (conteúdo curado, mensagem clara de erro).

## Variáveis de ambiente

| Variável | Onde | Para quê |
|---|---|---|
| `GEMINI_API_KEY` | Render | Chave da IA |
| `GEMINI_MODEL` | Render | Modelo da IA (`gemini-3.8-flash`) |
| `SUPABASE_URL` | Render | Endereço do banco |
| `SUPABASE_SERVICE_ROLE_KEY` | Render | Chave secreta do banco. Nunca no navegador |
| `AUTH_SECRET` | Render (gerada) | Assina os tokens de sessão |
| `CRON_SECRET` | Render + GitHub | Senha do cron |
| `GLITCHDLE_SECRET` | Render (gerada) | Sorteia as respostas do Glitchdle e da Caça à linha, impossível de prever pelo código |
| `NODE_ENV=production` | Render | Liga as checagens de produção |
| `VITE_SUPABASE_URL` | Vercel | x1 ao vivo (lido pelo navegador) |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Vercel | x1 ao vivo (chave pública) |
| `APP_URL` | GitHub | Endereço da API para o cron |
| `SUPABASE_DB_PASSWORD` | só no seu `.env` | Senha direta do Postgres, para aplicar o schema. Não vai para nenhum serviço |

O arquivo `.env` fica só na sua máquina e está no `.gitignore`. O [.env.example](../.env.example) mostra os nomes sem valores.

## Arquitetura do backend

O backend é um app **Express** organizado em **camadas** e dividido em **módulos por funcionalidade**.

```
server/
  index.js               liga o servidor (listen)
  app.js                 monta o Express: middlewares, rotas, erros
  routes.js              junta as rotas de todos os módulos em /api
  config/                lê e valida as variáveis de ambiente
  core/                  o que todo módulo usa
    errors.js            AppError (status + mensagem)
    middlewares/         auth, idioma, corpo JSON, 404, tratamento de erro
    validation.js        ajudantes para validar ids e campos
  infra/                 conversa com o mundo de fora
    database/            o store: Supabase e JSON local
    ai/                  Gemini, generateJson, limite diário
    security/            senhas (scrypt) e sessões assinadas
  modules/               uma pasta por funcionalidade
    auth/  profile/  cases/  challenges/  daily/  glitchdle/  hunt/
    duels/  events/  articles/  notes/  progress/  review/  trails/
    interrogation/  assistant/  cron/  demo/
shared/                  regras usadas pelo servidor e pelo navegador
```

Dentro de cada módulo, os arquivos seguem o mesmo padrão:

| Arquivo | Camada | Faz | Não faz |
|---|---|---|---|
| `hunt.routes.js` | Rotas | Liga URL + método ao controller, aplica middlewares (ex: login obrigatório) | Regra de negócio |
| `hunt.controller.js` | Controller | Lê a requisição, chama o service, devolve status e JSON | Acessar o banco |
| `hunt.service.js` | Service | As regras: pontuação, tempo, quem pode jogar | Saber o que é HTTP |
| `infra/database` | Repositório | O store: lê e grava no Supabase ou no JSON local. O controller entrega o store ao service (`req.deps.store`) | Regra de negócio |

A regra das dependências vai num sentido só: **rotas → controller → service → repositório/infra**. Um service nunca importa um controller, e um controller nunca fala direto com o banco. Assim cada camada pode ser testada sozinha, e trocar o banco ou a IA mexe só em `infra/`.

### Por que antes era diferente

A primeira versão rodava em **funções da Vercel**. Lá, cada arquivo em `api/` vira uma função, e o plano grátis permite só 12. Por isso existiam só 12 arquivos, cada um decidindo o que fazer por parâmetros na URL (`/api/challenge?hunt=1`, `?action=...`). Funcionava, mas misturava assuntos no mesmo arquivo e não seguia REST.

Com a API no Render, esse limite não existe mais. Então o backend virou um Express com rotas REST de verdade (`GET /api/hunt`, `POST /api/auth/login`) e módulos separados.

## Arquitetura do front-end

React 19 + Vite + Tailwind 4, com React Router. Cada componente e cada página fica na própria pasta, com nome em kebab-case e o teste do lado.

```
src/
  main.jsx                     ponto de entrada
  app/                         app.jsx, routes.jsx
  pages/
    hunt-page/hunt-page.jsx    (+ hunt-page.test.jsx)
    board-page/  daily-page/  duel-page/  ...
  components/
    ui/                        peças genéricas: pixel-button, page-header, badge-icon...
    layout/                    app-shell, study-timer, public-header...
    hunt/code-lines/code-lines.jsx
    board/case-drawer/case-drawer.jsx
    ...                        uma pasta por funcionalidade
  lib/
    api.js                     todas as chamadas para a API
    auth/ progress/ timer/     providers (estado global via Context)
    i18n/                      inglês e português
    realtime/                  Supabase Realtime do x1
  test/                        utilitários de teste
```

- O nome do componente continua em PascalCase no código (`export default function HuntPage`). Só o arquivo e a pasta são kebab-case.
- A tela nunca chama `fetch` direto. Tudo passa por `src/lib/api.js`, que coloca o token, o idioma e traduz as mensagens de erro.

## Os fluxos do produto

1. **Conta:** cadastro com email e senha, ou "Testar demo" (conta temporária com dados de exemplo).
2. **Investigar:** cole o erro, o código e anexe arquivos. A IA explica, aponta as pistas e a linha. Vira um caso no board.
3. **Treinar (gym):** a partir de um caso, a IA cria um desafio. Você corrige, pede dicas, a IA confere. Passou, o caso fica resolvido.
4. **Interrogatório:** um coach guia pelos 6 passos do debug (reproduzir, ler o erro, hipótese, isolar, corrigir, prevenir) sem entregar a resposta.
5. **Revisão espaçada:** os tipos de bug que você já teve voltam em 1, 3, 7, 14 e 30 dias como cartões rápidos.
6. **Estudar:** notas no estilo Notion que mencionam casos, cronômetro de estudo e trilha de estudos gerada pela IA.
7. **Jogos do dia (conteúdo do cron):** desafios diários e da semana, Glitchdle (adivinhe a linguagem) e Caça à linha (ache a linha com o bug).
8. **Competir:** x1 ao vivo (quem acerta mais rápido ganha mais) com detecção de saída da aba, e eventos estilo "rinha" com votação e pódio.
9. **Comunidade:** artigos com comentários, curtidas e avaliações, perfis públicos e notificações.
10. **Progresso:** XP, nível, medalhas, sequência, gráfico de atividade e mapa de habilidades. Tudo é calculado a partir dos dados salvos, então não existe um contador para burlar.
11. **Assistente:** um painel lateral que conhece seus dados e ajuda em qualquer tela.

## Segurança

- **Senhas:** guardadas com hash (scrypt), nunca em texto.
- **Sessão:** token assinado com HMAC (`AUTH_SECRET`). A API confere a assinatura em toda chamada.
- **Respostas dos jogos:** ficam só no servidor até você responder.
- **Banco:** fechado por RLS. Só a API entra.
- **Cron:** exige a senha (`CRON_SECRET`), comparada em tempo constante.
- **IA:** limite diário por pessoa, e o coach tem uma trava que impede entregar a correção antes da hora.
- **Contas demo:** não entram em rankings e não ganham medalhas de jogar contra pessoas.

**Depois do hackathon:** troque a senha do banco do Supabase e a chave secreta (`sb_secret_...`), porque elas passaram por uma conversa.

## Rodar na sua máquina

Precisa de [Bun](https://bun.sh).

```bash
bun install
cp .env.example .env     # coloque pelo menos GEMINI_API_KEY
bun run dev              # site + API em http://localhost:5173
```

- Sem `SUPABASE_*` no `.env`, tudo é salvo em `.data/db.json`, um banco local em arquivo.
- Mesmo com as chaves do Supabase no `.env`, o dev usa o arquivo local. Para usar o banco de verdade, rode `DEV_SUPABASE=1 bun run dev`. Isso evita sujar a produção sem querer.

Testes:

```bash
bun x vitest run         # todos os testes (os testes nunca leem o .env)
bun run build            # confere se o site compila
```

## Publicar uma mudança

1. Faça o commit e dê push no `main`.
2. A Vercel publica o site e o Render publica a API, os dois sozinhos.
3. Confira o status no commit do GitHub (Vercel) e no painel do Render.

Para mudar a estrutura do banco, edite `supabase/schema.sql` e aplique no Supabase (SQL Editor, ou o script de aplicar com a senha do banco).

## Quando algo dá errado

| Sintoma | Onde olhar |
|---|---|
| O site não abre | Status do deploy da Vercel no commit do GitHub |
| A API responde 500 | Render → glitch-lab-api → Logs |
| A primeira chamada demora uns 50 s | Normal no plano grátis: a API estava dormindo |
| O conteúdo do dia não mudou | GitHub → Actions → daily-cron: veja se rodou e o que a API respondeu |
| O cron recebe 401 | O `CRON_SECRET` do GitHub e o do Render estão diferentes |
| O x1 demora para atualizar | O realtime caiu e a página está no modo de perguntar a cada poucos segundos. Confira as `VITE_SUPABASE_*` na Vercel |
| "No database configured" nos logs | Falta `SUPABASE_URL` ou `SUPABASE_SERVICE_ROLE_KEY` no Render |
