import { h, shuffle } from '../ui.js';
import { nextBtn, progress, finale } from './_quiz.js';
// Two options side by side, pick the stronger one. B: 10 s per round.
export default function (stage, ctx) {
  const SEC = ctx.params.seconds || 0; let rounds, i, score, timer;
  const start = () => { rounds = shuffle(ctx.content.battles); i = 0; score = 0; round(); };
  const round = () => {
    clearInterval(timer); const r = rounds[i]; ctx.step('r' + (i + 1));
    let done = false, left = SEC; const ex = h('div');
    const tm = SEC ? h('span', { class: 'timer' }, `⏱ ${left} с`) : h('span');
    const choose = k => {
      if (done) return; done = true; clearInterval(timer);
      const ok = k === r.better; if (ok) score++;
      cards.forEach(c => { c.disabled = true; c.classList.add(c.dataset.k === r.better ? 'right' : 'wrong'); });
      ex.replaceChildren(h('div', { class: 'explain' }, h('b', {}, k == null ? 'Время вышло. ' : ok ? 'В точку! ' : 'Другой вариант сильнее. '), r.why),
        nextBtn(i + 1 < rounds.length ? 'Следующий батл →' : 'Итоги', () => (i + 1 < rounds.length ? (i++, round()) : end())));
    };
    const cards = ['a', 'b'].map((k, j) => h('button', { class: 'post opt', type: 'button', 'data-k': k, onclick: () => choose(k) }, h('small', {}, j ? 'ВАРИАНТ 2' : 'ВАРИАНТ 1'), r[k]));
    stage.replaceChildren(progress(i, rounds.length), h('div', { class: 'row', style: 'justify-content:space-between' }, h('span', { class: 'score' }, `${r.topic} · ${score} очк.`), tm),
      h('h3', { style: 'font:700 17px/1.35 var(--heading);margin:8px 0 10px' }, r.q), h('div', { class: 'vs' }, cards), ex);
    if (SEC) timer = setInterval(() => { left--; tm.textContent = `⏱ ${left} с`; if (left <= 0) choose(null); }, 1000);
  };
  const end = async () => {
    const pts = score * 4 + (SEC ? 4 : 0);
    await ctx.award(pts, { complete: true, sticker: ['first', ...(score >= rounds.length - 2 ? ['battle'] : [])] });
    finale(stage, { img: 'target', title: `${score} из ${rounds.length} батлов`, text: `+${pts} баллов. ${score >= rounds.length - 2 ? 'Зоркий глаз, стикер ваш!' : 'Наберите 6 из 8, чтобы получить стикер «Зоркий глаз».'}`, again: start });
  };
  stage.replaceChildren(h('div', { class: 'result' }, h('img', { src: './assets/stickers/target.webp', alt: '' }), h('h3', {}, 'Батл кейсов'),
    h('p', { class: 'muted' }, `8 раундов. В каждом два варианта поста, рекламы или ответа. Выберите сильнее.${SEC ? ` На раунд ${SEC} секунд!` : ' Думайте сколько нужно.'}`),
    h('div', { style: 'margin-top:14px' }, nextBtn('В бой!', start))));
  return () => clearInterval(timer);
}
