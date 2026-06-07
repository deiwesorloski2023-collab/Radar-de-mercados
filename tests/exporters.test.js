import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createInitialDashboardData } from '../src/dashboard2/data.js';
import { exportCsv, exportPdfs } from '../src/dashboard2/exporters.js';
import { loadSourcesConfig } from '../src/dashboard2/config.js';

test('exportadores geram CSV e PDFs', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dashboard2-test-'));
  const data = createInitialDashboardData(loadSourcesConfig(), '2026-06-07');
  const csv = exportCsv(data, path.join(dir, 'latest.csv'));
  const pdfs = exportPdfs(data, path.join(dir, 'executive.pdf'), path.join(dir, 'full.pdf'));
  assert.ok(fs.existsSync(csv));
  assert.ok(fs.readFileSync(csv, 'utf8').startsWith('"item_id"'));
  assert.ok(fs.statSync(pdfs.executiveFile).size > 100);
  assert.ok(fs.statSync(pdfs.fullFile).size > 100);
});

