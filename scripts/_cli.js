import fs from 'node:fs';
import { FEEDBACK_SUGGESTIONS_JSON, LATEST_JSON, loadAllConfig } from '../src/dashboard2/config.js';
import { createInitialDashboardData } from '../src/dashboard2/data.js';
import { readJson, writeJson } from '../src/dashboard2/utils.js';

export function parseArgs(argv = process.argv.slice(2)) {
  const options = {};
  for (const arg of argv) {
    if (arg === '--force-all' || arg === 'force_all=true') options.forceAll = true;
    else if (arg === '--dry-run' || arg === 'dry_run=true') options.dryRun = true;
    else if (arg === '--run-pdf-only' || arg === 'run_pdf_only=true') options.runPdfOnly = true;
    else if (arg === '--run-feedback-suggestions-only' || arg === 'run_feedback_suggestions_only=true') options.runFeedbackSuggestionsOnly = true;
    else if (arg.startsWith('--force-segment=')) options.forceSegment = arg.split('=')[1];
    else if (arg.startsWith('force_segment=')) options.forceSegment = arg.split('=')[1];
    else if (arg.startsWith('--max-items=')) options.maxItems = Number(arg.split('=')[1]);
    else if (arg.startsWith('max_items=')) options.maxItems = Number(arg.split('=')[1]);
    else if (arg.startsWith('--update-date=')) options.updateDate = arg.split('=')[1];
  }
  return options;
}

export function loadLatestOrInitial() {
  const { sources } = loadAllConfig();
  return readJson(LATEST_JSON) || createInitialDashboardData(sources);
}

export function saveLatest(data) {
  writeJson(LATEST_JSON, data);
  return LATEST_JSON;
}

export function attachFeedbackSuggestions(data) {
  if (fs.existsSync(FEEDBACK_SUGGESTIONS_JSON)) {
    data.feedback_suggestions = readJson(FEEDBACK_SUGGESTIONS_JSON, { suggestions: [] });
  }
  return data;
}

