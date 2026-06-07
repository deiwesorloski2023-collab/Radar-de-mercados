import assert from 'node:assert/strict';
import test from 'node:test';
import { createInitialDashboardData } from '../src/dashboard2/data.js';
import { renderDashboardHtml } from '../src/dashboard2/render.js';
import { loadFiltersConfig, loadSourcesConfig } from '../src/dashboard2/config.js';

test('HTML final contem estrutura principal e feedback', () => {
  const data = createInitialDashboardData(loadSourcesConfig(), '2026-06-07');
  const html = renderDashboardHtml(data, loadFiltersConfig());
  assert.match(html, /Embalagens Plásticas/);
  assert.match(html, /Bebidas/);
  assert.match(html, /Eletrodomésticos/);
  assert.match(html, /Bens de Consumo/);
  assert.match(html, /dashboard2-feedback/);
  assert.match(html, /exports\/dashboard2-latest\.csv/);
});

