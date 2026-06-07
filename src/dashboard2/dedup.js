import { normalizeText, safeUrl } from './utils.js';

export function deduplicateItems(items) {
  const byKey = new Map();
  for (const item of items) {
    const key = makeDedupeKey(item);
    if (!byKey.has(key)) {
      byKey.set(key, { ...item, additional_sources: [] });
      continue;
    }
    const existing = byKey.get(key);
    if (item.relevance_score > existing.relevance_score) {
      byKey.set(key, {
        ...item,
        additional_sources: mergeSources(existing, item)
      });
    } else {
      existing.additional_sources = mergeSources(existing, item);
    }
  }
  return [...byKey.values()];
}

function makeDedupeKey(item) {
  const url = safeUrl(item.url);
  if (url) return url.replace(/^https?:\/\/(www\.)?/, '');
  return [normalizeText(item.title), normalizeText(item.company), item.publication_date].join('|');
}

function mergeSources(existing, item) {
  const sources = existing.additional_sources || [];
  const next = { source: item.source, url: item.url };
  const all = [...sources, next].filter((entry) => entry.source && entry.source !== existing.source);
  return all.filter((entry, index, array) => array.findIndex((candidate) => candidate.source === entry.source) === index);
}

