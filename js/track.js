// Analytics: open, step, complete, leave(ms). Batched, sent every 8 s and on leave.
import { api } from './api.js';
let q = [], cur = null;
const dev = () => (matchMedia('(max-width: 760px)').matches ? 'mobile' : 'desktop');
const sid = () => Math.random().toString(36).slice(2, 12);
export function push(e) { q.push({ ...e, at: Date.now(), dev: dev() }); if (q.length >= 20) flush(); }
export async function flush() { if (!q.length) return; const batch = q.splice(0, 50); try { await api('/api/events', { method: 'POST', body: { events: batch } }); } catch { q.unshift(...batch); } }
setInterval(flush, 8000);
export function startSession(fmt, variant) {
  endSession();
  cur = { fmt, variant, sid: sid(), t0: Date.now(), active: 0, last: Date.now(), steps: new Set(), done: false };
  push({ fmt, variant, sid: cur.sid, type: 'open' });
  return {
    step(name) { if (!cur || cur.steps.has(name)) return; cur.steps.add(name); push({ fmt, variant, sid: cur.sid, type: 'step', step: name }); },
    complete() { if (!cur || cur.done) return; cur.done = true; push({ fmt, variant, sid: cur.sid, type: 'complete', ms: activeMs() }); },
    click(name) { if (cur) push({ fmt, variant, sid: cur.sid, type: 'click', step: name }); },
  };
}
function activeMs() { if (!cur) return 0; return cur.active + (document.hidden ? 0 : Date.now() - cur.last); }
export function endSession() {
  if (!cur) return; push({ fmt: cur.fmt, variant: cur.variant, sid: cur.sid, type: 'leave', ms: activeMs() }); cur = null; flush();
}
document.addEventListener('visibilitychange', () => {
  if (!cur) return;
  if (document.hidden) { cur.active += Date.now() - cur.last; flush(); } else cur.last = Date.now();
});
addEventListener('pagehide', () => endSession());
