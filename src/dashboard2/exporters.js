import fs from 'node:fs';
import path from 'node:path';
import { EXECUTIVE_PDF, FULL_PDF, LATEST_CSV } from './config.js';
import { formatPtBrDate } from './date.js';
import { ensureDir } from './utils.js';

const CSV_FIELDS = [
  'item_id',
  'segment_label',
  'title',
  'source',
  'publication_date',
  'consulted_at',
  'company',
  'brand',
  'tags',
  'summary',
  'why_relevant',
  'avient_connection',
  'relevance_level',
  'relevance_score',
  'recommended_action',
  'origin_type',
  'from_edition',
  'edition_date',
  'url'
];

export function exportCsv(data, outFile = LATEST_CSV) {
  ensureDir(path.dirname(outFile));
  const rows = [...data.items, ...data.secondary_items].map((item) =>
    CSV_FIELDS.map((field) => csvCell(Array.isArray(item[field]) ? item[field].join('; ') : item[field])).join(',')
  );
  const csv = [CSV_FIELDS.map(csvCell).join(','), ...rows].join('\n') + '\n';
  fs.writeFileSync(outFile, csv, 'utf8');
  return outFile;
}

export function exportPdfs(data, executiveFile = EXECUTIVE_PDF, fullFile = FULL_PDF) {
  ensureDir(path.dirname(executiveFile));
  ensureDir(path.dirname(fullFile));
  fs.writeFileSync(executiveFile, makePdf(executiveLines(data), 'Dashboard 2 - PDF executivo'), 'binary');
  fs.writeFileSync(fullFile, makePdf(fullLines(data), 'Dashboard 2 - PDF completo'), 'binary');
  return { executiveFile, fullFile };
}

function csvCell(value) {
  const text = String(value ?? '').replace(/\r?\n/g, ' ').trim();
  return `"${text.replace(/"/g, '""')}"`;
}

function executiveLines(data) {
  const lines = [
    data.dashboard_name,
    `Atualizacao: ${formatPtBrDate(data.update_date)} | Janela: ${data.analysis_window_label}`,
    '',
    'Resumo executivo',
    ...data.executive_summary.map((line) => `- ${line}`),
    '',
    'Alertas de alta relevancia',
    ...(data.alerts.length ? data.alerts.slice(0, 5).map((item) => `- ${item.title} (${item.source}, score ${item.relevance_score})`) : ['- Sem alertas de alta relevancia na janela.']),
    '',
    'Top oportunidades',
    ...(data.opportunities.length ? data.opportunities.slice(0, 5).map((item) => `- ${item.title}: ${item.avient_connection}`) : ['- Sem oportunidades principais nesta execucao.']),
    '',
    'Conclusao',
    data.items.length
      ? 'Priorizar os cards de maior score e validar a acao comercial indicada antes do contato externo.'
      : 'Baixa movimentacao relevante: manter o radar ativo e revisar fontes com falha ou data incerta.'
  ];
  return lines;
}

function fullLines(data) {
  const lines = [
    data.dashboard_name,
    `Atualizacao: ${formatPtBrDate(data.update_date)}`,
    `Janela obrigatoria: ${data.analysis_window_label}`,
    `Status: ${data.status}`,
    '',
    'Metodologia',
    ...Object.values(data.methodology).map((line) => `- ${line}`),
    '',
    'Cards principais'
  ];

  for (const item of data.items) {
    lines.push(
      '',
      `${item.segment_label} | score ${item.relevance_score} | ${item.relevance_level}`,
      item.title,
      `Fonte: ${item.source} | Data: ${item.publication_date || 'data incerta'}`,
      `Resumo: ${item.summary}`,
      `Relevancia para Avient: ${item.why_relevant}`,
      `Conexao: ${item.avient_connection}`,
      `Acao sugerida: ${item.recommended_action}`,
      `URL: ${item.url}`
    );
  }

  lines.push('', 'Monitoramento secundario');
  for (const item of data.secondary_items) {
    lines.push(`- ${item.segment_label}: ${item.title} (${item.source}, score ${item.relevance_score})`);
  }

  lines.push('', 'Fontes consultadas');
  for (const source of data.source_statuses) {
    lines.push(`- ${source.segment_label} | ${source.source}: ${source.status}`);
  }

  lines.push('', 'Falhas de coleta');
  if (data.collection_failures.length) {
    for (const failure of data.collection_failures) lines.push(`- ${failure.source}: ${failure.notes}`);
  } else {
    lines.push('- Nenhuma falha registrada.');
  }

  lines.push('', 'Itens para revisao manual');
  if (data.manual_review_items.length) {
    for (const item of data.manual_review_items) lines.push(`- ${item.title} (${item.source})`);
  } else {
    lines.push('- Nenhum item com data incerta ou revisao manual obrigatoria.');
  }
  return lines;
}

function makePdf(lines, title) {
  const pageLines = paginate(lines.flatMap((line) => wrapLine(line, 96)), 44);
  const objects = [];
  const pages = [];
  objects.push('<< /Type /Catalog /Pages 2 0 R >>');
  objects.push('PAGES_PLACEHOLDER');
  objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');

  for (const page of pageLines) {
    const content = renderPageContent(page, title);
    const contentIndex = objects.length + 1;
    objects.push(`<< /Length ${byteLength(content)} >>\nstream\n${content}\nendstream`);
    const pageIndex = objects.length + 1;
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentIndex} 0 R >>`);
    pages.push(`${pageIndex} 0 R`);
  }

  objects[1] = `<< /Type /Pages /Kids [${pages.join(' ')}] /Count ${pages.length} >>`;
  return assemblePdf(objects);
}

function paginate(lines, maxLines) {
  const pages = [];
  for (let index = 0; index < lines.length; index += maxLines) {
    pages.push(lines.slice(index, index + maxLines));
  }
  return pages.length ? pages : [[]];
}

function wrapLine(line, width) {
  const text = String(line ?? '');
  if (!text) return [''];
  const words = text.split(/\s+/);
  const lines = [];
  let current = '';
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > width && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function renderPageContent(lines, title) {
  const commands = ['BT', '/F1 10 Tf', '50 748 Td', `(${escapePdf(title)}) Tj`, '0 -24 Td'];
  for (const line of lines) {
    commands.push(`(${escapePdf(line)}) Tj`, '0 -15 Td');
  }
  commands.push('ET');
  return commands.join('\n');
}

function assemblePdf(objects) {
  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(byteLength(pdf));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xrefOffset = byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets.slice(1)) {
    pdf += `${String(offset).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return pdf;
}

function escapePdf(value) {
  return String(value ?? '')
    .normalize('NFKD')
    .replace(/[^\x20-\x7E]/g, '')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}

function byteLength(value) {
  return Buffer.byteLength(value, 'binary');
}
