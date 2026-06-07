import { generateFeedbackSuggestions, loadLocalFeedback, writeFeedbackSuggestions } from '../src/dashboard2/feedback.js';
import { loadLatestOrInitial } from './_cli.js';

const suggestions = generateFeedbackSuggestions(loadLocalFeedback(), loadLatestOrInitial());
const outFile = writeFeedbackSuggestions(suggestions);
console.log(`${suggestions.suggestions.length} sugestao(oes) gravada(s) em ${outFile}`);

