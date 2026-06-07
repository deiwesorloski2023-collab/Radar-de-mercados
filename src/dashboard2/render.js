import fs from 'node:fs';
import path from 'node:path';
import { DIST_DIR, PUBLIC_DIR } from './config.js';
import { formatPtBrDate } from './date.js';
import { ensureDir, escapeHtml } from './utils.js';

export function buildStaticDashboard(data, filters, outDir = DIST_DIR) {
  ensureDir(outDir);
  copyPublicAssets(PUBLIC_DIR, outDir);
  const html = renderDashboardHtml(data, filters);
  fs.writeFileSync(path.join(outDir, 'index.html'), html, 'utf8');
  return path.join(outDir, 'index.html');
}

export function renderDashboardHtml(data, filters) {
  const safeData = JSON.stringify(data).replace(/</g, '\\u003c');
  const safeFilters = JSON.stringify(filters).replace(/</g, '\\u003c');
  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex,nofollow">
  <title>${escapeHtml(data.dashboard_name)}</title>
  <style>${styles()}</style>
</head>
<body>
  <script id="dashboard-data" type="application/json">${safeData}</script>
  <script id="dashboard-filters" type="application/json">${safeFilters}</script>

  <header class="topbar">
    <div class="topbar__main">
      <p class="eyebrow">Radar semanal Avient</p>
      <h1>${escapeHtml(data.dashboard_name)}</h1>
      <div class="meta-row">
        <span>Atualizado em <strong>${escapeHtml(formatPtBrDate(data.update_date))}</strong></span>
        <span>Janela: <strong>${escapeHtml(data.analysis_window_label)}</strong></span>
        <span class="status-pill" data-status="${escapeHtml(data.status)}">${escapeHtml(data.status)}</span>
      </div>
    </div>
    <nav class="export-actions" aria-label="Exportações">
      <a href="exports/dashboard2-latest.csv" download>CSV</a>
      <a href="exports/dashboard2-executive.pdf" download>PDF executivo</a>
      <a href="exports/dashboard2-full.pdf" download>PDF completo</a>
      <a href="/logout" class="logout-link">Sair</a>
    </nav>
  </header>

  <main>
    <section class="summary-band" aria-labelledby="summary-title">
      <div>
        <h2 id="summary-title">Resumo executivo</h2>
        <ul id="summary-list" class="summary-list"></ul>
      </div>
      <div class="metrics-grid" aria-label="Indicadores">
        <div><strong id="metric-primary">0</strong><span>cards principais</span></div>
        <div><strong id="metric-secondary">0</strong><span>secundários</span></div>
        <div><strong id="metric-alerts">0</strong><span>alertas</span></div>
        <div><strong id="metric-failures">0</strong><span>falhas</span></div>
      </div>
    </section>

    <section class="filters-band" aria-label="Filtros">
      <div class="filters-grid">
        ${selectControl('segment', 'Enfoque')}
        ${selectControl('source', 'Fonte')}
        ${selectControl('company', 'Empresa')}
        ${selectControl('brand', 'Marca')}
        ${selectControl('tag', 'Tag')}
        ${selectControl('relevance', 'Relevância')}
        ${selectControl('action', 'Ação')}
        ${selectControl('origin', 'Origem')}
      </div>
      <div class="filter-actions">
        <button type="button" id="clear-filters">Limpar filtros</button>
      </div>
    </section>

    <section class="content-band" aria-labelledby="cards-title">
      <div class="section-heading">
        <h2 id="cards-title">Cards por enfoque</h2>
        <p id="result-count"></p>
      </div>
      <div id="segments-root" class="segments-root"></div>
    </section>

    <section class="content-band" aria-labelledby="secondary-title">
      <div class="section-heading">
        <h2 id="secondary-title">Monitoramento secundário</h2>
        <p>Score 30 a 49, dentro da janela de 30 dias.</p>
      </div>
      <div id="secondary-root" class="secondary-root"></div>
    </section>

    <section class="insight-grid" aria-label="Oportunidades e alertas">
      <div class="insight-panel">
        <h2>Oportunidades para Avient</h2>
        <div id="opportunities-root"></div>
      </div>
      <div class="insight-panel">
        <h2>Alertas de alta relevância</h2>
        <div id="alerts-root"></div>
      </div>
    </section>

    <section class="content-band" aria-labelledby="sources-title">
      <div class="section-heading">
        <h2 id="sources-title">Fontes consultadas</h2>
        <p>Última execução, sem histórico versionado.</p>
      </div>
      <div id="sources-root" class="status-table"></div>
    </section>

    <section class="insight-grid" aria-label="Falhas e sugestões">
      <div class="insight-panel">
        <h2>Fontes sem notícia relevante</h2>
        <div id="no-news-root"></div>
      </div>
      <div class="insight-panel">
        <h2>Falhas de coleta</h2>
        <div id="failures-root"></div>
      </div>
    </section>

    <section class="content-band" aria-labelledby="suggestions-title">
      <div class="section-heading">
        <h2 id="suggestions-title">Sugestões de melhoria baseadas em feedback</h2>
        <p>Revisão manual obrigatória antes de mudar regras.</p>
      </div>
      <div id="suggestions-root"></div>
    </section>
  </main>

  <form name="dashboard2-feedback" method="POST" data-netlify="true" netlify-honeypot="bot-field" hidden>
    <input type="hidden" name="form-name" value="dashboard2-feedback">
    <input name="bot-field">
    <input name="item_id">
    <input name="feedback_type">
    <input name="comment">
    <input name="priority">
    <input name="user_name">
    <input name="user_email">
    <input name="source">
    <input name="segment">
    <input name="item_title">
    <input name="created_at">
  </form>

  <dialog id="feedback-dialog" class="feedback-dialog">
    <form method="dialog" class="feedback-form" id="feedback-ui-form">
      <div class="modal-head">
        <h2>Feedback do card</h2>
        <button type="button" id="close-feedback" aria-label="Fechar">×</button>
      </div>
      <p id="feedback-item-title" class="modal-item-title"></p>
      <input type="hidden" name="item_id">
      <input type="hidden" name="source">
      <input type="hidden" name="segment">
      <input type="hidden" name="item_title">
      <label>Tipo
        <select name="feedback_type" required></select>
      </label>
      <label>Prioridade
        <select name="priority" required></select>
      </label>
      <label>Comentário
        <textarea name="comment" rows="4"></textarea>
      </label>
      <div class="two-cols">
        <label>Nome
          <input name="user_name" autocomplete="name">
        </label>
        <label>E-mail
          <input name="user_email" type="email" autocomplete="email">
        </label>
      </div>
      <div class="modal-actions">
        <button type="button" id="cancel-feedback">Cancelar</button>
        <button type="submit" class="primary-button">Enviar feedback</button>
      </div>
      <p id="feedback-status" role="status"></p>
    </form>
  </dialog>

  <script>${clientScript()}</script>
</body>
</html>`;
}

function selectControl(id, label) {
  return `<label for="filter-${id}">${label}<select id="filter-${id}" data-filter="${id}"><option value="">Todos</option></select></label>`;
}

function copyPublicAssets(fromDir, toDir) {
  if (!fs.existsSync(fromDir)) return;
  for (const entry of fs.readdirSync(fromDir, { withFileTypes: true })) {
    const src = path.join(fromDir, entry.name);
    const dest = path.join(toDir, entry.name);
    if (entry.isDirectory()) {
      fs.cpSync(src, dest, { recursive: true });
    } else {
      fs.copyFileSync(src, dest);
    }
  }
}

function styles() {
  return `
:root {
  --ink: #1f2933;
  --muted: #5d6875;
  --line: #d9e0e7;
  --panel: #ffffff;
  --paper: #f6f8fa;
  --teal: #0f766e;
  --blue: #2457a6;
  --green: #3f7d20;
  --amber: #a15c00;
  --red: #b42318;
  --violet: #6f4bb8;
  --shadow: 0 10px 28px rgba(31, 41, 51, 0.08);
}
* { box-sizing: border-box; }
body {
  margin: 0;
  color: var(--ink);
  background: var(--paper);
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif;
  line-height: 1.45;
}
a { color: var(--blue); }
button, select, input, textarea {
  font: inherit;
}
.topbar {
  display: flex;
  justify-content: space-between;
  gap: 24px;
  align-items: flex-start;
  padding: 24px clamp(18px, 4vw, 48px);
  background: #ffffff;
  border-bottom: 1px solid var(--line);
}
.eyebrow {
  margin: 0 0 4px;
  color: var(--teal);
  font-size: 0.82rem;
  font-weight: 800;
  text-transform: uppercase;
}
h1, h2, h3, p { margin-top: 0; }
h1 {
  margin-bottom: 10px;
  font-size: clamp(1.45rem, 2.5vw, 2.25rem);
  line-height: 1.12;
}
h2 { font-size: 1.05rem; margin-bottom: 10px; }
h3 { font-size: 0.98rem; margin-bottom: 8px; }
.meta-row, .export-actions, .chip-row, .card-meta, .feedback-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}
.meta-row span, .status-pill {
  color: var(--muted);
  font-size: 0.9rem;
}
.status-pill {
  padding: 4px 8px;
  border-radius: 999px;
  background: #eef7f5;
  color: var(--teal);
  border: 1px solid #cde7e2;
}
.export-actions a, button {
  display: inline-flex;
  min-height: 36px;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--line);
  border-radius: 6px;
  padding: 7px 11px;
  background: #fff;
  color: var(--ink);
  text-decoration: none;
  cursor: pointer;
}
.export-actions a:hover, button:hover { border-color: var(--blue); }
.logout-link { color: var(--muted) !important; }
main { padding-bottom: 44px; }
.summary-band, .filters-band, .content-band {
  padding: 22px clamp(18px, 4vw, 48px);
  border-bottom: 1px solid var(--line);
}
.summary-band {
  display: grid;
  grid-template-columns: minmax(0, 1.6fr) minmax(280px, 0.8fr);
  gap: 24px;
  background: #fbfcfd;
}
.summary-list {
  margin: 0;
  padding-left: 18px;
  color: var(--muted);
}
.summary-list li + li { margin-top: 5px; }
.metrics-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}
.metrics-grid div {
  min-height: 74px;
  padding: 12px;
  border: 1px solid var(--line);
  background: #fff;
  border-radius: 8px;
}
.metrics-grid strong {
  display: block;
  font-size: 1.65rem;
  color: var(--blue);
}
.metrics-grid span { color: var(--muted); font-size: 0.85rem; }
.filters-band {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 16px;
  align-items: end;
  background: #ffffff;
}
.filters-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(150px, 1fr));
  gap: 12px;
}
label {
  display: grid;
  gap: 5px;
  color: var(--muted);
  font-size: 0.83rem;
  font-weight: 700;
}
select, input, textarea {
  width: 100%;
  border: 1px solid var(--line);
  border-radius: 6px;
  color: var(--ink);
  background: #fff;
  padding: 8px 10px;
}
textarea { resize: vertical; }
.section-heading {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: baseline;
}
.section-heading p { color: var(--muted); margin-bottom: 0; }
.segment-block + .segment-block { margin-top: 22px; }
.segment-title {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
}
.segment-title span {
  padding: 3px 8px;
  border-radius: 999px;
  background: #edf2ff;
  color: var(--blue);
  font-size: 0.78rem;
  font-weight: 800;
}
.cards-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 14px;
}
.item-card {
  display: grid;
  gap: 12px;
  padding: 16px;
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: 8px;
  box-shadow: var(--shadow);
}
.item-card[data-level="alta"] { border-top: 4px solid var(--red); }
.item-card[data-level="media"] { border-top: 4px solid var(--amber); }
.item-card[data-level="baixa"] { border-top: 4px solid var(--teal); }
.card-meta {
  color: var(--muted);
  font-size: 0.82rem;
}
.score-badge {
  justify-self: start;
  padding: 3px 8px;
  border-radius: 999px;
  background: #f0f5ff;
  color: var(--blue);
  font-weight: 800;
  font-size: 0.78rem;
}
.chip-row span {
  padding: 3px 7px;
  border-radius: 999px;
  background: #eef1f4;
  color: #3e4c59;
  font-size: 0.76rem;
  font-weight: 700;
}
.card-detail {
  display: grid;
  grid-template-columns: 120px 1fr;
  gap: 4px 10px;
  color: var(--muted);
  font-size: 0.86rem;
}
.card-detail strong { color: var(--ink); }
.feedback-actions button {
  min-height: 30px;
  padding: 5px 8px;
  font-size: 0.78rem;
}
.secondary-root {
  display: grid;
  gap: 8px;
}
.compact-item, .empty-state, .status-row, .suggestion-row {
  padding: 12px 14px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: #fff;
}
.compact-item {
  display: grid;
  gap: 4px;
}
.compact-item p, .empty-state p, .status-row p, .suggestion-row p { margin-bottom: 0; color: var(--muted); }
.insight-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
  padding: 22px clamp(18px, 4vw, 48px);
  border-bottom: 1px solid var(--line);
}
.insight-panel {
  min-width: 0;
}
.status-table {
  display: grid;
  border: 1px solid var(--line);
  border-radius: 8px;
  overflow: hidden;
}
.status-row {
  display: grid;
  grid-template-columns: 1.1fr 1fr 0.8fr 1.3fr;
  gap: 12px;
  border: 0;
  border-radius: 0;
  border-bottom: 1px solid var(--line);
}
.status-row:last-child { border-bottom: 0; }
.status-token {
  color: var(--teal);
  font-weight: 800;
}
.feedback-dialog {
  width: min(680px, calc(100vw - 28px));
  border: 1px solid var(--line);
  border-radius: 8px;
  box-shadow: 0 24px 80px rgba(31, 41, 51, 0.24);
}
.feedback-dialog::backdrop { background: rgba(31, 41, 51, 0.45); }
.feedback-form {
  display: grid;
  gap: 14px;
}
.modal-head, .modal-actions, .two-cols {
  display: flex;
  gap: 12px;
}
.modal-head {
  justify-content: space-between;
  align-items: center;
}
.modal-head h2, .modal-item-title { margin-bottom: 0; }
.modal-item-title { color: var(--muted); }
.two-cols > label { flex: 1; }
.modal-actions {
  justify-content: flex-end;
}
.primary-button {
  background: var(--teal);
  border-color: var(--teal);
  color: #fff;
}
#feedback-status { color: var(--muted); margin-bottom: 0; }
@media (max-width: 900px) {
  .topbar, .summary-band, .filters-band, .insight-grid {
    grid-template-columns: 1fr;
  }
  .topbar {
    display: grid;
  }
  .filters-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .status-row {
    grid-template-columns: 1fr;
  }
}
@media (max-width: 560px) {
  .filters-grid, .metrics-grid, .cards-grid, .two-cols {
    grid-template-columns: 1fr;
    display: grid;
  }
  .card-detail {
    grid-template-columns: 1fr;
  }
}
`;
}

function clientScript() {
  return `
const data = JSON.parse(document.getElementById('dashboard-data').textContent);
const filterConfig = JSON.parse(document.getElementById('dashboard-filters').textContent);
const filters = {
  segment: '',
  source: '',
  company: '',
  brand: '',
  tag: '',
  relevance: '',
  action: '',
  origin: ''
};

const feedbackTypes = filterConfig.feedbackTypes || [];
const feedbackPriorities = filterConfig.feedbackPriorities || ['media'];

function init() {
  hydrateMetrics();
  hydrateSummary();
  hydrateFilterOptions();
  bindFilters();
  hydrateFeedbackModal();
  renderAll();
}

function allVisualItems() {
  return [...(data.items || []), ...(data.secondary_items || [])];
}

function hydrateMetrics() {
  document.getElementById('metric-primary').textContent = data.items?.length || 0;
  document.getElementById('metric-secondary').textContent = data.secondary_items?.length || 0;
  document.getElementById('metric-alerts').textContent = data.alerts?.length || 0;
  document.getElementById('metric-failures').textContent = data.collection_failures?.length || 0;
}

function hydrateSummary() {
  const root = document.getElementById('summary-list');
  root.innerHTML = (data.executive_summary || []).map((line) => '<li>' + esc(line) + '</li>').join('');
}

function hydrateFilterOptions() {
  const items = allVisualItems();
  fillSelect('segment', data.segments.map((segment) => [segment.id, segment.label]));
  fillSelect('source', unique(items.map((item) => item.source)).map((value) => [value, value]));
  fillSelect('company', unique(items.map((item) => item.company).filter(Boolean)).map((value) => [value, value]));
  fillSelect('brand', unique(items.map((item) => item.brand).filter(Boolean)).map((value) => [value, value]));
  fillSelect('tag', unique(items.flatMap((item) => item.tags || [])).map((value) => [value, value]));
  fillSelect('relevance', filterConfig.relevanceLevels.map((value) => [value, value]));
  fillSelect('action', filterConfig.recommendedActions.map((value) => [value, value]));
  fillSelect('origin', filterConfig.originTypes.map((value) => [value, value]));
}

function fillSelect(id, options) {
  const select = document.getElementById('filter-' + id);
  select.insertAdjacentHTML('beforeend', options.map(([value, label]) => '<option value="' + esc(value) + '">' + esc(label) + '</option>').join(''));
}

function bindFilters() {
  document.querySelectorAll('[data-filter]').forEach((select) => {
    select.addEventListener('change', () => {
      filters[select.dataset.filter] = select.value;
      renderAll();
    });
  });
  document.getElementById('clear-filters').addEventListener('click', () => {
    Object.keys(filters).forEach((key) => filters[key] = '');
    document.querySelectorAll('[data-filter]').forEach((select) => select.value = '');
    renderAll();
  });
}

function filtered(items) {
  return items.filter((item) => {
    if (filters.segment && item.segment !== filters.segment) return false;
    if (filters.source && item.source !== filters.source) return false;
    if (filters.company && item.company !== filters.company) return false;
    if (filters.brand && item.brand !== filters.brand) return false;
    if (filters.tag && !(item.tags || []).includes(filters.tag)) return false;
    if (filters.relevance && item.relevance_level !== filters.relevance) return false;
    if (filters.action && item.recommended_action !== filters.action) return false;
    if (filters.origin && item.origin_type !== filters.origin) return false;
    return true;
  });
}

function renderAll() {
  renderSegments();
  renderSecondary();
  renderCompactList('opportunities-root', data.opportunities, 'Nenhuma oportunidade principal nesta execução.');
  renderCompactList('alerts-root', data.alerts, 'Nenhum alerta de alta relevância nesta execução.');
  renderSources();
  renderStatusList('no-news-root', data.sources_without_relevant_news, 'Nenhuma fonte registrada como sem notícia relevante.');
  renderStatusList('failures-root', data.collection_failures, 'Nenhuma falha de coleta registrada.');
  renderSuggestions();
}

function renderSegments() {
  const root = document.getElementById('segments-root');
  const visible = filtered(data.items || []);
  document.getElementById('result-count').textContent = visible.length + ' card(s) nos filtros atuais';
  root.innerHTML = data.segments.map((segment) => {
    const segmentItems = visible.filter((item) => item.segment === segment.id);
    const content = segmentItems.length
      ? '<div class="cards-grid">' + segmentItems.map(renderCard).join('') + '</div>'
      : '<div class="empty-state"><strong>Baixa movimentação relevante</strong><p>Sem card principal qualificado para este enfoque nos filtros atuais.</p></div>';
    return '<div class="segment-block"><div class="segment-title"><h3>' + esc(segment.label) + '</h3><span>' + esc(segment.priority) + '</span></div>' + content + '</div>';
  }).join('');
}

function renderSecondary() {
  const items = filtered(data.secondary_items || []);
  const root = document.getElementById('secondary-root');
  root.innerHTML = items.length
    ? items.map((item) => '<div class="compact-item"><strong>' + esc(item.title) + '</strong><p>' + esc(item.segment_label) + ' | ' + esc(item.source) + ' | score ' + esc(item.relevance_score) + '</p></div>').join('')
    : '<div class="empty-state"><strong>Sem itens secundários</strong><p>Nenhum item com score 30 a 49 nos filtros atuais.</p></div>';
}

function renderCard(item) {
  return '<article class="item-card" data-level="' + esc(item.relevance_level) + '">' +
    '<span class="score-badge">score ' + esc(item.relevance_score) + ' | ' + esc(item.relevance_level) + '</span>' +
    '<h3>' + esc(item.title) + '</h3>' +
    '<div class="card-meta"><span>' + esc(item.source) + '</span><span>' + esc(item.publication_date || 'data incerta') + '</span><span>' + esc(item.origin_type) + '</span></div>' +
    '<div class="chip-row">' + (item.tags || []).map((tag) => '<span>' + esc(tag) + '</span>').join('') + '</div>' +
    '<p>' + esc(item.summary) + '</p>' +
    '<div class="card-detail">' +
      '<strong>Empresa</strong><span>' + esc(item.company || 'n/i') + '</span>' +
      '<strong>Marca</strong><span>' + esc(item.brand || 'n/i') + '</span>' +
      '<strong>Avient</strong><span>' + esc(item.avient_connection) + '</span>' +
      '<strong>Relevância</strong><span>' + esc(item.why_relevant) + '</span>' +
      '<strong>Ação</strong><span>' + esc(item.recommended_action) + '</span>' +
      '<strong>Edição/PDF</strong><span>' + esc(item.from_edition ? 'sim' : 'não') + (item.edition_date ? ' | ' + esc(item.edition_date) : '') + '</span>' +
    '</div>' +
    '<div class="feedback-actions">' + feedbackTypes.map((type) => '<button type="button" data-feedback="' + esc(type) + '" data-item="' + esc(item.item_id) + '">' + esc(type) + '</button>').join('') + '</div>' +
    (item.url ? '<a href="' + esc(item.url) + '" target="_blank" rel="noopener noreferrer">Abrir fonte</a>' : '') +
  '</article>';
}

function renderCompactList(rootId, items, emptyText) {
  const root = document.getElementById(rootId);
  root.innerHTML = items && items.length
    ? items.map((item) => '<div class="compact-item"><strong>' + esc(item.title) + '</strong><p>' + esc(item.segment_label) + ' | ' + esc(item.source) + ' | ' + esc(item.recommended_action) + '</p></div>').join('')
    : '<div class="empty-state"><p>' + esc(emptyText) + '</p></div>';
}

function renderSources() {
  const root = document.getElementById('sources-root');
  root.innerHTML = (data.source_statuses || []).map((source) =>
    '<div class="status-row"><strong>' + esc(source.segment_label) + '</strong><span>' + esc(source.source) + '</span><span class="status-token">' + esc(source.status) + '</span><p>' + esc(source.notes || '') + '</p></div>'
  ).join('');
}

function renderStatusList(rootId, rows, emptyText) {
  const root = document.getElementById(rootId);
  root.innerHTML = rows && rows.length
    ? rows.map((row) => '<div class="status-row"><strong>' + esc(row.segment_label || row.segment || '') + '</strong><span>' + esc(row.source) + '</span><span class="status-token">' + esc(row.status) + '</span><p>' + esc(row.notes || '') + '</p></div>').join('')
    : '<div class="empty-state"><p>' + esc(emptyText) + '</p></div>';
}

function renderSuggestions() {
  const root = document.getElementById('suggestions-root');
  const suggestions = data.feedback_suggestions?.suggestions || data.feedback_suggestions || [];
  root.innerHTML = suggestions.length
    ? suggestions.map((item) => '<div class="suggestion-row"><strong>' + esc(item.type) + '</strong><p>' + esc(item.reason || item.suggested_review || '') + '</p></div>').join('')
    : '<div class="empty-state"><p>Nenhuma sugestão gerada a partir de feedback até agora.</p></div>';
}

function hydrateFeedbackModal() {
  const dialog = document.getElementById('feedback-dialog');
  const form = document.getElementById('feedback-ui-form');
  fillOptions(form.elements.feedback_type, feedbackTypes);
  fillOptions(form.elements.priority, feedbackPriorities);
  form.elements.priority.value = feedbackPriorities.includes('media') ? 'media' : feedbackPriorities[0];

  document.body.addEventListener('click', (event) => {
    const button = event.target.closest('[data-feedback]');
    if (!button) return;
    const item = allVisualItems().find((candidate) => candidate.item_id === button.dataset.item);
    if (!item) return;
    form.reset();
    form.elements.feedback_type.value = button.dataset.feedback;
    form.elements.priority.value = feedbackPriorities.includes('media') ? 'media' : feedbackPriorities[0];
    form.elements.item_id.value = item.item_id;
    form.elements.source.value = item.source;
    form.elements.segment.value = item.segment;
    form.elements.item_title.value = item.title;
    document.getElementById('feedback-item-title').textContent = item.title;
    document.getElementById('feedback-status').textContent = '';
    dialog.showModal();
  });

  document.getElementById('close-feedback').addEventListener('click', () => dialog.close());
  document.getElementById('cancel-feedback').addEventListener('click', () => dialog.close());
  form.addEventListener('submit', submitFeedback);
}

function fillOptions(select, values) {
  select.innerHTML = values.map((value) => '<option value="' + esc(value) + '">' + esc(value) + '</option>').join('');
}

async function submitFeedback(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const payload = Object.fromEntries(new FormData(form).entries());
  payload.created_at = new Date().toISOString();
  const status = document.getElementById('feedback-status');
  status.textContent = 'Enviando...';
  let sentToIssue = false;
  try {
    const response = await fetch('/.netlify/functions/feedback', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const result = await response.json().catch(() => ({}));
    sentToIssue = response.ok && result.mode === 'github_issue';
  } catch {
    sentToIssue = false;
  }
  if (!sentToIssue) await submitNetlifyForm(payload);
  status.textContent = 'Feedback registrado.';
  setTimeout(() => document.getElementById('feedback-dialog').close(), 700);
}

async function submitNetlifyForm(payload) {
  const formPayload = new URLSearchParams({ 'form-name': 'dashboard2-feedback', ...payload });
  await fetch('/', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: formPayload.toString()
  });
}

function unique(values) {
  return [...new Set(values.filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b), 'pt-BR'));
}

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[char]));
}

init();
`;
}

