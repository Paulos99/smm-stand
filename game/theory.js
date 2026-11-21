// Operation briefing: video (placeholder until a URL is set in the data), lecture reader in the school's mobile style, lesson materials.
// The lecture text is paid school content: it comes from the API for signed-in players only and is never stored in this public repo.
import { chime, sfx, sound, replay } from './play.js?v=20261121r';

const el = (tag, attrs = {}, ...kids) => {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) { if (v == null || v === false) continue; if (k.startsWith('on')) n.addEventListener(k.slice(2), v); else if (k === 'html') n.innerHTML = v; else n.setAttribute(k, v === true ? '' : v); }
  for (const c of kids.flat()) if (c != null && c !== false) n.append(c.nodeType ? c : document.createTextNode(c));
  return n;
};
const ico = (id, cls = '') => { const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); s.setAttribute('class', 'ic ' + cls); s.setAttribute('aria-hidden', 'true'); s.innerHTML = `<use href="#i-${id}"/>`; return s; };
const plural = (n, a, b, c) => { const m = n % 10, h = n % 100; return m === 1 && h !== 11 ? a : m >= 2 && m <= 4 && (h < 12 || h > 14) ? b : c; };

// a real video can be dropped in later: lectures.json → video: { url: 'https://…', poster?: '…' }
function videoBlock(v) {
  if (v?.url) {
    const yt = v.url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/))([\w-]{6,})/), rt = v.url.match(/rutube\.ru\/(?:video|play\/embed)\/([\w]+)/);
    const src = yt ? `https://www.youtube-nocookie.com/embed/${yt[1]}` : rt ? `https://rutube.ru/play/embed/${rt[1]}` : '';
    return el('figure', { class: 'th-video has-video' }, src
      ? el('iframe', { src, title: 'Видеоурок', loading: 'lazy', allow: 'fullscreen; picture-in-picture', allowfullscreen: true })
      : el('video', { src: v.url, controls: true, preload: 'metadata', poster: v.poster || null, playsinline: true }));
  }
  return el('figure', { class: 'th-video', 'aria-label': 'Видеоурок скоро появится' },
    el('div', { class: 'th-v-in' },
      el('span', { class: 'th-v-play', 'aria-hidden': 'true' }, ico('play', 'fill')),
      el('b', {}, 'Видео скоро появится'),
      el('span', {}, 'Пока читайте лекцию ниже: в ней всё, что нужно для шагов.')),
    el('span', { class: 'th-v-tag' }, ico('video'), 'Видеоурок'));
}

export function openBriefing({ op, api, toast, onDone, onClose }) {
  const root = document.getElementById('play');
  let closed = false;
  const bar = el('i'); const prog = el('div', { class: 'pbar pbar-read', role: 'progressbar', 'aria-label': 'Прочитано', 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': 0 }, bar);
  const chap = el('span', { class: 'th-chap tn' }, '');
  const head = el('header', { class: 'play-h' },
    el('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Выйти на карту', onclick: () => close() }, ico('x')),
    el('div', { class: 'play-meta' }, el('span', { class: 'play-k' }, `Операция ${op} · брифинг`, chap), prog),
    el('button', { class: 'icon-btn' + (sound.on ? '' : ' off'), type: 'button', 'aria-label': 'Звук', 'aria-pressed': String(sound.on), onclick: e => { sound.on = !sound.on; e.currentTarget.setAttribute('aria-pressed', String(sound.on)); e.currentTarget.classList.toggle('off', !sound.on); } }, ico('sound')));
  const body = el('main', { class: 'play-b play-theory' }, el('div', { class: 'play-wait' }, el('span', { class: 'spin', 'aria-hidden': 'true' }), 'Загружаем брифинг…'));
  root.replaceChildren(head, body); root.hidden = false; document.body.classList.add('playing'); replay(root, 'opening'); root.scrollTop = 0; root.focus?.(); sfx.page();
  const onKey = e => { if (e.key === 'Escape' && !root.hidden) close(); };
  document.addEventListener('keydown', onKey);
  function close(done) {
    if (closed) return; closed = true; document.removeEventListener('keydown', onKey); root.removeEventListener('scroll', onScroll);
    root.hidden = true; root.replaceChildren(); document.body.classList.remove('playing'); if (!done) onClose?.();
  }
  let secs = [], ticking = false;
  function onScroll() {
    if (ticking) return; ticking = true;
    requestAnimationFrame(() => {
      ticking = false; const reader = body.querySelector('.reader-body'); if (!reader) return;
      const top = reader.getBoundingClientRect().top, h = reader.offsetHeight - innerHeight * 0.6;
      const p = Math.max(0, Math.min(1, -top / Math.max(1, h)));
      bar.style.setProperty('--p', p); prog.setAttribute('aria-valuenow', Math.round(p * 100));
      let cur = 0; secs.forEach((s, i) => { if (s.getBoundingClientRect().top < innerHeight * 0.35) cur = i; });
      chap.textContent = top < innerHeight * 0.3 ? ` · глава ${cur + 1} из ${secs.length}` : '';
    });
  }
  root.addEventListener('scroll', onScroll, { passive: true });

  api('/api/game/lecture?op=' + op).then(L => {
    if (closed) return;
    const large = localStorage.getItem('game-read-large') === '1';
    const toc = el('details', { class: 'reader-toc' },
      el('summary', {}, el('span', {}, 'Содержание'), el('span', { class: 'tn muted' }, `${L.sections.length} ${plural(L.sections.length, 'глава', 'главы', 'глав')}`), ico('chev', 'toc-chev')),
      el('ol', {}, L.sections.map((s, i) => el('li', {}, el('a', { href: '#th-s-' + i, onclick: e => { e.preventDefault(); toc.open = false; sfx.page(); document.getElementById('th-s-' + i)?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' }); } }, s.title)))));
    const sizeBtn = el('button', { class: 'reader-size', type: 'button', 'aria-pressed': String(large), onclick: () => { sfx.tick(); const on = !reader.classList.contains('large-text'); reader.classList.toggle('large-text', on); sizeBtn.setAttribute('aria-pressed', String(on)); localStorage.setItem('game-read-large', on ? '1' : '0'); } }, 'Аа · Крупнее');
    const rbody = el('div', { class: 'reader-body' }, L.sections.map((s, i) => el('section', { id: 'th-s-' + i, class: 'reader-sec' },
      i === 0 && s.title.trim() === L.title.trim() ? null : el('h3', {}, s.title),
      s.blocks.map(b => b.type === 'list' ? el('ul', {}, b.items.map(t => el('li', {}, t))) : el('p', {}, b.text)))));
    const reader = el('article', { class: 'reader' + (large ? ' large-text' : ''), 'aria-label': 'Текст лекции' },
      el('div', { class: 'reader-toolbar' }, el('span', {}, L.source === 'lecture' ? 'Лекция / чтение' : 'Конспект / чтение'), sizeBtn), toc, rbody);
    const files = el('section', { class: 'th-files', 'aria-labelledby': 'th-files-t' },
      el('h2', { id: 'th-files-t' }, 'Материалы урока'),
      el('p', { class: 'muted' }, 'Шаблоны, гайды и презентация лежат в личном кабинете школы, в уроке ', el('b', {}, `«${L.lesson}»`), '.'),
      el('ul', { class: 'th-flist' }, L.files.map(f => el('li', {}, el('a', { class: 'th-file', href: L.school, target: '_blank', rel: 'noopener' },
        el('span', { class: 'th-fmt fmt-' + String(f.format || '').toLowerCase() }, f.format || ico('file')),
        el('span', { class: 'th-fname' }, el('b', {}, f.title), el('span', { class: 'muted tn' }, f.size ? f.size : 'в кабинете')),
        ico('ext', 'th-fgo'))))),
      el('a', { class: 'btn btn-ghost th-school', href: L.school, target: '_blank', rel: 'noopener' }, 'Открыть сайт школы', ico('ext')));
    const doneBtn = el('button', { class: 'cta', type: 'button', onclick: finish },
      el('span', { class: 'cta-main' }, L.done ? 'К шагу 1' : 'Теорию изучил', ico('check')),
      el('span', { class: 'cta-sub' }, L.done ? 'Брифинг уже пройден' : `+${L.xp} опыта · откроется шаг 1`));
    const end = el('section', { class: 'th-end' }, el('p', {}, L.done ? 'Можно перечитать лекцию в любой момент: брифинг всегда на карте первым узлом.' : 'Дочитали? Отметьте брифинг, и штаб откроет первый шаг операции.'), doneBtn);
    body.replaceChildren(
      el('div', { class: 'th-head' },
        el('p', { class: 'th-k' }, ico('book'), `Брифинг · урок ${op}`),
        el('h1', {}, L.title),
        el('p', { class: 'th-meta muted' }, el('span', { class: 'tn' }, `≈ ${L.minutes} мин чтения`), el('span', { class: 'dot', 'aria-hidden': 'true' }), el('span', {}, `${L.files.length} ${plural(L.files.length, 'материал', 'материала', 'материалов')}`), L.done ? null : el('span', { class: 'dot', 'aria-hidden': 'true' }), L.done ? null : el('span', { class: 'tn' }, `+${L.xp} опыта`))),
      videoBlock(L.video), reader, files, end);
    secs = [...rbody.querySelectorAll('.reader-sec')]; onScroll();
    async function finish() {
      doneBtn.disabled = true;
      try {
        const r = L.done ? null : await api('/api/game/briefing', { method: 'POST', body: { op, tz: Intl.DateTimeFormat().resolvedOptions().timeZone } });
        if (r?.gain) chime([523.25, 659.25, 783.99, 1046.5], 0.08, 0.09);
        close(true); onDone?.(r, L.done);
      } catch (e) { doneBtn.disabled = false; toast?.(e.message); }
    }
  }).catch(e => {
    if (closed) return;
    body.replaceChildren(el('div', { class: 'play-wait' }, el('p', {}, e.message || 'Брифинг не загрузился'), el('button', { class: 'cta cta-sm', type: 'button', onclick: () => { close(); openBriefing({ op, api, toast, onDone, onClose }); } }, 'Попробовать ещё раз')));
  });
  return { close };
}
