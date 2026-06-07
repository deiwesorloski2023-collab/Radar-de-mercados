import crypto from 'node:crypto';

const password = process.argv[2] || process.env.DASHBOARD_PASSWORD;

if (!password) {
  console.error('Informe a senha como argumento ou via DASHBOARD_PASSWORD.');
  console.error('Exemplo: npm run hash:password -- "minha-senha-forte"');
  process.exit(1);
}

const hash = crypto.createHash('sha256').update(password, 'utf8').digest('hex');
console.log(`sha256:${hash}`);

