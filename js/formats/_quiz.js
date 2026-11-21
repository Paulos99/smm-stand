// Shared: render one multiple-choice question. Resolves with true/false after the answer.
import { h } from '../ui.js';
export function ask(box, { q, o, a, why }, { title, seconds = 0, onTick } = {}) {
  return new Promise(resolve => {
    let done = false, timer = null, left = seconds;
    const tm = seconds ? h('span', { class: 'timer', 'aria-live': 'polite' }, `⏱ ${left} с`) : null;
    const ex = h('div');
    const finish = (idx) => {
      if (done) return; done = true; clearInterval(timer);
      btns.forEach((b, i) => { b.disabled = true; if (i === a) b.classList.add('right'); else if (i === idx) b.classList.add('wrong'); });
      const ok = idx === a;
      ex.replaceChildren(h('div', { class: 'explain' }, h('b', {}, idx === -1 ? 'Время вышло. ' : ok ? 'Верно! ' : 'Не совсем. '), why || ''));
      resolve(ok);
    };
    const btns = o.map((t, i) => h('button', { class: 'opt', type: 'button', onclick: () => finish(i) }, t));
    box.replaceChildren(h('div', { class: 'row', style: 'justify-content:space-between' }, title ? h('span', { class: 'score' }, title) : h('span'), tm), h('h3', { style: 'font:700 17px/1.35 var(--heading);margin:8px 0' }, q), ...btns, ex);
    if (seconds) timer = setInterval(() => { left--; tm.textContent = `⏱ ${left} с`; onTick?.(left); if (left <= 0) finish(-1); }, 1000);
  });
}
export const nextBtn = (text, onclick, cls = 'btn primary') => h('button', { class: cls, type: 'button', onclick }, text);
export function progress(i, n) { return h('div', { class: 'progress', role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': n, 'aria-valuenow': i }, h('span', { style: `width:${Math.round(i / n * 100)}%` })); }
export function finale(stage, { img, title, text, again }) {
  stage.replaceChildren(h('div', { class: 'result' }, h('img', { src: `./assets/stickers/${img}.webp`, alt: '' }), h('h3', {}, title), h('p', { class: 'muted' }, text), again ? h('div', { style: 'margin-top:14px' }, nextBtn('Пройти ещё раз', again, 'btn')) : null));
}
