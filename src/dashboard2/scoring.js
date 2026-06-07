import { isWithinWindow, parseDateLike } from './date.js';
import { clamp, hashId, normalizeText, safeUrl, unique } from './utils.js';

function includesAny(normalizedText, terms = []) {
  return terms.some((term) => {
    const normalizedTerm = normalizeText(term);
    if (!normalizedTerm) return false;
    if (/^[a-z0-9]{1,3}$/.test(normalizedTerm)) {
      return new RegExp(`(^|\\s)${escapeRegExp(normalizedTerm)}(\\s|$)`).test(normalizedText);
    }
    return normalizedText.includes(normalizedTerm);
  });
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function addScore(state, amount, reason) {
  state.score += amount;
  if (reason) state.reasons.push(reason);
}

export function classifyCandidate(candidate, context) {
  const { source, segment, scoring, updateDate, windowDays } = context;
  const weights = scoring.weights;
  const publishedAt = parseDateLike(candidate.publishedAt || candidate.date || candidate.pubDate);
  const rawText = [
    candidate.title,
    candidate.summary,
    candidate.description,
    candidate.company,
    candidate.brand,
    source.name
  ].join(' ');
  const normalized = normalizeText(rawText);
  const state = { score: 0, reasons: [] };

  const tags = Object.entries(scoring.tagTerms)
    .filter(([, terms]) => includesAny(normalized, terms))
    .map(([tag]) => tag);

  const matchedPriorityCompany = scoring.priorityCompanies.find((company) =>
    normalized.includes(normalizeText(company))
  );

  if (!publishedAt) {
    addScore(state, 0, 'Data nao identificavel; enviar para revisao manual.');
  } else if (!isWithinWindow(publishedAt, updateDate, windowDays)) {
    addScore(state, weights.outsideWindow, 'Fora da janela obrigatoria de 30 dias.');
  }

  if (source.priorityCompany || matchedPriorityCompany) {
    addScore(state, weights.priorityCompany, 'Menciona empresa prioritaria.');
  }
  if (includesAny(normalized, ['nova embalagem', 'redesign', 'novo material', 'material reciclado', 'embalagem reciclavel', 'embalagem recarregavel', 'refil', 'refis'])) {
    addScore(state, weights.newPackagingOrMaterial, 'Indica nova embalagem, redesign ou novo material.');
  }
  if (includesAny(normalized, ['pcr', 'rpet', 'reciclavel', 'reciclabilidade', 'circularidade', 'reducao de plastico', 'menos plastico', 'recarregavel', 'responsabilidade estendida do produtor'])) {
    addScore(state, weights.sustainabilityCircularity, 'Conecta a sustentabilidade, PCR, rPET ou circularidade.');
  }
  if (includesAny(normalized, ['nova linha', 'lancamento', 'expansao', 'nova planta', 'investimento industrial', 'capacidade produtiva'])) {
    addScore(state, weights.launchOrExpansion, 'Sinaliza lancamento, nova linha ou expansao industrial.');
  }
  if (includesAny(normalized, ['cor', 'cores', 'acabamento', 'textura', 'cmf', 'premiumizacao', 'design'])) {
    addScore(state, weights.colorDesignCmf, 'Tem conexao com cor, acabamento, textura, CMF ou design.');
  }
  if (includesAny(normalized, ['pet', 'pp', 'pe', 'abs', 'tampa', 'frasco', 'garrafa', 'garrafao', 'rotulo', 'sleeve', 'peca plastica'])) {
    addScore(state, weights.plasticMaterialOrPart, 'Menciona material, embalagem ou peca plastica.');
  }
  if (source.officialCompany || source.name.match(/ABIR|ABINAM|ABIHPEC|ABIPLA|ABRE|Eletros|ABIA/i)) {
    addScore(state, weights.officialSource, 'Fonte oficial de empresa ou associacao.');
  }
  if (!source.officialCompany && source.layer <= 2) {
    addScore(state, weights.specializedSource, 'Fonte setorial especializada.');
  }
  if (includesAny(normalized, scoring.excludeTerms)) {
    addScore(state, weights.marketplaceCouponPriceReview, 'Termos de exclusao comercial ou varejo sem sinal tecnico.');
  }
  if (!includesAny(normalized, scoring.includeTerms) && tags.length === 0) {
    addScore(state, weights.noTechnicalOrCommercialConnection, 'Sem conexao clara com produto, embalagem, material, design ou oportunidade.');
  }

  const boundedScore = clamp(state.score, -100, 100);
  const relevanceLevel = boundedScore >= 70 ? 'alta' : boundedScore >= 50 ? 'media' : 'baixa';
  const recommendedAction = chooseAction(boundedScore, tags, normalized, source);
  const normalizedUrl = safeUrl(candidate.url || candidate.link || source.homepage);
  const itemId = hashId([source.id, candidate.title, publishedAt, normalizedUrl].join('|'));

  return {
    item_id: itemId,
    title: candidate.title || 'Titulo nao identificado',
    source: source.name,
    source_id: source.id,
    segment: segment.id,
    segment_label: segment.displayLabel,
    publication_date: publishedAt,
    consulted_at: updateDate,
    company: candidate.company || matchedPriorityCompany || inferCompany(candidate.title, scoring.priorityCompanies),
    brand: candidate.brand || '',
    tags: unique(tags),
    summary: candidate.summary || candidate.description || 'Resumo indisponivel; revisar a fonte original.',
    why_relevant: explainRelevance(boundedScore, state.reasons, tags),
    avient_connection: explainAvientConnection(tags),
    relevance_score: boundedScore,
    relevance_level: relevanceLevel,
    recommended_action: recommendedAction,
    url: normalizedUrl,
    origin_type: candidate.originType || 'noticia do site',
    from_edition: Boolean(candidate.fromEdition || source.editionRequired),
    edition_date: parseDateLike(candidate.editionDate) || '',
    classification_reasons: state.reasons,
    review_required: !publishedAt || candidate.dateUncertain || false,
    raw: {
      source_homepage: source.homepage,
      collected_title: candidate.title || ''
    }
  };
}

function inferCompany(title, companies) {
  const normalized = normalizeText(title);
  return companies.find((company) => normalized.includes(normalizeText(company))) || '';
}

function chooseAction(score, tags, normalized, source) {
  if (score < 30) return 'descartar';
  if (source.eventSensitive) return 'acompanhar feira';
  if (includesAny(normalized, ['nova planta', 'expansao', 'investimento industrial'])) return 'mapear oportunidade';
  if (score >= 70 && (source.priorityCompany || tags.includes('aditivo_masterbatch'))) return 'contatar cliente';
  if (tags.includes('aditivo_masterbatch') || tags.includes('cor_acabamento_cmf')) return 'preparar argumento tecnico';
  if (score >= 50) return 'mapear oportunidade';
  return 'monitorar';
}

function explainRelevance(score, reasons, tags) {
  if (score < 30) return 'Item mantido fora do dashboard visual por baixa conexao tecnica ou comercial.';
  const base = reasons.slice(0, 3).join(' ');
  const tagText = tags.length ? ` Tags: ${tags.join(', ')}.` : '';
  return `${base || 'Sinal relevante para acompanhamento.'}${tagText}`.trim();
}

function explainAvientConnection(tags) {
  const connections = [];
  if (tags.some((tag) => ['PET', 'rPET', 'PCR', 'PE', 'PP', 'ABS'].includes(tag))) {
    connections.push('materiais e resinas');
  }
  if (tags.some((tag) => ['cor_acabamento_cmf', 'aditivo_masterbatch'].includes(tag))) {
    connections.push('cor, masterbatch, aditivos e acabamento');
  }
  if (tags.some((tag) => ['tampa', 'frasco', 'garrafa', 'rotulo', 'refil', 'monomaterial'].includes(tag))) {
    connections.push('embalagem plastica, componentes e reciclabilidade');
  }
  if (!connections.length) return 'Conexao potencial a revisar manualmente antes de acao comercial.';
  return `Possivel oportunidade em ${connections.join('; ')}.`;
}
