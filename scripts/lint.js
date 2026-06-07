import childProcess from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { CONFIG_DIR, ROOT_DIR, loadAllConfig } from '../src/dashboard2/config.js';

const required = [
  'config/sources.dashboard2.yml',
  'config/scoring.dashboard2.yml',
  'config/filters.dashboard2.yml',
  'src/dashboard2/date.js',
  'src/dashboard2/scoring.js',
  'src/dashboard2/render.js',
  'netlify/edge-functions/auth.js',
  'netlify/functions/feedback.ts',
  '.github/workflows/update-dashboard2.yml'
];

for (const file of required) {
  const absolute = path.join(ROOT_DIR, file);
  if (!fs.existsSync(absolute)) throw new Error(`Arquivo obrigatorio ausente: ${file}`);
}

loadAllConfig();

for (const configFile of fs.readdirSync(CONFIG_DIR)) {
  const raw = fs.readFileSync(path.join(CONFIG_DIR, configFile), 'utf8');
  JSON.parse(raw);
}

for (const file of listFiles(ROOT_DIR, ['src', 'scripts', 'tests'], '.js')) {
  childProcess.execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' });
}

const envExample = fs.readFileSync(path.join(ROOT_DIR, '.env.example'), 'utf8');
if (/ghp_[A-Za-z0-9_]+|sk-[A-Za-z0-9_-]{20,}/.test(envExample)) {
  throw new Error('Possivel secret encontrado em .env.example');
}

console.log('Lint concluido.');

function listFiles(root, dirs, extension) {
  const files = [];
  for (const dir of dirs) {
    const absolute = path.join(root, dir);
    if (!fs.existsSync(absolute)) continue;
    walk(absolute, files, extension);
  }
  return files;
}

function walk(dir, files, extension) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const absolute = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(absolute, files, extension);
    else if (entry.name.endsWith(extension)) files.push(absolute);
  }
}

