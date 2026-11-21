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
export function parseGame(raw, kind) {
  const s = String(raw || '').replace(/```(?:json)?/g, '');
  const j = JSON.parse(s.slice(s.indexOf('{'), s.lastIndexOf('}') + 1));
  const out = [];
  for (const it of j.items || []) {
    if (!it || !it.q) continue;
    if (kind === 'B') { const t = truthOf(it.truth ?? it.answer); if (t == null) continue; out.push({ q: strip(it.q), o: ['Правда', 'Миф'], a: t ? 0 : 1, why: it.why || '' }); continue; }
    const opts = (it.options || []).map(strip).filter(Boolean);
    if (opts.length < 2) continue;
    const a = correctIndex(it, opts); if (a < 0 || a >= opts.length) continue; // skip questions we cannot map safely
    out.push({ q: strip(it.q), o: opts, a, why: it.why || '' });
  }
  return out;
}
