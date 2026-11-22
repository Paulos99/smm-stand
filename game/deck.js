// Lesson presentation viewer: swipe on phones, arrows and keys on PC, counter, thumbnails, fullscreen, pinch / double-tap zoom.
// Slides are paid school content: each image is fetched from the API with the player's token and shown from a blob URL.
import { apiBlob } from '../js/api.js?v=20261122g';
import { sfx } from './play.js?v=20261122g';

const el = (tag, attrs = {}, ...kids) => {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) { if (v == null || v === false) continue; if (k.startsWith('on')) n.addEventListener(k.slice(2), v); else n.setAttribute(k, v === true ? '' : v); }
  for (const c of kids.flat()) if (c != null && c !== false) n.append(c.nodeType ? c : document.createTextNode(c));
  return n;
};
const ico = (id, cls = '') => { const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); s.setAttribute('class', 'ic ' + cls); s.setAttribute('aria-hidden', 'true'); s.innerHTML = `<use href="#i-${id}"/>`; return s; };
const RM = matchMedia('(prefers-reduced-motion: reduce)');
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export function deckPlaceholder() {
  return el('section', { class: 'th-deck th-deck-empty', 'aria-label': 'Презентация скоро появится' },
    el('div', { class: 'th-v-in' }, el('span', { class: 'th-v-play', 'aria-hidden': 'true' }, ico('slides')), el('b', {}, 'Презентация скоро появится'), el('span', {}, 'Пока читайте лекцию ниже.')),
    el('span', { class: 'th-v-tag' }, ico('slides'), 'Презентация'));
}

export function createDeck({ op, n, w = 16, h = 9, toast }) {
  if (!n) return { node: deckPlaceholder(), destroy() {} };
  let i = 0, alive = true, fs = false, zoom = 1, panX = 0, panY = 0;
  const urls = new Map(), pending = new Map();
  const slides = Array.from({ length: n }, (_, k) => el('figure', { class: 'deck-slide', role: 'group', 'aria-roledescription': 'слайд', 'aria-label': `Слайд ${k + 1} из ${n}` }, el('span', { class: 'deck-load', 'aria-hidden': 'true' })));
  const track = el('div', { class: 'deck-track' }, slides);
  const count = el('span', { class: 'deck-count tn', 'aria-live': 'polite' }, `1 / ${n}`);
  const prev = el('button', { class: 'deck-nav deck-prev', type: 'button', 'aria-label': 'Предыдущий слайд', onclick: () => go(i - 1) }, ico('chev'));
  const next = el('button', { class: 'deck-nav deck-next', type: 'button', 'aria-label': 'Следующий слайд', onclick: () => go(i + 1) }, ico('chev'));
  const fsBtn = el('button', { class: 'deck-fs-btn', type: 'button', 'aria-label': 'Во весь экран', 'aria-pressed': 'false', onclick: () => toggleFs() }, ico('expand'), el('span', {}, 'Во весь экран'));
  const stage = el('div', { class: 'deck-stage', tabindex: '0', role: 'region', 'aria-roledescription': 'карусель', 'aria-label': 'Слайды презентации. Стрелки влево и вправо листают', style: `--ar:${w}/${h}` }, track, prev, next);
  const bar = el('i'); const prog = el('div', { class: 'deck-prog', 'aria-hidden': 'true' }, bar);
  const thumbs = el('div', { class: 'deck-thumbs', role: 'tablist', 'aria-label': 'Миниатюры слайдов' },
    Array.from({ length: n }, (_, k) => el('button', { class: 'deck-th', type: 'button', role: 'tab', 'aria-label': `Слайд ${k + 1}`, 'data-k': k, onclick: () => go(k) }, el('span', { class: 'tn' }, k + 1))));
  const node = el('section', { class: 'th-deck', 'aria-label': 'Презентация урока' },
    el('div', { class: 'deck-head' }, el('span', { class: 'deck-title' }, ico('slides'), 'Презентация урока'), count, fsBtn), stage, prog, thumbs);

  // lazy loading: the current slide first, then neighbours; thumbnails when the strip scrolls into view
  async function blob(k, thumb) {
    const key = (thumb ? 't' : 'f') + k; if (urls.has(key)) return urls.get(key); if (pending.has(key)) return pending.get(key);
    const p = apiBlob(`/api/game/slide/${op}/${k + 1}${thumb ? 't' : ''}`).then(b => { const u = URL.createObjectURL(b); if (!alive) { URL.revokeObjectURL(u); return ''; } urls.set(key, u); return u; }).finally(() => pending.delete(key));
    pending.set(key, p); return p;
  }
  async function show(k) {
    if (k < 0 || k >= n || slides[k].querySelector('img')) return;
    try {
      const u = await blob(k); if (!u || slides[k].querySelector('img')) return;
      const img = el('img', { src: u, alt: `Слайд ${k + 1}`, draggable: 'false', width: w, height: h, decoding: 'async' });
      img.onload = () => slides[k].classList.add('ready'); slides[k].replaceChildren(img);
    } catch (e) { slides[k].classList.add('fail'); if (k === i) toast?.(e.message || 'Слайд не загрузился'); }
  }
  const io = 'IntersectionObserver' in window ? new IntersectionObserver(es => es.forEach(e => {
    if (!e.isIntersecting) return; const b = e.target; io.unobserve(b); const k = +b.dataset.k;
    blob(k, true).then(u => { if (u) { b.style.backgroundImage = `url("${u}")`; b.classList.add('ready'); } }).catch(() => {});
  }), { root: thumbs, rootMargin: '0px 200px' }) : null;
  [...thumbs.children].forEach(b => io ? io.observe(b) : null);

  function render(anim = true) {
    track.style.transition = anim && !RM.matches ? '' : 'none';
    track.style.transform = `translate3d(${-i * 100}%,0,0)`;
    count.textContent = `${i + 1} / ${n}`; bar.style.setProperty('--p', (i + 1) / n);
    prev.disabled = i === 0; next.disabled = i === n - 1;
    [...thumbs.children].forEach((b, k) => { const on = k === i; b.classList.toggle('on', on); b.setAttribute('aria-selected', String(on)); });
    const cur = thumbs.children[i]; if (cur) { const l = cur.offsetLeft - thumbs.clientWidth / 2 + cur.clientWidth / 2; thumbs.scrollTo({ left: l, behavior: anim && !RM.matches ? 'smooth' : 'auto' }); }
    [i, i + 1, i - 1, i + 2].forEach(show);
  }
  function go(k, silent) {
    k = clamp(k, 0, n - 1); if (k === i) { render(); return; }
    resetZoom(); i = k; render(); if (!silent) sfx.page();
  }

  // swipe, pinch and double-tap
  const pts = new Map(); let start = null, pinch = null, moved = false, lastTap = 0;
  const curImg = () => slides[i].querySelector('img');
  function applyZoom() { const im = curImg(); if (im) im.style.transform = zoom > 1 ? `translate3d(${panX}px,${panY}px,0) scale(${zoom})` : ''; stage.classList.toggle('zoomed', zoom > 1); }
  function resetZoom() { zoom = 1; panX = panY = 0; slides.forEach(s => { const im = s.querySelector('img'); if (im) im.style.transform = ''; }); stage.classList.remove('zoomed'); }
  stage.addEventListener('pointerdown', e => {
    if (e.target.closest('.deck-nav')) return;
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY }); stage.setPointerCapture?.(e.pointerId);
    if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), z: zoom }; start = null; return; }
    start = { x: e.clientX, y: e.clientY, t: performance.now(), px: panX, py: panY }; moved = false; track.style.transition = 'none';
  });
  stage.addEventListener('pointermove', e => {
    if (!pts.has(e.pointerId)) return; pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch && pts.size === 2) { const [a, b] = [...pts.values()]; zoom = clamp(pinch.z * Math.hypot(a.x - b.x, a.y - b.y) / pinch.d, 1, 4); if (zoom === 1) panX = panY = 0; applyZoom(); return; }
    if (!start) return; const dx = e.clientX - start.x, dy = e.clientY - start.y; if (Math.abs(dx) > 6 || Math.abs(dy) > 6) moved = true;
    if (zoom > 1) { const im = curImg(), r = stage.getBoundingClientRect(), mx = r.width * (zoom - 1) / 2, my = r.height * (zoom - 1) / 2; panX = clamp(start.px + dx, -mx, mx); panY = clamp(start.py + dy, -my, my); applyZoom(); return; }
    if (Math.abs(dx) > Math.abs(dy)) { const edge = (i === 0 && dx > 0) || (i === n - 1 && dx < 0) ? 0.35 : 1; track.style.transform = `translate3d(calc(${-i * 100}% + ${dx * edge}px),0,0)`; }
  });
  const end = e => {
    if (!pts.has(e.pointerId)) return; pts.delete(e.pointerId);
    if (pinch) { if (pts.size < 2) pinch = null; if (zoom < 1.05) resetZoom(); return; }
    if (!start) return; const dx = e.clientX - start.x, dt = performance.now() - start.t, s0 = start; start = null;
    if (zoom > 1) { if (!moved) tap(e); return; }
    const W = stage.clientWidth, fast = Math.abs(dx) / Math.max(dt, 1) > 0.45;
    if (moved && (Math.abs(dx) > W * 0.18 || (fast && Math.abs(dx) > 24))) go(i + (dx < 0 ? 1 : -1)); else { render(); if (!moved) tap(e, s0); }
  };
  function tap(e) { // double tap: zoom 2x on the spot or back
    const now = performance.now(); if (now - lastTap > 300) { lastTap = now; return; } lastTap = 0;
    if (zoom > 1) { resetZoom(); return; }
    const r = stage.getBoundingClientRect(); zoom = 2; panX = clamp((r.width / 2 - (e.clientX - r.left)), -r.width / 2, r.width / 2); panY = clamp((r.height / 2 - (e.clientY - r.top)), -r.height / 2, r.height / 2); applyZoom();
  }
  stage.addEventListener('pointerup', end); stage.addEventListener('pointercancel', end);
  stage.addEventListener('wheel', e => { if (!fs || !e.ctrlKey) return; e.preventDefault(); zoom = clamp(zoom * (e.deltaY < 0 ? 1.1 : 0.9), 1, 4); if (zoom === 1) panX = panY = 0; applyZoom(); }, { passive: false });

  // keys: work when the deck has focus or is fullscreen
  function onKey(e) {
    if (!fs && !node.contains(document.activeElement)) return;
    const k = e.key;
    if (k === 'ArrowRight' || k === 'PageDown' || (k === ' ' && fs)) { e.preventDefault(); go(i + 1); }
    else if (k === 'ArrowLeft' || k === 'PageUp') { e.preventDefault(); go(i - 1); }
    else if (k === 'Home') { e.preventDefault(); go(0); } else if (k === 'End') { e.preventDefault(); go(n - 1); }
    else if (k === 'Escape' && fs) { e.preventDefault(); e.stopImmediatePropagation(); toggleFs(false); }
    else if ((k === 'f' || k === 'F') && !e.ctrlKey && !e.metaKey) { e.preventDefault(); toggleFs(); }
  }
  window.addEventListener('keydown', onKey, true);

  // fullscreen: real Fullscreen API where it exists, otherwise a fixed overlay (iPhone Safari)
  async function toggleFs(on = !fs) {
    if (on === fs) return; fs = on; resetZoom();
    node.classList.toggle('deck-fs', on); document.documentElement.classList.toggle('deck-open', on);
    fsBtn.setAttribute('aria-pressed', String(on)); fsBtn.setAttribute('aria-label', on ? 'Свернуть' : 'Во весь экран'); fsBtn.querySelector('span').textContent = on ? 'Свернуть' : 'Во весь экран';
    fsBtn.querySelector('use').setAttribute('href', on ? '#i-x' : '#i-expand');
    if (on) {
      try { if (node.requestFullscreen && !document.fullscreenElement) await node.requestFullscreen({ navigationUI: 'hide' }); } catch {}
      try { await screen.orientation?.lock?.('landscape'); } catch {}
      stage.focus({ preventScroll: true });
    } else {
      try { screen.orientation?.unlock?.(); } catch {}
      try { if (document.fullscreenElement === node) await document.exitFullscreen(); } catch {}
      node.scrollIntoView({ block: 'nearest' });
    }
    requestAnimationFrame(() => render(false)); sfx.tick();
  }
  const onFsChange = () => { if (fs && document.fullscreenElement !== node && !node.classList.contains('deck-fs-css')) { if (!document.fullscreenElement) toggleFs(false); } };
  document.addEventListener('fullscreenchange', onFsChange);

  render(false);
  return {
    node,
    destroy() {
      alive = false; io?.disconnect(); window.removeEventListener('keydown', onKey, true); document.removeEventListener('fullscreenchange', onFsChange);
      document.documentElement.classList.remove('deck-open'); if (document.fullscreenElement === node) document.exitFullscreen().catch(() => {});
      urls.forEach(u => URL.revokeObjectURL(u)); urls.clear();
    },
  };
}
