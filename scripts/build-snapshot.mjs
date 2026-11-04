import { createCipheriv, pbkdf2Sync, randomBytes } from 'node:crypto';
import { copyFile, mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const origin = new URL(process.env.DASHBOARD_ORIGIN || 'https://iiko-dashboard.vercel.app').origin;
const login = process.env.DASHBOARD_LOGIN;
const password = process.env.DASHBOARD_PASSWORD;
const passphrase = process.env.SNAPSHOT_PASSPHRASE;
if (!login || !password || !passphrase || passphrase.length < 16) throw new Error('Нужны DASHBOARD_LOGIN, DASHBOARD_PASSWORD и SNAPSHOT_PASSPHRASE (не менее 16 символов)');

const auth = await fetch(`${origin}/api/login`, { method: 'POST', headers: { 'content-type': 'application/json', origin }, body: JSON.stringify({ login, password }), signal: AbortSignal.timeout(30_000) });
if (!auth.ok) throw new Error(`Вход в дашборд не выполнен: HTTP ${auth.status}`);
const cookie = auth.headers.get('set-cookie')?.split(';', 1)[0];
if (!cookie?.startsWith('garden_session=')) throw new Error('Дашборд не вернул сессию');
const response = await fetch(`${origin}/api/compact`, { headers: { cookie }, signal: AbortSignal.timeout(180_000) });
if (!response.ok) throw new Error(`Показатели недоступны: HTTP ${response.status}`);
const data = await response.json();
if (!data.updatedAt || !data.points || !Object.keys(data.points).length) throw new Error('Неполный ответ дашборда');

const salt = randomBytes(16), iv = randomBytes(12), iterations = 210_000;
const key = pbkdf2Sync(passphrase, salt, iterations, 32, 'sha256');
const cipher = createCipheriv('aes-256-gcm', key, iv);
const ciphertext = Buffer.concat([cipher.update(JSON.stringify(data), 'utf8'), cipher.final(), cipher.getAuthTag()]);
const envelope = { version: 1, algorithm: 'AES-256-GCM', kdf: 'PBKDF2-SHA256', iterations, salt: salt.toString('base64'), iv: iv.toString('base64'), data: ciphertext.toString('base64') };
await mkdir(join(root, 'dist', 'data'), { recursive: true });
await Promise.all(['index.html', 'styles.css', 'app.js'].map(name => copyFile(join(root, name), join(root, 'dist', name))));
await writeFile(join(root, 'dist', 'data', 'current.enc.json'), JSON.stringify(envelope));
console.log(`Snapshot ready: ${data.updatedAt}, ${Object.keys(data.points).length} points`);

