// Lesson files as cards: preview, name, type, size; «Открыть» shows the pages in a fullscreen viewer with pinch-zoom, «Скачать» saves the file.
// The files are paid school content: they live only in the API image and come through short-lived signed links for signed-in players.
import { api, apiBlob } from '../js/api.js?v=20261122q';
import { sfx } from './play.js?v=20261122q';

const el = (tag, attrs = {}, ...kids) => {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) { if (v == null || v === false) continue; if (k.startsWith('on')) n.addEventListener(k.slice(2), v); else n.setAttribute(k, v); }
  for (const c of kids.flat()) if (c != null && c !== false) n.append(c.nodeType ? c : document.createTextNode(c));
  return n;
};
const ico = (id, cls = '') => { const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); s.setAttribute('class', 'ic ' + cls); s.setAttribute('aria-hidden', 'true'); s.innerHTML = `<use href="#i-${id}"/>`; return s; };
const plural = (n, a, b, c) => { const m = n % 10, h = n % 100; return m === 1 && h !== 11 ? a : m >= 2 && m <= 4 && (h < 12 || h > 14) ? b : c; };
export const fmtSize = b => b >= 1e6 ? (b / 1048576).toFixed(1).replace('.', ',') + ' МБ' : Math.max(1, Math.round(b / 1024)) + ' КБ';
const KIND = { pdf: 'PDF', doc: 'Документ', image: 'Картинка' };

export function fileCards({ op, mats, lesson, school, toast }) {
  let cur = mats; const blobs = new Map();
  const refresh = async () => { const L = await api('/api/game/lecture?op=' + op); if (L.mats) cur = L.mats; };
  const fileOf = id => cur.files.find(f => f.id === id);
  const url = (f, part) => `/api/game/f/${op}/${f.id}/${part}?e=${f.e}&s=${f.s}`;
  async function get(id, part) {
    try { return await apiBlob(url(fileOf(id), part), { timeout: 60000 }); }
    catch (e) { if (!/403/.test(e.message)) throw e; await refresh(); return apiBlob(url(fileOf(id), part), { timeout: 60000 }); }
  }
  async function img(id, part) { const k = id + '/' + part; if (!blobs.has(k)) blobs.set(k, get(id, part).then(b => URL.createObjectURL(b)).catch(e => { blobs.delete(k); throw e; })); return blobs.get(k); }

  async function download(f, btn) {
    if (btn.disabled) return; btn.disabled = true; const lab = btn.querySelector('span'); const was = lab.textContent; sfx.tick();
    try {
      const parts = [];
      for (let k = 0; k < f.chunks; k++) { lab.textContent = f.chunks > 1 ? `${Math.round(k / f.chunks * 100)}%` : 'Скачиваю…'; parts.push(await get(f.id, 'd' + k)); }
      const blob = new Blob(parts, { type: 'application/octet-stream' }); const u = URL.createObjectURL(blob);
      const a = el('a', { href: u, download: f.name }); document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 60000);
      lab.textContent = 'Готово'; setTimeout(() => { lab.textContent = was; }, 1800);
    } catch (e) { lab.textContent = was; toast?.(e.message || 'Не получилось скачать', 'bad'); }
    finally { btn.disabled = false; }
  }

  const card = f => {
    const thumb = el('span', { class: 'fc-thumb fc-' + f.kind, 'aria-hidden': 'true' }, el('span', { class: 'fc-badge fmt-' + f.format.toLowerCase() }, f.format));
    img(f.id, 't').then(u => { const i = el('img', { src: u, alt: '', loading: 'lazy', decoding: 'async' }); i.onload = () => thumb.classList.add('ready'); thumb.prepend(i); }).catch(() => thumb.classList.add('nothumb'));
    const dl = el('button', { class: 'fc-btn', type: 'button', 'aria-label': `Скачать «${f.title}», ${fmtSize(f.bytes)}`, onclick: e => download(fileOf(f.id), e.currentTarget) }, ico('down'), el('span', {}, 'Скачать'));
    const open = el('button', { class: 'fc-btn fc-open', type: 'button', 'aria-label': `Открыть «${f.title}»`, onclick: () => { sfx.tick(); viewer(fileOf(f.id)); } }, ico('expand'), el('span', {}, 'Открыть'));
    return el('li', { class: 'fc' },
      el('button', { class: 'fc-prev', type: 'button', tabindex: '-1', 'aria-hidden': 'true', onclick: () => viewer(fileOf(f.id)) }, thumb),
      el('div', { class: 'fc-info' },
        el('b', { class: 'fc-title' }, f.title),
        el('span', { class: 'fc-meta muted tn' }, `${f.format} · ${fmtSize(f.bytes)}${f.pages > 1 ? ` · ${f.pages} ${f.id === 'presentation' ? plural(f.pages, 'слайд', 'слайда', 'слайдов') : 'стр.'}` : ''}`),
        el('div', { class: 'fc-acts' }, open, dl)));
  };

  function viewer(f) {
    const prevFocus = document.activeElement; let zoom = 1; const MIN = 1, MAX = 4;
    const pages = el('div', { class: 'fv-pages' });
    const scroller = el('div', { class: 'fv-scroll', tabindex: '0' }, pages);
    const zl = el('span', { class: 'fv-z tn', 'aria-live': 'polite' }, '100%');
    const setZoom = (z, cx, cy) => {
      z = Math.min(MAX, Math.max(MIN, z)); if (Math.abs(z - zoom) < .001) return;
      const r = scroller.getBoundingClientRect(); cx ??= r.width / 2; cy ??= r.height / 2;
      const ax = (scroller.scrollLeft + cx) / zoom, ay = (scroller.scrollTop + cy) / zoom;
      zoom = z; pages.style.width = (z * 100) + '%'; zl.textContent = Math.round(z * 100) + '%';
      scroller.scrollLeft = ax * z - cx; scroller.scrollTop = ay * z - cy;
    };
    const close = () => { ov.remove(); window.removeEventListener('keydown', onKey, true); document.documentElement.classList.remove('fv-lock'); prevFocus?.focus?.(); };
    const onKey = e => { if (e.key === 'Escape') { e.stopImmediatePropagation(); e.preventDefault(); close(); return; } if ((e.key === '+' || e.key === '=') && !e.ctrlKey) setZoom(zoom * 1.25); if (e.key === '-' && !e.ctrlKey) setZoom(zoom / 1.25); };
    const dl = el('button', { class: 'fv-b fv-dl', type: 'button', 'aria-label': 'Скачать файл' }, ico('down'), el('span', {}, 'Скачать'));
    dl.onclick = () => download(fileOf(f.id), dl);
    const ov = el('div', { class: 'fv', role: 'dialog', 'aria-modal': 'true', 'aria-label': f.title },
      el('div', { class: 'fv-bar' },
        el('div', { class: 'fv-t' }, el('b', {}, f.title), el('span', { class: 'muted tn' }, `${f.format} · ${fmtSize(f.bytes)}`)),
        el('div', { class: 'fv-tools' },
          el('button', { class: 'fv-b', type: 'button', 'aria-label': 'Уменьшить', onclick: () => setZoom(zoom / 1.25) }, '−'), zl,
          el('button', { class: 'fv-b', type: 'button', 'aria-label': 'Увеличить', onclick: () => setZoom(zoom * 1.25) }, '+'), dl,
          el('button', { class: 'fv-b fv-x', type: 'button', 'aria-label': 'Закрыть', onclick: close }, ico('x')))),
      scroller);
    const ratio = f.w && f.h ? f.h / f.w : 1.414;
    for (let n = 1; n <= Math.max(1, f.pages); n++) {
      const pg = el('div', { class: 'fv-page', style: `aspect-ratio:${f.w || 1000}/${f.h || Math.round(1000 * ratio)}` }, el('span', { class: 'fv-n tn' }, `${n} / ${f.pages}`));
      pages.append(pg);
    }
    // pages load as they come near the screen
    const io = new IntersectionObserver(es => es.forEach(e => { if (!e.isIntersecting) return; io.unobserve(e.target); const n = [...pages.children].indexOf(e.target) + 1;
      img(f.id, 'p' + n).then(u => { const i = el('img', { src: u, alt: `Страница ${n}`, decoding: 'async' }); i.onload = () => e.target.classList.add('ready'); e.target.append(i); }).catch(() => e.target.classList.add('bad')); }), { root: scroller, rootMargin: '150% 0px' });
    [...pages.children].forEach(p => io.observe(p));
    // pinch with two fingers, ctrl+wheel or trackpad pinch on a computer, double tap toggles 2×
    let pinch = null, lastTap = 0;
    const dist = t => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
    scroller.addEventListener('touchstart', e => { if (e.touches.length === 2) { const r = scroller.getBoundingClientRect(); pinch = { d: dist(e.touches), z: zoom, cx: (e.touches[0].clientX + e.touches[1].clientX) / 2 - r.left, cy: (e.touches[0].clientY + e.touches[1].clientY) / 2 - r.top }; }
      else if (e.touches.length === 1) { const now = Date.now(); if (now - lastTap < 300) { const r = scroller.getBoundingClientRect(); setZoom(zoom > 1.5 ? 1 : 2, e.touches[0].clientX - r.left, e.touches[0].clientY - r.top); e.preventDefault(); } lastTap = now; } }, { passive: false });
    scroller.addEventListener('touchmove', e => { if (pinch && e.touches.length === 2) { e.preventDefault(); setZoom(pinch.z * dist(e.touches) / pinch.d, pinch.cx, pinch.cy); } }, { passive: false });
    scroller.addEventListener('touchend', e => { if (e.touches.length < 2) pinch = null; });
    scroller.addEventListener('wheel', e => { if (!e.ctrlKey) return; e.preventDefault(); const r = scroller.getBoundingClientRect(); setZoom(zoom * Math.exp(-e.deltaY / 300), e.clientX - r.left, e.clientY - r.top); }, { passive: false });
    window.addEventListener('keydown', onKey, true); document.documentElement.classList.add('fv-lock');
    document.body.append(ov); ov.querySelector('.fv-x').focus();
  }

  const n = cur.files.length, miss = cur.missing || [];
  return el('section', { class: 'th-files', 'aria-labelledby': 'th-files-t' },
    el('h2', { id: 'th-files-t' }, 'Материалы урока'),
    el('p', { class: 'muted' }, n ? `${n} ${plural(n, 'файл', 'файла', 'файлов')}: откройте прямо здесь или скачайте.` : 'Файлы этого урока лежат в кабинете школы.'),
    n ? el('ul', { class: 'fc-list' }, cur.files.map(card)) : null,
    miss.length ? el('p', { class: 'fc-missing muted' }, `Ещё ${miss.length} ${plural(miss.length, 'материал', 'материала', 'материалов')} в кабинете школы, в уроке «${lesson}»: `, miss.map(m => m.title).join(', '), '.') : null,
    el('a', { class: 'btn btn-ghost th-school', href: school, target: '_blank', rel: 'noopener' }, 'Открыть кабинет школы', ico('ext')));
}
