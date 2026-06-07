declare const Netlify: {
  env: {
    get(name: string): string | undefined;
  };
};

const FEEDBACK_TYPES = [
  'Util',
  'Nao relevante',
  'Ja sabia',
  'Virou oportunidade',
  'Precisa revisar',
  'Sugerir acao comercial'
];

const PRIORITIES = ['baixa', 'media', 'alta'];

export default async (request: Request) => {
  if (request.method === 'OPTIONS') return json({ ok: true });
  if (request.method !== 'POST') return json({ ok: false, error: 'Metodo nao permitido.' }, 405);

  let payload: Record<string, unknown>;
  try {
    payload = await request.json();
  } catch {
    return json({ ok: false, error: 'JSON invalido.' }, 400);
  }

  const validation = validate(payload);
  if (!validation.ok) return json({ ok: false, errors: validation.errors }, 400);

  const token = env('FEEDBACK_GITHUB_TOKEN');
  const owner = env('FEEDBACK_REPO_OWNER');
  const repo = env('FEEDBACK_REPO_NAME');

  if (!token || !owner || !repo) {
    return json({ ok: true, mode: 'netlify_forms_fallback' });
  }

  const labels = buildLabels(validation.value);
  const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/issues`, {
    method: 'POST',
    headers: {
      accept: 'application/vnd.github+json',
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
      'user-agent': 'dashboard2-feedback-netlify-function'
    },
    body: JSON.stringify({
      title: `[Dashboard 2] ${validation.value.feedback_type}: ${validation.value.item_title}`,
      labels,
      body: issueBody(validation.value)
    })
  });

  if (!response.ok) {
    const detail = await response.text();
    return json({ ok: false, error: 'Falha ao criar GitHub Issue.', detail: detail.slice(0, 500) }, 502);
  }

  const issue = await response.json();
  return json({ ok: true, mode: 'github_issue', issue_url: issue.html_url });
};

function validate(payload: Record<string, unknown>) {
  const value = {
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
  const errors = [];
  if (!value.item_id) errors.push('item_id obrigatorio');
  if (!FEEDBACK_TYPES.includes(value.feedback_type)) errors.push('feedback_type invalido');
  if (!PRIORITIES.includes(value.priority)) errors.push('priority invalida');
  if (value.user_email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value.user_email)) errors.push('user_email invalido');
  return { ok: errors.length === 0, errors, value };
}

function buildLabels(value: ReturnType<typeof validate>['value']) {
  const base = (env('FEEDBACK_ISSUE_LABELS') || 'dashboard2-feedback,dashboard2')
    .split(',')
    .map((label) => label.trim())
    .filter(Boolean);
  base.push(`segment:${labelSafe(value.segment)}`);
  base.push(`feedback:${labelSafe(value.feedback_type)}`);
  if (['Nao relevante', 'Precisa revisar', 'Sugerir acao comercial'].includes(value.feedback_type)) base.push('review-rules');
  return [...new Set(base)];
}

function issueBody(value: ReturnType<typeof validate>['value']) {
  return [
    'Feedback recebido pelo Dashboard 2.',
    '',
    `- Tipo: ${value.feedback_type}`,
    `- Prioridade: ${value.priority}`,
    `- Item: ${value.item_title}`,
    `- Item ID: ${value.item_id}`,
    `- Fonte: ${value.source}`,
    `- Segmento: ${value.segment}`,
    `- Criado em: ${value.created_at}`,
    value.user_name ? `- Nome: ${value.user_name}` : '',
    value.user_email ? `- E-mail: ${value.user_email}` : '',
    '',
    'Comentario:',
    value.comment || 'Sem comentario.'
  ].filter(Boolean).join('\n');
}

function env(name: string) {
  return Netlify.env.get(name) || '';
}

function text(value: unknown, max: number) {
  return String(value ?? '').replace(/[<>]/g, '').trim().slice(0, max);
}

function labelSafe(value: string) {
  return value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-|-$/g, '');
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store'
    }
  });
}
