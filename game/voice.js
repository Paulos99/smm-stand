// Voice messages for «Допрос клиента», Telegram-style: hold the mic to talk, slide left to cancel, slide up to lock,
// listen before sending, 60 s hard limit. The recording is uploaded as 16 kHz μ-law, recognised on the server and dropped.
export const VOICE_RATE = 16000, VOICE_MAX_S = 60;
const BARS = 36, WARN_S = 50;
const RM = matchMedia('(prefers-reduced-motion: reduce)');
const el = (tag, attrs = {}, ...kids) => {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) { if (v == null || v === false) continue; if (k.startsWith('on')) n.addEventListener(k.slice(2), v); else n.setAttribute(k, v === true ? '' : v); }
  for (const c of kids.flat()) if (c != null && c !== false) n.append(c.nodeType ? c : document.createTextNode(c));
  return n;
};
const ico = (id) => { const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); s.setAttribute('class', 'ic'); s.setAttribute('aria-hidden', 'true'); s.innerHTML = `<use href="#i-${id}"/>`; return s; };
export const fmt = (s) => { s = Math.max(0, Math.round(s || 0)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
export const canRecord = () => !!(window.isSecureContext && navigator.mediaDevices?.getUserMedia && window.MediaRecorder && (window.AudioContext || window.webkitAudioContext));

// ---------- decoding helpers ----------
let ctx;
const actx = () => (ctx ||= new (window.AudioContext || window.webkitAudioContext)());
export async function decode(blob) { const ab = await blob.arrayBuffer(); return await new Promise((ok, no) => { const p = actx().decodeAudioData(ab, ok, no); p?.catch?.(no); }); }
export function peaksOf(buf, n = BARS) {
  const d = buf.getChannelData(0), step = Math.max(1, Math.floor(d.length / n)), out = [];
  for (let i = 0; i < n; i++) { let m = 0; for (let k = i * step, e = Math.min(d.length, k + step); k < e; k += 8) { const v = Math.abs(d[k]); if (v > m) m = v; } out.push(m); }
  const top = Math.max(...out, 0.01); return out.map((v) => Math.max(0.08, Math.min(1, Math.sqrt(v / top))));
}
export const b64Blob = (b64, type = 'audio/mpeg') => { const s = atob(b64), u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return new Blob([u], { type }); };
// resample to 16 kHz mono and encode G.711 μ-law (1 byte per sample): a minute is ~960 KB
export async function toUlaw(buf) {
  const len = Math.max(1, Math.ceil(buf.duration * VOICE_RATE));
  const off = new OfflineAudioContext(1, len, VOICE_RATE); const src = off.createBufferSource(); src.buffer = buf; src.connect(off.destination); src.start();
  const d = (await off.startRendering()).getChannelData(0), out = new Uint8Array(d.length);
  for (let i = 0; i < d.length; i++) {
    let x = Math.max(-1, Math.min(1, d[i])) * 32635 | 0; const sign = x < 0 ? 0x80 : 0; if (sign) x = -x; x += 0x84;
    let e = 7; for (let m = 0x4000; (x & m) === 0 && e > 0; m >>= 1) e--;
    out[i] = ~(sign | (e << 4) | ((x >> (e + 3)) & 0x0f)) & 0xff;
  }
  return out;
}

// ---------- shared player (one <audio>, so only one message plays at a time) ----------
const player = new Audio(); player.preload = 'auto';
let current = null; // the bubble api that owns the player
const SILENT = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YQAAAAA=';
export function unlockAudio() { if (player.dataset.unlocked) return; player.dataset.unlocked = '1'; try { player.src = SILENT; player.play().catch(() => {}); } catch {} try { actx().resume?.(); } catch {} }
const recorders = new Set();
export function releaseAll() { recorders.forEach((r) => r.cancel(false)); stopAll(); }
export function stopAll() { try { player.pause(); } catch {} current?.paint(false); current = null; }
player.addEventListener('timeupdate', () => current?.progress());
player.addEventListener('ended', () => { const c = current; current = null; c?.paint(false); c?.progress(0); c?.ended?.(); });
player.addEventListener('pause', () => current?.paint(false));
player.addEventListener('play', () => current?.paint(true));
const SPEEDS = [1, 1.5, 2];
let speed = +localStorage.getItem('voice-speed') || 1;

// a voice message bubble: play/pause, waveform with seek, duration, speed, transcript
export function voiceBubble(dir, { blob, peaks, dur = 0, text = '', name = '', open = false, onEnded } = {}) {
  const url = blob ? URL.createObjectURL(blob) : '';
  const playB = el('button', { class: 'vb-play', type: 'button', 'aria-label': 'Слушать' }, ico('play'));
  const wave = el('div', { class: 'vb-wave', role: 'slider', tabindex: '0', 'aria-label': 'Перемотка', 'aria-valuemin': '0', 'aria-valuemax': String(Math.round(dur)), 'aria-valuenow': '0' });
  const bars = (peaks || Array(BARS).fill(0.3)).map((v) => { const b = el('i'); b.style.setProperty('--h', v.toFixed(3)); return b; });
  wave.append(...bars);
  const time = el('span', { class: 'vb-time tn' }, fmt(dur));
  const spB = el('button', { class: 'vb-speed', type: 'button', 'aria-label': 'Скорость' }, `${speed}×`);
  const trB = el('button', { class: 'vb-tr', type: 'button', 'aria-expanded': 'false', 'aria-label': 'Расшифровка' }, 'Aa');
  const tr = el('div', { class: 'vb-text' });
  const trWrap = el('div', { class: 'vb-text-wrap' }, tr);
  const root = el('div', { class: `bub bub-${dir} vb`, 'aria-label': `${dir === 'in' ? 'Голосовое ' + name : 'Ваше голосовое'}, ${fmt(dur)}` },
    el('div', { class: 'vb-row' }, playB, el('div', { class: 'vb-mid' }, wave, el('div', { class: 'vb-meta' }, time, spB)), trB), trWrap);
  const api = {
    root,
    paint(on) { root.classList.toggle('playing', on); playB.replaceChildren(ico(on ? 'pause' : 'play')); playB.setAttribute('aria-label', on ? 'Пауза' : 'Слушать'); },
    progress(f) { const d = player.duration || dur || 1; const p = f ?? (current === api ? player.currentTime / d : 0); const k = Math.round(p * bars.length);
      bars.forEach((b, i) => b.classList.toggle('on', i < k)); time.textContent = current === api && p > 0 ? fmt(player.currentTime) : fmt(dur); wave.setAttribute('aria-valuenow', String(Math.round(p * dur))); },
    ended: () => onEnded?.(),
    async play(from) { if (!url) return; if (current !== api) { stopAll(); current = api; player.src = url; } if (from != null) { try { player.currentTime = from; } catch {} }
      player.playbackRate = speed; try { await player.play(); } catch { api.paint(false); return false; } return true; },
    pause() { if (current === api) player.pause(); },
    toggle() { if (current === api && !player.paused) api.pause(); else api.play(); },
    setText(t, pending) { tr.replaceChildren(pending ? el('span', { class: 'vb-pend' }, el('span', { class: 'spin' }), t) : t); root.classList.toggle('has-text', !!t); },
    openText(o) { root.classList.toggle('text-open', o); trB.setAttribute('aria-expanded', String(o)); },
    setDur(d) { dur = d; time.textContent = fmt(d); wave.setAttribute('aria-valuemax', String(Math.round(d))); },
    fail(msg) { root.classList.add('failed'); api.setText(msg); api.openText(true); },
    destroy() { if (current === api) stopAll(); if (url) URL.revokeObjectURL(url); },
  };
  playB.onclick = () => api.toggle();
  spB.onclick = () => { speed = SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length]; localStorage.setItem('voice-speed', String(speed)); document.querySelectorAll('.vb-speed').forEach((b) => (b.textContent = `${speed}×`)); if (current) player.playbackRate = speed; };
  trB.onclick = () => api.openText(!root.classList.contains('text-open'));
  const seek = (e) => { const r = wave.getBoundingClientRect(); const f = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)); const d = player.duration && current === api ? player.duration : dur; api.play(f * d); };
  wave.addEventListener('pointerdown', (e) => { seek(e); wave.setPointerCapture?.(e.pointerId); const mv = (ev) => { if (current === api && player.duration) { const r = wave.getBoundingClientRect(); player.currentTime = Math.max(0, Math.min(1, (ev.clientX - r.left) / r.width)) * player.duration; } }; wave.addEventListener('pointermove', mv); wave.addEventListener('pointerup', () => wave.removeEventListener('pointermove', mv), { once: true }); });
  wave.addEventListener('keydown', (e) => { if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return; e.preventDefault(); if (current !== api) return api.play(); player.currentTime = Math.max(0, player.currentTime + (e.key === 'ArrowLeft' ? -5 : 5)); });
  if (text) api.setText(text); api.openText(open);
  return api;
}

// ---------- microphone ----------
async function openMic() {
  try { return await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 } }); }
  catch (e) {
    const m = e?.name === 'NotAllowedError' || e?.name === 'SecurityError' ? 'Нет доступа к микрофону. Разрешите его для сайта в настройках браузера или пишите текстом.'
      : e?.name === 'NotFoundError' ? 'Микрофон не найден. Подключите его или пишите текстом.' : 'Микрофон сейчас недоступен. Пишите текстом.';
    throw new Error(m);
  }
}
const pickType = () => ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm', 'audio/ogg;codecs=opus'].find((t) => MediaRecorder.isTypeSupported?.(t)) || '';

/* Recorder bound to the mic button. Mechanics:
   - press and hold: records while held; release sends; slide left past the line cancels; slide up locks (hands-free)
   - tap (or Enter/Space): locked recording right away
   - locked: trash · timer · stop (listen first) · send; preview: trash · player · send
   - 60 s: countdown from 50 s, then recording stops by itself and waits in preview */
export function attachRecorder(micB, { host, onSend, onError, onState, tick }) {
  let st = 'idle', stream = null, mr = null, chunks = [], t0 = 0, raf = 0, an = null, src = null, levels = [], startX = 0, startY = 0, held = false, pressAt = 0, preview = null, stopT = 0;
  const dot = el('span', { class: 'rec-dot', 'aria-hidden': 'true' });
  const timer = el('span', { class: 'rec-time tn', role: 'timer', 'aria-live': 'off' }, '0:00');
  const live = el('div', { class: 'rec-live', 'aria-hidden': 'true' }, ...Array.from({ length: 40 }, () => el('i')));
  const slide = el('span', { class: 'rec-slide' }, el('span', { class: 'rec-chev', 'aria-hidden': 'true' }, '‹'), 'Влево — отмена');
  const trashB = el('button', { class: 'icon-btn rec-trash', type: 'button', 'aria-label': 'Удалить запись' }, ico('trash'));
  const stopB = el('button', { class: 'icon-btn rec-stop', type: 'button', 'aria-label': 'Остановить и прослушать' }, ico('stop'));
  const sendB = el('button', { class: 'icon-btn send rec-send', type: 'button', 'aria-label': 'Отправить голосовое' }, ico('up'));
  const slot = el('div', { class: 'rec-slot' });
  const bar = el('div', { class: 'rec', role: 'group', 'aria-label': 'Запись голосового', hidden: true }, trashB, dot, timer, live, slide, slot, stopB, sendB);
  const lockPill = el('div', { class: 'rec-lock', 'aria-hidden': 'true' }, ico('lock'), el('span', { class: 'rec-lock-a' }, ico('up')));
  const sr = el('span', { class: 'sr-only', 'aria-live': 'assertive' });
  host.append(bar, lockPill, sr);
  const say = (t) => { sr.textContent = t; };
  const set = (s) => { st = s; bar.hidden = s === 'idle'; bar.dataset.st = s; lockPill.classList.toggle('show', s === 'hold'); micB.classList.toggle('rec-on', s === 'hold'); onState?.(s); };

  async function start(viaTap) {
    if (st !== 'idle') return;
    st = 'opening';
    const pre = await navigator.permissions?.query({ name: 'microphone' }).then((r) => r.state).catch(() => '') || '';
    const asked = performance.now();
    try { stream = await openMic(); } catch (e) { st = 'idle'; onError?.(e.message); return; }
    if (!viaTap && !held && (pre === 'granted' || (!pre && performance.now() - asked < 700))) viaTap = true; // a quick tap: hands-free recording
    if (!viaTap && !held) { // the permission prompt ate the press: next press records
      stream.getTracks().forEach((t) => t.stop()); stream = null; st = 'idle'; say('Микрофон разрешён. Удерживайте кнопку и говорите'); onError?.('Микрофон включён. Удерживайте кнопку и говорите.', true); return;
    }
    const type = pickType(); chunks = []; levels = [];
    try { mr = new MediaRecorder(stream, type ? { mimeType: type, audioBitsPerSecond: 32000 } : undefined); } catch { mr = new MediaRecorder(stream); }
    mr.ondataavailable = (e) => { if (e.data?.size) chunks.push(e.data); };
    mr.start(250);
    try { const c = actx(); c.resume?.(); src = c.createMediaStreamSource(stream); an = c.createAnalyser(); an.fftSize = 512; src.connect(an); } catch { an = null; }
    t0 = performance.now(); set(viaTap ? 'lock' : 'hold'); tick?.('start'); say('Идёт запись');
    try { navigator.vibrate?.(12); } catch {}
    loop();
  }
  function loop() {
    const s = (performance.now() - t0) / 1000;
    timer.textContent = s >= WARN_S ? `−${fmt(VOICE_MAX_S - s)}` : fmt(s); bar.classList.toggle('warn', s >= WARN_S);
    if (an) { const d = new Uint8Array(an.fftSize); an.getByteTimeDomainData(d); let sum = 0; for (const v of d) sum += (v - 128) ** 2; const lv = Math.min(1, Math.sqrt(sum / d.length) / 40); levels.push(lv);
      const shown = live.children; const tail = levels.slice(-shown.length); for (let i = 0; i < shown.length; i++) shown[i].style.transform = `scaleY(${(0.12 + 0.88 * (tail[i - (shown.length - tail.length)] ?? 0)).toFixed(3)})`;
      dot.style.transform = `scale(${(1 + lv * 0.5).toFixed(3)})`; }
    if (s >= VOICE_MAX_S) { say('Минута вышла, запись остановлена'); toPreview(); return; }
    raf = requestAnimationFrame(loop);
  }
  function release() { cancelAnimationFrame(raf); try { src?.disconnect(); } catch {} src = an = null; stream?.getTracks().forEach((t) => t.stop()); stream = null; }
  const collect = () => new Promise((ok) => { if (!mr || mr.state === 'inactive') return ok(); mr.onstop = () => ok(); try { mr.requestData?.(); mr.stop(); } catch { ok(); } });
  async function finish() { const dur = Math.min(VOICE_MAX_S, (performance.now() - t0) / 1000); await collect(); release(); const blob = new Blob(chunks, { type: mr?.mimeType || 'audio/webm' }); mr = null; return { blob, dur }; }
  async function cancel(sound = true) {
    if (st === 'idle') return; const was = st; set('idle'); preview?.destroy(); preview = null; slot.replaceChildren();
    if (was !== 'preview') { await collect(); release(); mr = null; }
    chunks = []; bar.classList.remove('warn'); if (sound) { tick?.('cancel'); say('Запись удалена'); }
  }
  async function send() {
    if (st === 'idle' || st === 'sending') return;
    let rec;
    if (st === 'preview') rec = preview.rec; else rec = await finish();
    preview?.destroy?.(); preview = null; slot.replaceChildren(); set('idle'); bar.classList.remove('warn');
    if (rec.dur < 0.6 || !rec.blob.size) { onError?.('Слишком короткое голосовое. Удерживайте кнопку, пока говорите.'); return; }
    tick?.('send'); onSend?.(rec);
  }
  async function toPreview() {
    if (st !== 'hold' && st !== 'lock') return; set('stopping');
    const rec = await finish(); let peaks, dur = rec.dur;
    try { const buf = await decode(rec.blob); peaks = peaksOf(buf, 28); dur = buf.duration || dur; rec.buf = buf; } catch {}
    rec.dur = dur; preview = voiceBubble('out', { blob: rec.blob, peaks, dur }); preview.rec = rec; preview.root.classList.add('vb-mini');
    slot.replaceChildren(preview.root); set('preview'); say('Запись остановлена. Можно прослушать или отправить');
  }
  // pointer mechanics on the mic button
  micB.addEventListener('pointerdown', (e) => {
    if (e.button > 0 || st !== 'idle') return; e.preventDefault(); unlockAudio();
    held = true; pressAt = performance.now(); startX = e.clientX; startY = e.clientY; micB.setPointerCapture?.(e.pointerId); start(false);
  });
  micB.addEventListener('pointermove', (e) => {
    if (!held || st !== 'hold') return; const dx = e.clientX - startX, dy = e.clientY - startY;
    slide.style.transform = `translateX(${Math.min(0, dx * 0.6)}px)`; slide.style.opacity = String(Math.max(0.25, 1 + dx / 160));
    lockPill.style.transform = `translateY(${Math.min(0, dy * 0.5)}px)`;
    if (dx < -110) { held = false; slide.style.transform = slide.style.opacity = ''; lockPill.style.transform = ''; cancel(); }
    else if (dy < -80) { held = false; slide.style.transform = slide.style.opacity = ''; lockPill.style.transform = ''; set('lock'); tick?.('lock'); say('Запись закреплена, можно отпустить'); }
  });
  const up = () => {
    if (!held) return; held = false; slide.style.transform = slide.style.opacity = ''; lockPill.style.transform = '';
    if (st === 'opening') return; // released while the mic was opening
    if (st !== 'hold') return;
    if (performance.now() - pressAt < 350) { set('lock'); say('Запись идёт. Нажмите «Отправить», когда закончите'); return; } // a tap: hands-free
    send();
  };
  micB.addEventListener('pointerup', up); micB.addEventListener('pointercancel', () => { if (held && st === 'hold') { held = false; set('lock'); } });
  micB.addEventListener('keydown', (e) => { if ((e.key === 'Enter' || e.key === ' ') && st === 'idle') { e.preventDefault(); unlockAudio(); start(true); } });
  micB.addEventListener('contextmenu', (e) => e.preventDefault());
  trashB.onclick = () => cancel(); stopB.onclick = () => toPreview(); sendB.onclick = () => send();
  const api = { cancel, get state() { return st; } }; recorders.add(api); return api;
}
