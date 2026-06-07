import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT_DIR = fileURLToPath(new URL('../../', import.meta.url));
export const CONFIG_DIR = path.join(ROOT_DIR, 'config');
export const PUBLIC_DIR = path.join(ROOT_DIR, 'public');
export const DIST_DIR = path.join(ROOT_DIR, 'dist');
export const LATEST_JSON = path.join(PUBLIC_DIR, 'data', 'dashboard2-latest.json');
export const FEEDBACK_SUGGESTIONS_JSON = path.join(PUBLIC_DIR, 'data', 'dashboard2-feedback-suggestions.json');
export const LATEST_CSV = path.join(PUBLIC_DIR, 'exports', 'dashboard2-latest.csv');
export const EXECUTIVE_PDF = path.join(PUBLIC_DIR, 'exports', 'dashboard2-executive.pdf');
export const FULL_PDF = path.join(PUBLIC_DIR, 'exports', 'dashboard2-full.pdf');

function readJsonYaml(fileName) {
  const filePath = path.join(CONFIG_DIR, fileName);
  const raw = fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '');
  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new Error(`${fileName} precisa permanecer no subconjunto JSON/YAML usado pelo projeto: ${error.message}`);
  }
}

export function loadSourcesConfig() {
  return readJsonYaml('sources.dashboard2.yml');
}

export function loadScoringConfig() {
  return readJsonYaml('scoring.dashboard2.yml');
}

export function loadFiltersConfig() {
  return readJsonYaml('filters.dashboard2.yml');
}

export function loadAllConfig() {
  return {
    sources: loadSourcesConfig(),
    scoring: loadScoringConfig(),
    filters: loadFiltersConfig()
  };
}

export function getSegments(config = loadSourcesConfig()) {
  const byId = new Map(config.segments.map((segment) => [segment.id, segment]));
  return config.visualOrder.map((id) => byId.get(id)).filter(Boolean);
}

export function listSources(config = loadSourcesConfig()) {
  return getSegments(config).flatMap((segment) =>
    segment.sources.map((source) => ({
      ...source,
      segmentId: segment.id,
      segmentLabel: segment.displayLabel,
      segmentPriority: segment.priority
    }))
  );
}

