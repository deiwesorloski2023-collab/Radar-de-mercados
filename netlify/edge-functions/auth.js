const ONE_WEEK = 60 * 60 * 24 * 7;

export default async (request, context) => {
  const url = new URL(request.url);
  const authEnabled = env('DASHBOARD_AUTH_ENABLED', 'true') !== 'false';
  const cookieName = env('DASHBOARD_COOKIE_NAME', 'dashboard2_session');

  if (!authEnabled) return context.next();

  if (url.pathname === '/logout') {
    return redirect('/login', {
      'set-cookie': `${cookieName}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`
    });
  }

  const configuredHash = env('DASHBOARD_PASSWORD_HASH', '');
  const sessionSecret = env('DASHBOARD_SESSION_SECRET', '');
  if (!configuredHash || !sessionSecret) {
    return htmlResponse(loginShell('Configuração de autenticação incompleta.', true), 503);
  }

  const session = getCookie(request.headers.get('cookie') || '', cookieName);
  if (session && await verifySession(session, sessionSecret)) {
    if (url.pathname === '/login') return redirect('/');
    return context.next();
  }

  if (url.pathname === '/login' && request.method === 'POST') {
    const form = await request.formData();
    const password = String(form.get('password') || '');
    if (await verifyPassword(password, configuredHash)) {
      const cookie = await createSessionCookie(cookieName, sessionSecret, url.protocol === 'https:');
      return redirect('/', { 'set-cookie': cookie });
    }
    return htmlResponse(loginShell('Senha inválida.', false), 401);
  }

  if (url.pathname === '/login') return htmlResponse(loginShell('', false), 200);
  return redirect(`/login?next=${encodeURIComponent(url.pathname)}`);
};

function env(name, fallback = '') {
  return globalThis.Netlify?.env?.get(name) ?? globalThis.Deno?.env?.get(name) ?? fallback;
}

function loginShell(message, error) {
  const color = error ? '#b42318' : '#5d6875';
  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex,nofollow">
  <title>Login - Dashboard 2</title>
  <style>
    body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #f6f8fa; color: #1f2933; font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif; }
    main { width: min(420px, calc(100vw - 32px)); background: #fff; border: 1px solid #d9e0e7; border-radius: 8px; padding: 24px; box-shadow: 0 18px 48px rgba(31, 41, 51, 0.12); }
    h1 { margin: 0 0 8px; font-size: 1.4rem; }
    p { color: #5d6875; margin: 0 0 18px; }
    label { display: grid; gap: 7px; color: #5d6875; font-weight: 700; font-size: 0.9rem; }
    input { min-height: 40px; border: 1px solid #d9e0e7; border-radius: 6px; padding: 8px 10px; font: inherit; }
    button { margin-top: 14px; width: 100%; min-height: 40px; border: 1px solid #0f766e; border-radius: 6px; background: #0f766e; color: #fff; font: inherit; font-weight: 800; cursor: pointer; }
    .message { color: ${color}; min-height: 20px; margin-top: 12px; }
  </style>
</head>
<body>
  <main>
    <h1>Dashboard 2</h1>
    <p>Radar Mercados de Aplicação & Brand Owners Avient</p>
    <form method="POST" action="/login">
      <label>Senha
        <input name="password" type="password" autocomplete="current-password" required autofocus>
      </label>
      <button type="submit">Entrar</button>
    </form>
    <p class="message">${escapeHtml(message)}</p>
  </main>
</body>
</html>`;
}

async function verifyPassword(password, configuredHash) {
  const expected = configuredHash.replace(/^sha256:/, '').toLowerCase();
  const actual = await sha256Hex(password);
  return timingSafeEqual(actual, expected);
}

async function createSessionCookie(cookieName, secret, secure) {
  const expires = Math.floor(Date.now() / 1000) + ONE_WEEK;
  const message = String(expires);
  const mac = await hmacHex(secret, message);
  const secureFlag = secure ? '; Secure' : '';
  return `${cookieName}=${expires}.${mac}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${ONE_WEEK}${secureFlag}`;
}

async function verifySession(cookieValue, secret) {
  const [expires, mac] = cookieValue.split('.');
  if (!expires || !mac || Number(expires) < Math.floor(Date.now() / 1000)) return false;
  const expected = await hmacHex(secret, expires);
  return timingSafeEqual(mac, expected);
}

async function sha256Hex(text) {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return hex(digest);
}

async function hmacHex(secret, message) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
  return hex(signature);
}

function hex(buffer) {
  return [...new Uint8Array(buffer)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let index = 0; index < a.length; index += 1) out |= a.charCodeAt(index) ^ b.charCodeAt(index);
  return out === 0;
}

function getCookie(header, name) {
  return header.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${name}=`))?.slice(name.length + 1) || '';
}

function redirect(location, headers = {}) {
  return new Response(null, { status: 302, headers: { location, ...headers } });
}

function htmlResponse(body, status) {
  return new Response(body, { status, headers: { 'content-type': 'text/html; charset=utf-8' } });
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[char]));
}

