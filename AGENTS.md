# Instrucoes para agentes Codex

- Manter o escopo focado em mercados de aplicacao, brand owners e oportunidades para Avient.
- Manter fontes em `config/sources.dashboard2.yml`.
- Manter a janela de analise fixa em 30 dias corridos.
- Sempre abrir ou registrar a ultima edicao disponivel quando houver revista, PDF, flipbook ou publicacao periodica.
- Nao incluir conteudo fora dos ultimos 30 dias no dashboard principal nem no monitoramento secundario.
- Manter score configuravel em `config/scoring.dashboard2.yml`.
- Nao hardcodar dados coletados.
- Nao hardcodar senha.
- Nao expor secrets no frontend, HTML, JSON publico ou logs.
- Priorizar robustez por fonte; uma falha isolada nao deve quebrar a execucao.
- Escrever testes para mudancas relevantes.
- Nao quebrar o build do Netlify.
- Nao criar historico versionado.
- Nao alterar regras automaticamente com base em feedback; gerar apenas sugestoes para revisao manual.
- Manter a ordem visual:
  1. Embalagens Plasticas
  2. Bebidas
  3. Eletrodomesticos
  4. Bens de Consumo

