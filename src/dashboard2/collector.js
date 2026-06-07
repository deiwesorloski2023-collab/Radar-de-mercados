import { createInitialDashboardData, enrichDashboardData } from './data.js';
import { deduplicateItems } from './dedup.js';
import { parseDateLike, saoPauloDate } from './date.js';
import { classifyCandidate } from './scoring.js';
import { normalizeText, stripHtml } from './utils.js';

const DEFAULT_TIMEOUT_MS = 15000;

export async function collectDashboard2(config, scoring, options = {}) {
  const updateDate = options.updateDate || saoPauloDate();
  const windowDays = config.analysisWindowDays;
  const data = createInitialDashboardData(config, updateDate);
  const rawItems = [];
  const maxItems = Number(options.maxItems || 200);

  for (const segment of orderedSegments(config)) {
    for (const source of segment.sources) {
      const sourceContext = { ...source, segmentId: segment.id, segmentLabel: segment.displayLabel };
      if (!sourceDue(sourceContext, updateDate, options)) {
        updateSourceStatus(data, sourceContext, 'fora da frequencia operacional', 'Fonte preservada para execucao futura; janela de analise continua em 30 dias.');
        continue;
      }

      try {
        const candidates = await collectSourceCandidates(sourceContext, updateDate, options);
        if (!candidates.length) {
          updateSourceStatus(data, sourceContext, 'sem noticia relevante', 'Consulta realizada, mas nenhum candidato datado e relevante foi identificado.');
          data.sources_without_relevant_news.push(sourceStatusEntry(sourceContext, updateDate, 'sem noticia relevante'));
          continue;
        }

        const classified = candidates.map((candidate) =>
          classifyCandidate(candidate, {
            source: sourceContext,
            segment,
            scoring,
            updateDate,
            windowDays
          })
        );
        rawItems.push(...classified);
        updateSourceStatus(data, sourceContext, 'sucesso', `${classified.length} candidato(s) processado(s).`);
      } catch (error) {
        const status = sourceStatusEntry(sourceContext, updateDate, 'falha de acesso', error.message);
        data.collection_failures.push(status);
        updateSourceStatus(data, sourceContext, status.status, error.message);
      }

      if (rawItems.length >= maxItems) break;
    }
  }

  const deduped = deduplicateItems(rawItems);
  const primary = [];
  const secondary = [];
  const manual = [];
  let discarded = 0;

  for (const segment of orderedSegments(config)) {
    const items = deduped
      .filter((item) => item.segment === segment.id)
      .sort((a, b) => b.relevance_score - a.relevance_score || String(b.publication_date).localeCompare(String(a.publication_date)));

    for (const item of items) {
      if (item.review_required) manual.push(item);
      if (item.relevance_score >= scoring.minimumPrimaryScore && item.publication_date) {
        primary.push(item);
      } else if (
        item.relevance_score >= scoring.minimumSecondaryScore &&
        item.relevance_score < scoring.minimumPrimaryScore &&
        item.publication_date
      ) {
        secondary.push(item);
      } else {
        discarded += 1;
      }
    }
  }

  data.items = limitBySegment(primary, config, scoring.maximumPrimaryCardsPerSegment);
  data.secondary_items = secondary;
  data.manual_review_items = manual;
  data.discarded_count = discarded;
  return enrichDashboardData(data, scoring);
}

function orderedSegments(config) {
  const byId = new Map(config.segments.map((segment) => [segment.id, segment]));
  return config.visualOrder.map((id) => byId.get(id)).filter(Boolean);
}

function limitBySegment(items, config, maxPerSegment) {
  const result = [];
  for (const segment of orderedSegments(config)) {
    result.push(...items.filter((item) => item.segment === segment.id).slice(0, maxPerSegment));
  }
  return result;
}

function sourceDue(source, updateDate, options) {
  if (options.forceAll) return true;
  if (options.forceSegment && options.forceSegment !== source.segmentId) return false;
  if (source.cadence === 'weekly') return true;
  const day = Number(updateDate.slice(-2));
  if (source.cadence?.includes('biweekly')) return day <= 7 || (day >= 15 && day <= 21);
  if (source.cadence?.includes('monthly')) return day <= 7;
  return true;
}

async function collectSourceCandidates(source, updateDate, options) {
  if (source.requiresManualUrlReview) {
    throw new Error('URL marcada para revisao manual antes da coleta automatica.');
  }
  const urls = uniqueUrls([...(source.feedUrls || []), ...(source.newsUrls || []), source.homepage]);
  const candidates = [];
  for (const url of urls) {
    const response = await fetchText(url, options.timeoutMs || DEFAULT_TIMEOUT_MS);
    const contentType = response.contentType || '';
    if (contentType.includes('xml') || response.text.includes('<rss') || response.text.includes('<feed')) {
      candidates.push(...extractFeedCandidates(response.text, source, url));
    } else {
      candidates.push(...extractHtmlCandidates(response.text, source, url));
    }
  }

  if (source.editionRequired || source.editionUrl) {
    const editionUrl = source.editionUrl || findEditionUrl(candidates, source);
    if (editionUrl) {
      candidates.push({
        title: `Ultima edicao/publicacao consultada - ${source.name}`,
        summary: 'Registro tecnico de consulta a edicao, PDF, flipbook ou publicacao periodica. Usar como fonte para revisao manual se a data individual nao estiver clara.',
        url: editionUrl,
        originType: 'edicao da revista',
        fromEdition: true,
        publishedAt: '',
        dateUncertain: true
      });
    }
  }

  return candidates.slice(0, 30);
}

async function fetchText(url, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'user-agent': 'Dashboard2RadarMercados/0.1 (+manual Avient market radar)',
        accept: 'text/html,application/rss+xml,application/atom+xml,application/xml;q=0.9,*/*;q=0.8'
      }
    });
    if (!response.ok) throw new Error(`HTTP ${response.status} em ${url}`);
    const text = await response.text();
    return { text, contentType: response.headers.get('content-type') || '' };
  } finally {
    clearTimeout(timeout);
  }
}

function extractFeedCandidates(xml, source, baseUrl) {
  const itemBlocks = [...xml.matchAll(/<(item|entry)\b[\s\S]*?<\/\1>/gi)].map((match) => match[0]);
  return itemBlocks.map((block) => {
    const title = stripHtml(firstXmlText(block, ['title']));
    const link = firstLink(block, baseUrl);
    const publishedAt = parseDateLike(firstXmlText(block, ['pubDate', 'published', 'updated', 'dc:date']));
    const summary = stripHtml(firstXmlText(block, ['description', 'summary', 'content:encoded']));
    return {
      title,
      url: link,
      summary,
      publishedAt,
      originType: 'noticia do site',
      company: source.officialCompany ? source.name : ''
    };
  }).filter((item) => item.title);
}

function extractHtmlCandidates(html, source, baseUrl) {
  const candidates = [];
  const anchors = [...html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)];
  const pageText = stripHtml(html).slice(0, 200000);
  const pageDate = inferDateFromText(pageText);

  for (const [, href, labelHtml] of anchors.slice(0, 500)) {
    const title = stripHtml(labelHtml);
    if (!title || title.length < 12 || title.length > 180) continue;
    const normalized = normalizeText(title);
    if (isNavigationLike(normalized)) continue;
    if (!looksRelevant(normalized)) continue;
    candidates.push({
      title,
      url: resolveUrl(href, baseUrl),
      summary: buildHtmlSummary(title, pageText),
      publishedAt: pageDate,
      originType: 'noticia do site',
      company: source.officialCompany ? source.name : ''
    });
  }
  return candidates;
}

function buildHtmlSummary(title, pageText) {
  const normalizedTitle = normalizeText(title).split(' ').slice(0, 5);
  const sentences = pageText.split(/(?<=[.!?])\s+/).filter((sentence) => {
    const normalized = normalizeText(sentence);
    return normalizedTitle.some((term) => normalized.includes(term));
  });
  const sentence = sentences.find((candidate) => !isBoilerplateSummary(candidate));
  return (sentence || title).slice(0, 420);
}

function looksRelevant(normalized) {
  return [
    'embalagem',
    'plastico',
    'pet',
    'rpet',
    'recicl',
    'sustent',
    'lancamento',
    'nova linha',
    'design',
    'garrafa',
    'tampa',
    'frasco',
    'eletrodomestico',
    'cosmetico'
  ].some((term) => normalized.includes(term));
}

function isNavigationLike(normalized) {
  return [
    'fale conosco',
    'contato',
    'quem somos',
    'sobre',
    'assine',
    'anuncie',
    'pauta editorial',
    'materias especiais',
    'embalagem design',
    'embalagem e design',
    'ultimas noticias',
    'ciencia e tecnologia',
    'politica de privacidade',
    'termos de uso'
  ].includes(normalized);
}

function isBoilerplateSummary(value) {
  const normalized = normalizeText(value);
  return [
    'close menu',
    'home tendencias',
    'cadastre se quem somos',
    'fale conosco anuncie',
    'subscribe to updates',
    'get the latest creative news'
  ].some((term) => normalized.includes(term));
}

function inferDateFromText(text) {
  return parseDateLike(text.match(/\b\d{1,2}[/-]\d{1,2}[/-]20\d{2}\b/)?.[0]) ||
    parseDateLike(text.match(/\b20\d{2}[-/]\d{1,2}[-/]\d{1,2}\b/)?.[0]);
}

function firstXmlText(block, tags) {
  for (const tag of tags) {
    const escaped = tag.replace(':', '\\:');
    const match = block.match(new RegExp(`<${escaped}\\b[^>]*>([\\s\\S]*?)<\\/${escaped}>`, 'i'));
    if (match) return match[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1');
  }
  return '';
}

function firstLink(block, baseUrl) {
  const href = block.match(/<link\b[^>]*href=["']([^"']+)["']/i)?.[1] ||
    block.match(/<link\b[^>]*>([\s\S]*?)<\/link>/i)?.[1];
  return resolveUrl(stripHtml(href || ''), baseUrl);
}

function resolveUrl(href, baseUrl) {
  try {
    return new URL(href, baseUrl).toString();
  } catch {
    return baseUrl;
  }
}

function findEditionUrl(candidates, source) {
  const found = candidates.find((candidate) => /revista|edicao|edi[cç][aã]o|pdf|flipbook|publica/i.test(candidate.title));
  return found?.url || source.editionUrl || '';
}

function sourceStatusEntry(source, updateDate, status, notes = '') {
  return {
    source_id: source.id,
    source: source.name,
    segment: source.segmentId,
    segment_label: source.segmentLabel,
    cadence: source.cadence,
    layer: source.layer,
    consulted_at: updateDate,
    status,
    homepage: source.homepage,
    edition_checked: Boolean(source.editionRequired || source.editionUrl),
    notes
  };
}

function updateSourceStatus(data, source, status, notes) {
  const entry = data.source_statuses.find((item) => item.source_id === source.id);
  if (!entry) return;
  entry.status = status;
  entry.notes = notes;
  entry.edition_checked = Boolean(source.editionRequired || source.editionUrl);
}

function uniqueUrls(values) {
  return [...new Set(values.filter(Boolean))];
}
