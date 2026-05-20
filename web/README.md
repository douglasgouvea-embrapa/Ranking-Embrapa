# Ranking Concurso Embrapa

Interface web para consulta do ranking dos aprovados no concurso público da Embrapa
(Edital 2024) cruzado com a lista de convocações em tempo real.

## Stack

- **Next.js 15** (App Router) + **React 19**
- **Tailwind CSS** com paleta Embrapa (azul, verde, branco)
- Deploy via **Vercel**

## Estrutura

```
web/
├── app/
│   ├── page.tsx                     # Página principal (server component)
│   ├── api/
│   │   ├── convocados/route.ts      # Lista de convocados (lê fonte externa)
│   │   └── opcao/[cargo]/[id]/...   # Detalhes de uma opção sob demanda
│   └── layout.tsx
├── components/
│   ├── Header.tsx                   # Cabeçalho com gradiente
│   ├── Explorer.tsx                 # Componente principal (client)
│   └── Footer.tsx
├── lib/
│   ├── data.ts                      # Acesso aos dados parseados
│   ├── normalize.ts                 # Normalização de nomes para matching
│   └── types.ts
└── data/
    ├── pesquisador.json             # Saída do parser
    ├── analista.json
    ├── tecnico.json
    ├── assistente.json
    └── index.json
```

## Desenvolvimento local

```bash
cd web
npm install
npm run dev
# abre em http://localhost:3000 (ou outra porta se ocupada)
```

## Atualizar os dados dos PDFs

Se a Embrapa publicar um novo edital com retificação, basta substituir os PDFs
na raiz do projeto e rodar:

```bash
cd web
npm run parse
```

Isso regera os arquivos em `web/data/`.

## Integração com o Looker Studio

A página lê os 1038 convocados diretamente do dashboard público de Controle
de Convocações da Embrapa via a API interna `batchedDataV2` do Looker Studio.
**Nenhuma autenticação é necessária** — o dashboard é público e a API
responde sem cookies/tokens.

### Como funciona

- `lib/looker.ts` faz POST para `https://datastudio.google.com/batchedDataV2`
  com o template salvo em `lib/looker-query.json` (corpo da requisição que
  o próprio Looker envia, com `paginateInfo.rowsCount=5001` para puxar tudo
  numa chamada só).
- O resultado vem em formato colunar e é convertido em uma lista de objetos
  `{ nome, opcao, status, unidade, lotacao, colocacao }`.
- O matching com os PDFs é feito por **opção + nome normalizado**
  (sem acentos, minúsculas).
- Cache: a resposta fica em cache por **24 horas** via `unstable_cache`.
- Sincronização manual: o botão "Sincronizar agora" no topo da página
  chama `POST /api/convocados` que invalida o cache e força refetch.

### Se o Looker mudar e quebrar

1. Rode novamente `node tools/probe-looker.mjs` em uma máquina com Chromium
   (Puppeteer baixa automaticamente).
2. Inspecione `tools/looker-probe/data-requests.json` para encontrar o novo
   formato da requisição.
3. Substitua `web/lib/looker-query.json` pelo novo body e ajuste `lib/looker.ts`
   se a estrutura da resposta mudar.

### Status reconhecidos

O Looker usa estes valores na coluna STATUS — todos com badges coloridas:

- `Contratado` (verde) — convocado e contratado pela Embrapa
- `Aceitou` (azul) — aceitou a vaga, aguardando contratação
- `Convocado` (amarelo) — convocado, ainda não respondeu
- `Não se manifestou` (laranja) — prazo de resposta venceu
- `Desistente` (vermelho claro) — declinou a vaga
- `Desclassificado` (vermelho escuro) — eliminado por algum motivo
- (sem registro no Looker) → `Aguardando` (cinza)

## Deploy no Vercel

```bash
npm install -g vercel
cd web
vercel
```

Nenhuma variável de ambiente é necessária — a integração com o Looker
é pública. O cache de 24h garante que apenas 1 chamada real por dia (ou
sempre que o botão "Sincronizar agora" for clicado) é feita à API do Looker.

## Personalização da paleta

As cores Embrapa estão em `tailwind.config.ts`:

- `embrapa-green` (#00A859) — verde institucional
- `embrapa-blue` (#003B71) — azul institucional
- Variações `-dark`, `-light`, e tons neutros (`embrapa-gray`, `embrapa-ink`)
