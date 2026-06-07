import assert from 'node:assert/strict';
import test from 'node:test';
import { isWithinWindow, subtractDays } from '../src/dashboard2/date.js';

test('janela obrigatoria usa 30 dias corridos', () => {
  assert.equal(subtractDays('2026-06-07', 30), '2026-05-08');
  assert.equal(isWithinWindow('2026-05-08', '2026-06-07', 30), true);
  assert.equal(isWithinWindow('2026-05-07', '2026-06-07', 30), false);
  assert.equal(isWithinWindow('2026-06-08', '2026-06-07', 30), false);
});

