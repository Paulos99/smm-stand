// Turns raw YandexGPT game output into clean quiz items. Pure function, tested in infra/test-game-parse.mjs.
const LETTERS = ['а', 'б', 'в', 'г', 'д'], LAT = ['a', 'b', 'c', 'd', 'e'];
const strip = s => String(s ?? '').replace(/^\s*(?:[абвгдabcde]|\d)[).:]\s+/i, '').trim();
const norm = s => strip(s).toLowerCase().replace(/ё/g, 'е').replace(/[«»"'.,!?:;()\s]+/g, ' ').trim();
function correctIndex(it, opts) {
  const n = opts.length, keys = opts.map(norm);
  // 1) exact text of the correct option (what the prompt asks for)
  for (const c of [it.correct, it.correct_text, it.answer_text, typeof it.answer === 'string' && !/^\s*\d+\s*$/.test(it.answer) && !/^\s*[абвгдabcde]\s*\)?\s*$/i.test(it.answer) ? it.answer : null]) {
    if (c == null || c === '') continue;
    const k = norm(c); let i = keys.indexOf(k);
    if (i < 0) i = keys.findIndex(o => o && (o.includes(k) || k.includes(o)));
    if (i >= 0) return i;
  }
  // 2) a letter: "б", "Б)", "b"
  for (const c of [it.letter, it.correct, it.answer]) {
    if (typeof c !== 'string') continue;
    const m = /^\s*([абвгдabcde])\s*\)?\s*$/i.exec(c); if (!m) continue;
    const ch = m[1].toLowerCase(); const i = LETTERS.includes(ch) ? LETTERS.indexOf(ch) : LAT.indexOf(ch);
    if (i >= 0 && i < n) return i;
  }
  // 3) a number: ambiguous 0- or 1-based, decide by the explanation, then by range
  const num = [it.answer, it.correct, it.index].map(x => (typeof x === 'number' ? x : /^\s*\d+\s*$/.test(String(x ?? '')) ? +x : null)).find(x => x != null);
  if (num != null) {
    const why = norm(it.why), cands = [num - 1, num].filter(i => i >= 0 && i < n);
    const byWhy = cands.filter(i => keys[i] && why.includes(keys[i]));
    if (byWhy.length === 1) return byWhy[0];
    if (num === n) return n - 1;
    if (num === 0) return 0;
    return num - 1; // models count from 1 most of the time
  }
  return -1;
}
const truthOf = v => (typeof v === 'boolean' ? v : /^(true|да|правда|1)$/i.test(String(v ?? '').trim()) ? true : /^(false|нет|миф|0)$/i.test(String(v ?? '').trim()) ? false : null);
// Tolerant JSON extraction: code fences, text around JSON, bare arrays, trailing commas, smart quotes.
export function extractJson(raw) {
  let s = String(raw || '').replace(/```[a-zA-Z]*\s*/g, '').replace(/```/g, '').replace(/^\uFEFF/, '');
  const tries = [];
  const o1 = s.indexOf('{'), o2 = s.lastIndexOf('}'), a1 = s.indexOf('['), a2 = s.lastIndexOf(']');
  if (o1 >= 0 && o2 > o1) tries.push(s.slice(o1, o2 + 1));
  if (a1 >= 0 && a2 > a1) tries.push(s.slice(a1, a2 + 1));
  tries.push(s.trim());
  const fix = t => t.replace(/[\u201C\u201D\u201E]/g, '"').replace(/,\s*([}\]])/g, '$1').replace(/([{,]\s*)'([^'\n]+?)'\s*:/g, '$1"$2":');
  for (const t of tries) for (const c of [t, fix(t)]) { try { const j = JSON.parse(c); return Array.isArray(j) ? { items: j } : j; } catch {} }
  // last resort: collect separate {...} objects line by line
  const objs = [...s.matchAll(/\{[^{}]*\}/g)].map(m => { try { return JSON.parse(fix(m[0])); } catch { return null; } }).filter(x => x && (x.q || x.question || x.statement));
  if (objs.length) return { items: objs };
  throw new Error('bad json');
}
export function parseGame(raw, kind) {
  const j = extractJson(raw);
  const list = j.items || j.questions || j.statements || j.quiz || j.game || Object.values(j).find(Array.isArray) || [];
  const out = [];
  for (let it of list) {
    if (it && !it.q) it = { ...it, q: it.question || it.statement || it.text };
    if (it && !it.options && Array.isArray(it.variants)) it = { ...it, options: it.variants };
    if (it && !it.why) it = { ...it, why: it.explanation || it.comment || '' };
    if (!it || !it.q) continue;
    if (kind === 'B') { const t = truthOf(it.truth ?? it.isTrue ?? it.true ?? it.answer ?? it.correct); if (t == null) continue; out.push({ q: strip(it.q), o: ['Правда', 'Миф'], a: t ? 0 : 1, why: it.why || '' }); continue; }
    const opts = (it.options || []).map(strip).filter(Boolean);
    if (opts.length < 2) continue;
    const a = correctIndex(it, opts); if (a < 0 || a >= opts.length) continue; // skip questions we cannot map safely
    out.push({ q: strip(it.q), o: opts, a, why: it.why || '' });
  }
  return out;
}
