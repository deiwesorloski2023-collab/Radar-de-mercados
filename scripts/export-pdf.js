import { exportPdfs } from '../src/dashboard2/exporters.js';
import { loadLatestOrInitial } from './_cli.js';

const result = exportPdfs(loadLatestOrInitial());
console.log(`PDF executivo gerado em ${result.executiveFile}`);
console.log(`PDF completo gerado em ${result.fullFile}`);

