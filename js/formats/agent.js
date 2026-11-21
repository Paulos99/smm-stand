import { h, shuffle } from '../ui.js';
import { nextBtn, progress, finale } from './_quiz.js';
// A: chat with clients (messenger look). B: cards with a 20 s timer.
export default function (stage, ctx) {
  const cases = ctx.content.agent.cases, max = cases.length * 10;
  const chatMode = ctx.params.mode === 'chat', SEC = ctx.params.seconds || 20;
  let i = 0, score = 0, timer = null;
  const intro = () => stage.replaceChildren(
    h('div', { class: 'result' }, h('img', { src: './assets/stickers/accepted.webp', alt: '' }), h('h3', {}, 'Миссия: СММ-агент'),
      h('p', { class: 'muted' }, ctx.content.agent.intro + (chatMode ? ' Отвечайте клиентам в чате.' : ` На каждую карточку ${SEC} секунд.`)),
      h('div', { style: 'margin-top:14px' }, nextBtn('Принять миссию', () => { i = 0; score = 0; chatMode ? chat() : card(); }))));
  // ---- A: chat ----
  let log;
  const chat = () => {
    log = h('div', { class: 'chat', 'aria-live': 'polite' });
    stage.replaceChildren(h('div', { class: 'row', style: 'justify-content:space-between;margin-bottom:8px' }, h('span', { class: 'score' }, 'Рейтинг агента: 0'), h('span', { class: 'small muted' }, `Клиент 1 из ${cases.length}`)), log, h('div', { id: 'agent-opts' }));
    turn();
  };
  const turn = () => {
    const c = cases[i]; ctx.step('case' + (i + 1));
    stage.querySelector('.small.muted').textContent = `Клиент ${i + 1} из ${cases.length}`;
    log.append(h('div', { class: 'msg sys' }, `${c.avatar} ${c.client}`));
    const typing = h('div', { class: 'msg in typing' }, 'печатает…'); log.append(typing); log.scrollTop = log.scrollHeight;
    setTimeout(() => {
      typing.replaceWith(h('div', { class: 'msg in' }, c.msg)); log.scrollTop = log.scrollHeight;
      const box = stage.querySelector('#agent-opts');
      box.replaceChildren(...shuffle(c.opts).map(o => h('button', { class: 'opt', type: 'button', onclick: () => {
        box.replaceChildren(); score += o.s;
        log.append(h('div', { class: 'msg out' }, o.t), h('div', { class: 'msg in' }, (o.s >= 10 ? '👍 ' : o.s > 0 ? '🤔 ' : '😕 ') + o.f));
        stage.querySelector('.score').textContent = `Рейтинг агента: ${score}`; log.scrollTop = log.scrollHeight;
        box.append(nextBtn(i + 1 < cases.length ? 'Следующий клиент →' : 'Завершить смену', () => { box.replaceChildren(); i + 1 < cases.length ? (i++, turn()) : end() }));
      } }, o.t)));
    }, 700);
  };
  // ---- B: timed cards ----
  const card = () => {
    clearInterval(timer);
    const c = cases[i]; ctx.step('case' + (i + 1));
    let left = SEC, answered = false;
    const tm = h('span', { class: 'timer' }, `⏱ ${left} с`), ex = h('div');
    const pick = o => {
      if (answered) return; answered = true; clearInterval(timer);
      btns.forEach(b => { b.disabled = true; const oo = b._o; if (oo.s >= 10) b.classList.add('right'); else if (oo === o) b.classList.add('wrong'); });
      score += o ? o.s : 0;
      ex.replaceChildren(h('div', { class: 'explain' }, o ? o.f : 'Время вышло, клиент ушёл к конкурентам.'), nextBtn(i + 1 < cases.length ? 'Дальше →' : 'Итоги', () => (i + 1 < cases.length ? (i++, card()) : end())));
    };
    const btns = shuffle(c.opts).map(o => { const b = h('button', { class: 'opt', type: 'button', onclick: () => pick(o) }, o.t); b._o = o; return b; });
    stage.replaceChildren(progress(i, cases.length), h('div', { class: 'row', style: 'justify-content:space-between' }, h('span', { class: 'score' }, `Очки: ${score}`), tm),
      h('div', { class: 'post', style: 'margin:10px 0' }, h('small', {}, `${c.avatar} ${c.client}`), c.msg), ...btns, ex);
    timer = setInterval(() => { left--; tm.textContent = `⏱ ${left} с`; if (left <= 0) pick(null); }, 1000);
  };
  const end = async () => {
    const rank = score >= max * 0.8 ? 'Агент 007' : score >= max * 0.5 ? 'Надёжный агент' : 'Агент-стажёр';
    const pts = Math.round(score / max * 40);
    await ctx.award(pts, { complete: true, sticker: ['first', 'agent'] });
    finale(stage, { img: 'accepted', title: `${rank}: ${score} из ${max}`, text: `+${pts} баллов. Лучшие ответы начинаются с вопроса о цели клиента.`, again: intro });
  };
  intro();
  return () => clearInterval(timer);
}
