import assert from 'node:assert/strict';
import test from 'node:test';
import { generateFeedbackSuggestions, validateFeedbackPayload } from '../src/dashboard2/feedback.js';
import { loadFiltersConfig } from '../src/dashboard2/config.js';

test('payload de feedback e validado', () => {
  const filters = loadFiltersConfig();
  const result = validateFeedbackPayload({
    item_id: 'abc',
    feedback_type: 'Util',
    priority: 'media',
    item_title: 'Item',
    source: 'Fonte',
    segment: 'packaging'
  }, filters);
  assert.equal(result.ok, true);
});

test('sugestoes de feedback nao alteram regras automaticamente', () => {
  const result = generateFeedbackSuggestions([
    { source: 'Fonte A', feedback_type: 'Nao relevante' },
    { source: 'Fonte A', feedback_type: 'Nao relevante' }
  ]);
  assert.equal(result.guardrail.includes('nao altera'), true);
  assert.equal(result.suggestions[0].requires_manual_review, true);
});

