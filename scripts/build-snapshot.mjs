import { copyFile, mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const origin = new URL(process.env.DASHBOARD_ORIGIN || 'https://iiko-dashboard.vercel.app').origin;
const login = process.env.DASHBOARD_LOGIN;
const password = process.env.DASHBOARD_PASSWORD;
if (!login || !password) throw new Error('Нужны DASHBOARD_LOGIN и DASHBOARD_PASSWORD');

const auth = await fetch(`${origin}/api/login`, { method: 'POST', headers: { 'content-type': 'application/json', origin }, body: JSON.stringify({ login, password }), signal: AbortSignal.timeout(30_000) });
if (!auth.ok) throw new Error(`Вход в дашборд не выполнен: HTTP ${auth.status}`);
const cookie = auth.headers.get('set-cookie')?.split(';', 1)[0];
if (!cookie?.startsWith('garden_session=')) throw new Error('Дашборд не вернул сессию');
const response = await fetch(`${origin}/api/compact`, { headers: { cookie }, signal: AbortSignal.timeout(180_000) });
if (!response.ok) throw new Error(`Показатели недоступны: HTTP ${response.status}`);
const data = await response.json();
if (!data.updatedAt || !data.points || !Object.keys(data.points).length) throw new Error('Неполный ответ дашборда');

await mkdir(join(root, 'dist', 'data'), { recursive: true });
await Promise.all(['index.html', 'styles.css', 'app.js'].map(name => copyFile(join(root, name), join(root, 'dist', name))));
await writeFile(join(root, 'dist', 'data', 'current.json'), JSON.stringify(data));
console.log(`Snapshot ready: ${data.updatedAt}, ${Object.keys(data.points).length} points`);

