import assert from 'node:assert/strict';
import test from 'node:test';
import { classifyCandidate } from '../src/dashboard2/scoring.js';
import { loadScoringConfig, loadSourcesConfig } from '../src/dashboard2/config.js';

test('score alto para embalagem plastica recente com empresa prioritaria', () => {
  const sourcesConfig = loadSourcesConfig();
  const scoring = loadScoringConfig();
  const segment = sourcesConfig.segments.find((item) => item.id === 'beverages');
  const source = segment.sources.find((item) => item.id === 'coca-cola-brasil');
  const item = classifyCandidate({
    title: 'Coca-Cola Brasil anuncia nova garrafa PET com rPET e reducao de plastico',
    summary: 'Lancamento de nova embalagem reciclavel com rPET, tampa e rotulo redesenhado.',
    publishedAt: '2026-06-01',
    url: 'https://example.com/noticia'
  }, {
    source,
    segment,
    scoring,
    updateDate: '2026-06-07',
    windowDays: 30
  });

  assert.equal(item.relevance_level, 'alta');
  assert.ok(item.relevance_score >= 70);
  assert.ok(item.tags.includes('rPET'));
  assert.notEqual(item.recommended_action, 'descartar');
});

test('conteudo fora da janela e descartado', () => {
  const sourcesConfig = loadSourcesConfig();
  const scoring = loadScoringConfig();
  const segment = sourcesConfig.segments.find((item) => item.id === 'packaging');
  const source = segment.sources[0];
  const item = classifyCandidate({
    title: 'Nova embalagem PET com PCR',
    summary: 'Conteudo tecnico relevante, mas antigo.',
    publishedAt: '2026-04-01',
    url: 'https://example.com/antigo'
  }, {
    source,
    segment,
    scoring,
    updateDate: '2026-06-07',
    windowDays: 30
  });

  assert.ok(item.relevance_score < 30);
  assert.equal(item.recommended_action, 'descartar');
});

