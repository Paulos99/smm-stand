import { API_BASES, HEDGE_MS } from './config.js';
const LS = { token: 'stand-token', user: 'stand-user', tester: 'stand-tester' };
export const store = {
  get token() { return localStorage.getItem(LS.token) || ''; },
  get user() { try { return JSON.parse(localStorage.getItem(LS.user) || 'null'); } catch { return null; } },
  get tester() { return localStorage.getItem(LS.tester) || ''; },
  set tester(v) { localStorage.setItem(LS.tester, v); },
  save(t, u) { localStorage.setItem(LS.token, t); localStorage.setItem(LS.user, JSON.stringify(u)); },
  clear() { localStorage.removeItem(LS.token); localStorage.removeItem(LS.user); },
};
let preferred = 0;
async function one(base, path, opt, ctrl) {
  const r = await fetch(base + path, { ...opt, signal: ctrl.signal });
  const j = await r.json().catch(() => ({}));
  return { r, j };
}
export async function api(path, { method = 'GET', body, timeout = 30000 } = {}) {
  const headers = { 'content-type': 'application/json' };
  if (store.token) headers['x-stand-token'] = store.token;
  const tester = store.tester || store.user?.name || '';
  if (tester) headers['x-stand-tester'] = encodeURIComponent(tester);
  const opt = { method, headers, body: body ? JSON.stringify(body) : undefined };
  const order = [preferred, ...API_BASES.keys()].filter((v, i, a) => a.indexOf(v) === i);
  const ctrls = [];
  const res = await new Promise((resolve, reject) => {
    let done = false, fails = 0;
    const start = idx => {
      const c = new AbortController(); ctrls.push(c); setTimeout(() => c.abort(), timeout);
      one(API_BASES[idx], path, opt, c).then(x => { if (!done) { done = true; preferred = idx; resolve(x); } })
        .catch(e => { fails++; if (fails >= order.length && !done) reject(new Error('Нет связи с сервером. Проверьте интернет и попробуйте ещё раз.')); else if (order[1] !== undefined && fails === 1 && ctrls.length < 2) start(order[1]); });
    };
    start(order[0]);
    if (order.length > 1) setTimeout(() => { if (!done && ctrls.length < 2) start(order[1]); }, HEDGE_MS);
  });
  ctrls.forEach(c => { try { c.abort(); } catch {} });
  if (res.r.status === 401 && path !== '/api/login') { store.clear(); location.hash = '#/login'; throw new Error('Сессия закончилась, войдите снова'); }
  if (!res.r.ok) throw new Error(res.j.error || 'Ошибка ' + res.r.status);
  return res.j;
}
// binary files from the API (lesson slides): the token goes in a header, so paid images never sit at a public URL
export async function apiBlob(path, { timeout = 30000 } = {}) {
  const headers = store.token ? { 'x-stand-token': store.token } : {};
  const order = [preferred, ...API_BASES.keys()].filter((v, i, a) => a.indexOf(v) === i);
  let last;
  for (const idx of order) {
    const c = new AbortController(); const t = setTimeout(() => c.abort(), timeout);
    try {
      const r = await fetch(API_BASES[idx] + path, { headers, signal: c.signal });
      if (r.status === 401) throw Object.assign(new Error('Сессия закончилась, войдите снова'), { fatal: true });
      if (!r.ok) throw Object.assign(new Error('Ошибка ' + r.status), { fatal: r.status === 404 });
      preferred = idx; return await r.blob();
    } catch (e) { last = e; if (e.fatal) throw e; } finally { clearTimeout(t); }
  }
  throw last || new Error('Нет связи с сервером');
}
