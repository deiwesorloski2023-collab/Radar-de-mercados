import { buildStaticDashboard } from '../src/dashboard2/render.js';
import { exportCsv, exportPdfs } from '../src/dashboard2/exporters.js';
import { LATEST_JSON, loadAllConfig } from '../src/dashboard2/config.js';
import { attachFeedbackSuggestions, loadLatestOrInitial, saveLatest } from './_cli.js';

const { filters } = loadAllConfig();
const data = attachFeedbackSuggestions(loadLatestOrInitial());
saveLatest(data);
exportCsv(data);
exportPdfs(data);
const htmlPath = buildStaticDashboard(data, filters);

console.log(`Dashboard gerado em ${htmlPath}`);
console.log(`Dados latest em ${LATEST_JSON}`);

