export const $ = (s, r = document) => r.querySelector(s);
export function h(tag, attrs = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'html') el.innerHTML = v;
    else if (k === 'class') el.className = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const k of kids.flat()) if (k != null && k !== false) el.append(k instanceof Node ? k : document.createTextNode(String(k)));
  return el;
}
export const sticker = name => `./assets/stickers/${name}.webp`;
let tt;
export function toast(text, img) {
  document.querySelector('.toast')?.remove(); clearTimeout(tt);
  const t = h('div', { class: 'toast', role: 'status' }, img ? h('img', { src: sticker(img), alt: '' }) : null, h('span', {}, text));
  document.body.append(t); tt = setTimeout(() => t.remove(), 3800);
}
export const plural = (n, a, b, c) => { const m = n % 10, mm = n % 100; return m === 1 && mm !== 11 ? a : m >= 2 && m <= 4 && (mm < 10 || mm >= 20) ? b : c; };
export const shuffle = a => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
