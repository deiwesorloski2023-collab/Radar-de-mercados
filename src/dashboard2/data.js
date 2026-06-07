import { getSegments, listSources } from './config.js';
import { formatPtBrDate, saoPauloDate, subtractDays } from './date.js';

export function createInitialDashboardData(config, updateDate = saoPauloDate()) {
  const windowDays = config.analysisWindowDays;
  const sources = listSources(config);
  const segments = getSegments(config).map((segment) => ({
    id: segment.id,
    label: segment.displayLabel,
    priority: segment.priority,
    cadence: segment.cadence
  }));

  return {
    schema_version: 1,
    dashboard_id: config.dashboardId,
    dashboard_name: config.dashboardName,
    repository: config.repository,
    generated_at: new Date().toISOString(),
    update_date: updateDate,
    update_date_label: formatPtBrDate(updateDate),
    timezone: config.timezone,
    analysis_window_days: windowDays,
    analysis_window_start: subtractDays(updateDate, windowDays),
    analysis_window_label: `${formatPtBrDate(subtractDays(updateDate, windowDays))} a ${formatPtBrDate(updateDate)}`,
    status: 'coleta inicial pendente',
    executive_summary: [
      'Nenhuma coleta real foi executada ainda neste artefato.',
      'Ao rodar npm run collect:dashboard2, o dashboard consulta as fontes configuradas, aplica a janela fixa de 30 dias e gera os arquivos latest.'
    ],
    alerts: [],
    opportunities: [],
    segments,
    items: [],
    secondary_items: [],
    manual_review_items: [],
    discarded_count: 0,
    source_statuses: sources.map((source) => ({
      source_id: source.id,
      source: source.name,
      segment: source.segmentId,
      segment_label: source.segmentLabel,
      cadence: source.cadence,
      layer: source.layer,
      consulted_at: updateDate,
      status: source.requiresManualUrlReview ? 'revisar URL da fonte' : 'coleta pendente',
      homepage: source.homepage,
      edition_checked: false,
      notes: source.requiresManualUrlReview
        ? 'Fonte do anexo mantida, mas a URL precisa de validacao manual antes da coleta automatica.'
        : 'Fonte configurada para a proxima execucao.'
    })),
    sources_without_relevant_news: [],
    collection_failures: [],
    edition_statuses: [],
    feedback_suggestions: [],
    methodology: buildMethodology(config)
  };
}

export function enrichDashboardData(data, scoringConfig) {
  const bySegment = new Map(data.segments.map((segment) => [segment.id, []]));
  for (const item of data.items) {
    bySegment.get(item.segment)?.push(item);
  }

  data.alerts = data.items
    .filter((item) => item.relevance_score >= 75 || item.relevance_level === 'alta')
    .slice(0, 8);
  data.opportunities = data.items
    .filter((item) => ['contatar cliente', 'mapear oportunidade', 'preparar argumento tecnico'].includes(item.recommended_action))
    .slice(0, 10);

  const summary = [];
  for (const segment of data.segments) {
    const count = bySegment.get(segment.id)?.length || 0;
    if (count === 0) {
      summary.push(`${segment.label}: baixa movimentacao relevante nos ultimos ${data.analysis_window_days} dias.`);
    } else {
      const top = bySegment.get(segment.id)[0];
      summary.push(`${segment.label}: ${count} card(s) principal(is); principal sinal: ${top.title}.`);
    }
  }
  data.executive_summary = summary;
  data.status = data.collection_failures.length ? 'concluido com falhas por fonte' : 'concluido';
  data.methodology = buildMethodology({ analysisWindowDays: data.analysis_window_days }, scoringConfig);
  return data;
}

export function buildMethodology(config, scoringConfig = null) {
  const minimum = scoringConfig?.minimumPrimaryScore ?? 50;
  const secondary = scoringConfig?.minimumSecondaryScore ?? 30;
  return {
    analysis_window: `${config.analysisWindowDays} dias corridos, calculados a partir da data da execucao em America/Sao_Paulo.`,
    primary_rule: `Entram como cards principais itens dentro da janela com score >= ${minimum}.`,
    secondary_rule: `Itens dentro da janela com score entre ${secondary} e ${minimum - 1} vao para Monitoramento secundario.`,
    old_content_rule: 'Conteudo fora da janela de 30 dias nao entra no dashboard principal nem no monitoramento secundario.',
    llm_rule: 'A classificacao heuristica e obrigatoria. LLM e opcional e nunca deve justificar conteudo fora da janela.'
  };
}

