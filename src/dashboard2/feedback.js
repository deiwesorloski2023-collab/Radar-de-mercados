import fs from 'node:fs';
import path from 'node:path';
import { FEEDBACK_SUGGESTIONS_JSON, PUBLIC_DIR } from './config.js';
import { readJson, writeJson } from './utils.js';

export function validateFeedbackPayload(payload, filters) {
  const errors = [];
  const text = (value, max = 500) => String(value ?? '').trim().slice(0, max);
  const normalized = {
    item_id: text(payload.item_id, 120),
    feedback_type: text(payload.feedback_type, 80),
    comment: text(payload.comment, 2000),
    priority: text(payload.priority || 'media', 40),
    user_name: text(payload.user_name, 120),
    user_email: text(payload.user_email, 200),
    source: text(payload.source, 200),
    segment: text(payload.segment, 80),
    item_title: text(payload.item_title, 300),
    created_at: text(payload.created_at || new Date().toISOString(), 80)
  };

  if (!normalized.item_id) errors.push('item_id obrigatorio');
  if (!filters.feedbackTypes.includes(normalized.feedback_type)) errors.push('feedback_type invalido');
  if (!filters.feedbackPriorities.includes(normalized.priority)) errors.push('priority invalida');
  if (normalized.user_email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(normalized.user_email)) errors.push('user_email invalido');
  return { ok: errors.length === 0, errors, value: normalized };
}

export function generateFeedbackSuggestions(feedbackItems = [], latestData = null) {
  const suggestions = [];
  const bySource = countBy(feedbackItems, (item) => `${item.source}|${item.feedback_type}`);
  const byTagUseful = new Map();

  for (const [key, count] of bySource) {
    const [source, feedbackType] = key.split('|');
    if (count < 2) continue;
    if (feedbackType === 'Nao relevante') {
      suggestions.push({
        type: 'reduzir_peso_fonte',
        source,
        reason: `${count} feedbacks marcaram itens desta fonte como Nao relevante.`,
        suggested_review: 'Revisar peso da fonte e termos de exclusao antes de alterar scoring.dashboard2.yml.',
        requires_manual_review: true
      });
    }
    if (feedbackType === 'Precisa revisar') {
      suggestions.push({
        type: 'revisar_regra_classificacao',
        source,
        reason: `${count} feedbacks pediram revisao manual desta fonte.`,
        suggested_review: 'Inspecionar amostras e ajustar heuristicas somente via revisao manual.',
        requires_manual_review: true
      });
    }
  }

  if (latestData) {
    const byItem = new Map([...latestData.items, ...latestData.secondary_items].map((item) => [item.item_id, item]));
    for (const feedback of feedbackItems) {
      const item = byItem.get(feedback.item_id);
      if (!item || !['Util', 'Virou oportunidade'].includes(feedback.feedback_type)) continue;
      for (const tag of item.tags || []) byTagUseful.set(tag, (byTagUseful.get(tag) || 0) + 1);
    }
  }

  for (const [tag, count] of byTagUseful) {
    if (count >= 2) {
      suggestions.push({
        type: 'aumentar_peso_tag',
        tag,
        reason: `${count} feedbacks positivos associados a tag ${tag}.`,
        suggested_review: 'Avaliar aumento de peso ou termos relacionados sem alterar regra automaticamente.',
        requires_manual_review: true
      });
    }
  }

  return {
    generated_at: new Date().toISOString(),
    suggestions,
    guardrail: 'Este arquivo apenas sugere melhorias; nao altera configs automaticamente.'
  };
}

export function loadLocalFeedback() {
  const feedbackDir = path.join(PUBLIC_DIR, 'data', 'feedback');
  if (!fs.existsSync(feedbackDir)) return [];
  return fs.readdirSync(feedbackDir)
    .filter((file) => file.endsWith('.json'))
    .flatMap((file) => readJson(path.join(feedbackDir, file), []));
}

export function writeFeedbackSuggestions(payload, outFile = FEEDBACK_SUGGESTIONS_JSON) {
  writeJson(outFile, payload);
  return outFile;
}

function countBy(items, keyFn) {
  const counts = new Map();
  for (const item of items) {
    const key = keyFn(item);
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return counts;
}

