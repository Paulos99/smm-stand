import { h } from '../ui.js';
import { nextBtn } from './_quiz.js';
// Brief trainer: the student interviews an AI client (coffee shop), then gets an AI evaluation.
export default function (stage, ctx) {
  const v = ctx.variant; let msgs = [], asked = 0, busy = false;
  const log = h('div', { class: 'chat', 'aria-live': 'polite' });
  const input = h('textarea', { placeholder: 'Ваш вопрос клиенту…', style: 'min-height:70px', maxlength: 600 });
  const send = nextBtn('Отправить', () => ask());
  const evalBtn = nextBtn('Закончить и получить оценку', () => evaluate(), 'btn blue'); evalBtn.disabled = true;
  const left = h('span', { class: 'small muted' });
  const add = (cls, t) => { const m = h('div', { class: 'msg ' + cls }, t); log.append(m); log.scrollTop = log.scrollHeight; return m; };
  async function ask() {
    const t = input.value.trim(); if (!t || busy) return;
    busy = true; send.disabled = true; input.value = '';
    add('out', t); msgs.push({ role: 'user', text: t }); asked++;
    ctx.step(asked >= 5 ? 'q5' : asked >= 3 ? 'q3' : 'q1');
    const typing = add('in typing', 'Ольга печатает…');
    try {
      const r = await ctx.api('/api/ai', { method: 'POST', body: { mode: 'client', variant: v, messages: msgs }, timeout: 40000 });
      typing.className = 'msg in'; typing.textContent = r.text; msgs.push({ role: 'assistant', text: r.text }); left.textContent = `ИИ-запросов на сегодня: ${r.left}`;
    } catch (e) { typing.className = 'msg sys'; typing.textContent = e.message; msgs.pop(); asked--; }
    busy = false; send.disabled = false; evalBtn.disabled = asked < 3; log.scrollTop = log.scrollHeight;
  }
  async function evaluate() {
    if (busy) return; busy = true; evalBtn.disabled = send.disabled = true; ctx.step('eval');
    const wait = add('sys', 'Наставник читает диалог…');
    try {
      const r = await ctx.api('/api/ai', { method: 'POST', body: { mode: 'client_eval', variant: v, messages: msgs }, timeout: 40000 });
      wait.remove();
      const m = /Оценка:\s*(\d+)/.exec(r.text); const sc = m ? Math.min(10, +m[1]) : 5; const pts = 10 + sc * 2;
      await ctx.award(pts, { complete: true, sticker: ['first', 'ai_client'] });
      stage.replaceChildren(h('div', { class: 'row', style: 'gap:10px' }, h('img', { src: './assets/stickers/news-login.webp', alt: '', style: 'width:60px' }), h('h3', { style: 'font:700 18px var(--heading)' }, `Разбор брифа · +${pts} баллов`)),
        h('div', { class: 'explain pre' }, r.text), h('div', { class: 'row', style: 'margin-top:12px' }, nextBtn('Новый клиент', () => reset(), 'btn')));
    } catch (e) { wait.textContent = e.message; evalBtn.disabled = false; send.disabled = false; }
    busy = false;
  }
  input.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey && matchMedia('(min-width:760px)').matches) { e.preventDefault(); ask(); } });
  function reset() {
    msgs = []; asked = 0; log.replaceChildren();
    add('sys', '☕ Ольга, кофейня «Зерно», Иваново');
    add('in', v === 'B' ? 'Здравствуйте. У меня мало времени. Мне сказали, вы можете сделать, чтобы люди приходили. Что от меня нужно?' : 'Здравствуйте! Я Ольга, у меня кофейня «Зерно». Хочу, чтобы соцсети помогали бизнесу. С чего начнём?');
    stage.replaceChildren(h('p', { class: 'small muted' }, `Задача: соберите бриф. Узнайте цель, аудиторию, бюджет, сроки и всё, что поможет. Задайте хотя бы 3 вопроса, потом попросите оценку. Клиентку играет ИИ${v === 'B' ? ', и она будет непростой' : ''}.`), log,
      h('label', { class: 'sr-only', for: 'aic' }, 'Вопрос'), input, h('div', { class: 'row', style: 'margin-top:8px' }, send, evalBtn, left));
    input.id = 'aic'; evalBtn.disabled = true;
  }
  reset();
}
