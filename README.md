# Dashboard 2 - Radar Mercados de Aplicacao & Brand Owners Avient

Projeto vivo para monitorar mercados de aplicacao que possam gerar oportunidades comerciais, tecnicas ou estrategicas para Avient no Brasil e na America do Sul.

## Escopo

O dashboard monitora, nesta ordem visual obrigatoria:

1. Embalagens Plasticas
2. Bebidas
3. Eletrodomesticos
4. Bens de Consumo

A janela de analise e sempre de 30 dias corridos em relacao a data da execucao em `America/Sao_Paulo`. Conteudo antigo nao entra nos cards principais nem no monitoramento secundario.

O criterio principal nao e "noticia de brand owner" por si so. Cada noticia coletada deve ser avaliada pelo sinal para o negocio da Avient: oportunidade comercial, movimento estrategico, acao tatica de curto prazo, pressao regulatoria, sustentabilidade, investimento, supply chain, evento tecnico/comercial, portfolio, design, cor, performance, embalagem ou material.

## Como rodar localmente

```bash
npm install
npm run build
npm run dev
```

Se estiver usando o Node portatil do Codex, rode os scripts diretamente com esse Node.

## Comandos

```bash
npm run lint
npm run test
npm run collect:dashboard2
npm run export:csv
npm run export:pdf
npm run feedback:suggestions
npm run build
npm run dev
```

Inputs aceitos pela coleta:

```bash
npm run collect:dashboard2 -- force_all=true
npm run collect:dashboard2 -- force_segment=beverages
npm run collect:dashboard2 -- dry_run=true
npm run collect:dashboard2 -- max_items=80
npm run collect:dashboard2 -- run_pdf_only=true
npm run collect:dashboard2 -- run_feedback_suggestions_only=true
npm run collect:dashboard2 -- force_all=true max_items=5000 timeout_ms=7000 segment_concurrency=2 source_concurrency=2
```

Para uma coleta completa e eficiente, use `segment_concurrency=2` e `source_concurrency=2`: isso consulta ate duas frentes de pesquisa ao mesmo tempo e ate duas fontes por frente, sem abrir conexoes demais contra os sites.

## Fontes e frequencia

As fontes ficam em `config/sources.dashboard2.yml`.

- Camada 1: nucleo semanal obrigatorio.
- Camada 2: fontes quinzenais de apoio.
- Camada 3: fontes mensais ou por evento.

Mesmo quando a frequencia operacional for quinzenal, mensal ou por evento, a janela aplicada aos conteudos continua sendo sempre de 30 dias.

Quando a fonte tiver revista digital, ultima edicao, PDF, flipbook, e-magazine, anuario ou publicacao periodica, a coleta registra a consulta da edicao e so permite card principal se houver data clara dentro da janela.

## Score e filtros

Pesos, termos, tags e empresas prioritarias ficam em `config/scoring.dashboard2.yml`.

- Score `>= 50`: card principal, dentro do limite de 8 por enfoque.
- Score `30..49`: Monitoramento secundario.
- Score `< 30`: descartado do dashboard visual.
- Fora dos 30 dias: descartado do dashboard visual.

A classificacao heuristica e obrigatoria. O LLM e opcional e nunca deve ser necessario para o dashboard rodar.

O scoring combina duas camadas:

- sinais tecnicos tradicionais: embalagem, PET/rPET/PCR, materiais, cor, acabamento, aditivos, masterbatch, reciclabilidade, refil, rotulo, tampa e componentes;
- sinais de negocio para Avient: gatilho comercial de curto prazo, movimento estrategico, regulacao/sustentabilidade, investimento/supply chain, evento, mudanca de portfolio/design e sinal fraco promissor.

Cada card gerado deve indicar sinal de negocio, impacto, urgencia, area sugerida e proxima acao. Brand owners e mercados de aplicacao funcionam como contexto para priorizacao, nao como fim do radar.

## Exportacoes

Arquivos gerados:

- `public/exports/dashboard2-latest.csv`
- `public/exports/dashboard2-executive.pdf`
- `public/exports/dashboard2-full.pdf`

O build copia esses arquivos para `dist/exports/`.

## Protecao por senha

O deploy publico fica sem senha por padrao. A funcao `netlify/edge-functions/auth.js` permanece no projeto apenas como opcao futura, mas nao esta conectada no `netlify.toml`.

Se quiser reativar senha depois, adicione novamente a rota `[[edge_functions]]` no `netlify.toml` e configure no Netlify:

```bash
DASHBOARD_AUTH_ENABLED=true
DASHBOARD_PASSWORD_HASH=sha256:...
DASHBOARD_SESSION_SECRET=valor-longo-aleatorio
DASHBOARD_COOKIE_NAME=dashboard2_session
```

Para gerar o hash:

```bash
npm run hash:password -- "sua-senha"
```

Nao coloque senha em frontend, HTML, JSON publico ou logs.

## Feedback

Cada card oferece:

- Util
- Nao relevante
- Ja sabia
- Virou oportunidade
- Precisa revisar
- Sugerir acao comercial

O site tenta criar GitHub Issue via `netlify/functions/feedback.ts`. Se as variaveis nao existirem, usa Netlify Forms.

Variaveis opcionais:

```bash
FEEDBACK_GITHUB_TOKEN=
FEEDBACK_REPO_OWNER=
FEEDBACK_REPO_NAME=DRO26
FEEDBACK_ISSUE_LABELS=dashboard2-feedback,dashboard2
NETLIFY_SITE_URL=
```

As sugestoes de melhoria sao geradas por:

```bash
npm run feedback:suggestions
```

O comando grava `public/data/dashboard2-feedback-suggestions.json` e nao altera regras automaticamente.

## GitHub Actions

Workflow: `.github/workflows/update-dashboard2.yml`.

Agenda: segunda-feira, 7:30 em Sao Paulo. Como o cron do GitHub Actions usa UTC, foi configurado:

```yaml
30 10 * * 1
```

Secrets esperados:

- `NETLIFY_AUTH_TOKEN`
- `NETLIFY_SITE_ID`
- `NETLIFY_BUILD_HOOK_URL`, opcional
- `OPENAI_API_KEY`, opcional
- `FEEDBACK_GITHUB_TOKEN`, opcional
- `DASHBOARD_PASSWORD_HASH`, opcional se a protecao por senha for reativada
- `DASHBOARD_SESSION_SECRET`, opcional se a protecao por senha for reativada

Vars esperadas:

- `FEEDBACK_REPO_OWNER`
- `FEEDBACK_REPO_NAME`

Se `NETLIFY_AUTH_TOKEN` e `NETLIFY_SITE_ID` existirem, o workflow faz deploy direto via Netlify CLI. Caso contrario, pode acionar build hook se configurado.

## Netlify

Configuracao em `netlify.toml`:

- build command: `npm run build`
- publish: `dist`
- functions: `netlify/functions`
- edge function: desativada por padrao

Passos:

1. Conectar o repositorio `DRO26` ao Netlify.
2. Configurar build command e publish directory.
3. Configurar variaveis de ambiente opcionais.
4. Ativar Netlify Forms.
5. Configurar feedback via GitHub Issues, se desejado.
6. Rodar o workflow manualmente para testar.

## Dados latest

O projeto mantem apenas a ultima execucao em:

- `public/data/dashboard2-latest.json`
- `public/data/dashboard2-feedback-suggestions.json`

Nao crie `dashboard2-history.json` nem diretorios versionados por data.

## Adicionar fonte

Edite `config/sources.dashboard2.yml` e inclua:

- `id`
- `name`
- `layer`
- `cadence`
- `homepage`
- `editionRequired`, quando aplicavel
- `focus`

Depois rode:

```bash
npm run lint
npm run test
npm run collect:dashboard2 -- dry_run=true
```

## Interpretar falhas

Cada fonte tem status independente:

- sucesso
- sem noticia relevante
- falha de acesso
- edicao nao acessivel
- timeout
- bloqueado
- sem atualizacao
- erro de parsing
- fonte social nao acessivel automaticamente
- ultima edicao aberta
- ultima edicao fora da janela de 30 dias
- ultima edicao sem data identificavel

Falhas de uma fonte nao devem quebrar o dashboard inteiro.
