import assert from 'node:assert/strict';
import test from 'node:test';
import { getSegments, listSources, loadSourcesConfig } from '../src/dashboard2/config.js';

test('ordem visual dos enfoques segue o anexo', () => {
  const config = loadSourcesConfig();
  assert.deepEqual(getSegments(config).map((segment) => segment.id), [
    'packaging',
    'beverages',
    'appliances',
    'consumer_goods'
  ]);
});

test('fontes do anexo foram carregadas em YAML/JSON', () => {
  const sources = listSources(loadSourcesConfig());
  assert.ok(sources.length >= 40);
  assert.ok(sources.some((source) => source.name === 'ABRE / Revista ABRE'));
  assert.ok(sources.some((source) => source.name === 'Engarrafador Moderno'));
  assert.ok(sources.some((source) => source.name === 'Eletrolar News / Portal Eletrolar'));
  assert.ok(sources.some((source) => source.name === 'ABIHPEC'));
});

