import { h, toast } from './ui.js';
import { api, store } from './api.js';
// Rating form under every format: tester name (required, remembered), 1–5 stars, convenience, comment.
export function feedbackForm(fmt, variant) {
  const user = store.user;
  const lastName = localStorage.getItem('stand-fb-name') || store.tester || (user?.role === 'teacher' ? user?.name : '') || '';
  let rating = 0, ease = '';
  const name = h('input', { type: 'text', id: 'fb-name', value: lastName, maxlength: 40, required: true, autocomplete: 'name', placeholder: 'Например, Алина' });
  const stars = h('div', { class: 'stars', role: 'group', 'aria-label': 'Оценка от 1 до 5' });
  for (let i = 1; i <= 5; i++) stars.append(h('button', { type: 'button', 'aria-pressed': 'false', 'aria-label': `${i} из 5`, onclick: () => { rating = i; [...stars.children].forEach((b, j) => b.setAttribute('aria-pressed', String(j < i))); } }, '★'));
  const seg = h('div', { class: 'seg', role: 'group', 'aria-label': 'Удобно ли' });
  for (const [v, t] of [['yes', 'Удобно'], ['mid', 'Так себе'], ['no', 'Неудобно']]) seg.append(h('button', { type: 'button', 'aria-pressed': 'false', onclick: e => { ease = v; [...seg.children].forEach(b => b.setAttribute('aria-pressed', String(b === e.currentTarget))); } }, t));
  const comment = h('textarea', { id: 'fb-comment', maxlength: 1500, placeholder: 'Что понравилось, что мешало, что поменять?' });
  const err = h('div', { class: 'err', role: 'alert' });
  const btn = h('button', { class: 'btn primary', type: 'button', onclick: async () => {
    err.textContent = '';
    const n = name.value.trim();
    if (!n) { err.textContent = 'Напишите своё имя, чтобы команда знала, чей это отзыв'; name.focus(); return; }
    if (!rating) { err.textContent = 'Поставьте оценку от 1 до 5'; return; }
    btn.disabled = true;
    try {
      await api('/api/feedback', { method: 'POST', body: { fmt, variant, name: n, rating, ease, comment: comment.value } });
      localStorage.setItem('stand-fb-name', n); if (!store.tester) store.tester = n;
      toast(`Спасибо, ${n}! Отзыв о варианте ${variant === 'A' ? 'А' : 'Б'} сохранён`, 'accepted');
      comment.value = '';
    } catch (e) { err.textContent = e.message; } finally { btn.disabled = false; }
  } }, 'Отправить отзыв');
  return h('section', { class: 'fb', 'aria-labelledby': 'fb-h' },
    h('h3', { id: 'fb-h' }, `Оцените вариант ${variant === 'A' ? 'А' : 'Б'}`),
    h('p', { class: 'small muted' }, 'Отзыв увидит вся команда в статистике стенда.'),
    h('label', { class: 'f', for: 'fb-name' }, 'Ваше имя *'), name,
    h('label', { class: 'f' }, 'Насколько нравится'), stars,
    h('label', { class: 'f' }, 'Удобно ли проходить'), seg,
    h('label', { class: 'f', for: 'fb-comment' }, 'Комментарий'), comment, err, btn);
}
