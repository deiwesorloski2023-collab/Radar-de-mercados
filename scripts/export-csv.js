import { exportCsv } from '../src/dashboard2/exporters.js';
import { loadLatestOrInitial } from './_cli.js';

const outFile = exportCsv(loadLatestOrInitial());
console.log(`CSV gerado em ${outFile}`);

