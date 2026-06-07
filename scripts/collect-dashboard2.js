import { collectDashboard2 } from '../src/dashboard2/collector.js';
import { exportCsv, exportPdfs } from '../src/dashboard2/exporters.js';
import { loadAllConfig } from '../src/dashboard2/config.js';
import { generateFeedbackSuggestions, loadLocalFeedback, writeFeedbackSuggestions } from '../src/dashboard2/feedback.js';
import { attachFeedbackSuggestions, loadLatestOrInitial, parseArgs, saveLatest } from './_cli.js';

const options = parseArgs();
const { sources, scoring } = loadAllConfig();

if (options.runPdfOnly) {
  const data = attachFeedbackSuggestions(loadLatestOrInitial());
  exportPdfs(data);
  console.log('PDFs regenerados a partir do latest.');
} else if (options.runFeedbackSuggestionsOnly) {
  const latest = loadLatestOrInitial();
  const suggestions = generateFeedbackSuggestions(loadLocalFeedback(), latest);
  writeFeedbackSuggestions(suggestions);
  console.log(`${suggestions.suggestions.length} sugestao(oes) de feedback gerada(s).`);
} else {
  const data = await collectDashboard2(sources, scoring, options);
  if (options.dryRun) {
    console.log(JSON.stringify({
      status: data.status,
      primary: data.items.length,
      secondary: data.secondary_items.length,
      failures: data.collection_failures.length
    }, null, 2));
  } else {
    saveLatest(data);
    exportCsv(data);
    exportPdfs(data);
    console.log(`Coleta concluida: ${data.items.length} principal(is), ${data.secondary_items.length} secundario(s), ${data.collection_failures.length} falha(s).`);
  }
}

