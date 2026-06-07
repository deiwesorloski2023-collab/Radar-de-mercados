import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { buildStaticDashboard } from '../src/dashboard2/render.js';
import { exportCsv, exportPdfs } from '../src/dashboard2/exporters.js';
import { DIST_DIR, loadAllConfig } from '../src/dashboard2/config.js';
import { attachFeedbackSuggestions, loadLatestOrInitial, saveLatest } from './_cli.js';

const { filters } = loadAllConfig();
const data = attachFeedbackSuggestions(loadLatestOrInitial());
saveLatest(data);
exportCsv(data);
exportPdfs(data);
buildStaticDashboard(data, filters);

const startPort = Number(process.env.PORT || 4173);
start(startPort);

function start(port) {
  const server = http.createServer((request, response) => {
    const url = new URL(request.url, `http://localhost:${port}`);
    const requested = url.pathname === '/' ? '/index.html' : decodeURIComponent(url.pathname);
    const filePath = path.normalize(path.join(DIST_DIR, requested));
    if (!filePath.startsWith(DIST_DIR)) {
      response.writeHead(403);
      response.end('Forbidden');
      return;
    }
    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      response.writeHead(404);
      response.end('Not found');
      return;
    }
    response.writeHead(200, { 'content-type': contentType(filePath) });
    fs.createReadStream(filePath).pipe(response);
  });
  server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') start(port + 1);
    else throw error;
  });
  server.listen(port, () => {
    console.log(`Dashboard local em http://localhost:${port}`);
  });
}

function contentType(filePath) {
  if (filePath.endsWith('.html')) return 'text/html; charset=utf-8';
  if (filePath.endsWith('.json')) return 'application/json; charset=utf-8';
  if (filePath.endsWith('.csv')) return 'text/csv; charset=utf-8';
  if (filePath.endsWith('.pdf')) return 'application/pdf';
  return 'application/octet-stream';
}

