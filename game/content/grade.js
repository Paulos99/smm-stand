// Shared grading for the game: used by the browser (instant feedback) and by the API (server-authoritative stars and XP).
// Answer per item: quiz/vs/chat -> option index (-1 = timeout); swipe -> true/false; blocks -> array of block indices per slot;
// pairs -> array of chosen right indices per left row; cloze -> array of chip indices per gap; clue -> array of tapped spot ids ('x' = miss); story -> null.
export function itemErrors(it, a) {
  switch (it.type) {
    case 'story': return 0;
    case 'quiz': case 'vs': case 'chat': return a === it.correct ? 0 : 1;
    case 'swipe': return a === it.truth ? 0 : 1;
    case 'blocks': { if (!Array.isArray(a)) return it.key.length; const w = it.key.filter((k, i) => a[i] !== k).length; return w ? Math.min(2, w) : 0; }
    case 'pairs': { if (!Array.isArray(a)) return it.key.length; return Math.min(3, it.key.filter((k, i) => a[i] !== k).length); }
    case 'cloze': { if (!Array.isArray(a)) return it.key.length; return Math.min(2, it.key.filter((k, i) => a[i] !== k).length); }
    case 'clue': { if (!Array.isArray(a)) return 3; const real = new Set(it.spots.filter(s => s.bad).map(s => s.id)); const found = new Set(a.filter(x => real.has(x)));
      if (found.size < real.size) return 3; return Math.min(3, a.filter(x => !real.has(x)).length); }
    default: return 1;
  }
}
export function weight(it) { return it.type === 'story' ? 0 : it.type === 'pairs' ? 2 : 1; }
export function starsFor(errors, total) {
  if (total <= 0) return 3;
  if (errors <= 0) return 3;
  if (errors === 1) return 2;
  return errors <= Math.max(2, Math.floor(total * 0.4)) ? 1 : 0;
}
export function gradeStep(step, answers) {
  let errors = 0, total = 0;
  step.items.forEach((it, i) => { if (it.type === 'brief') return; total += weight(it); errors += itemErrors(it, answers?.[i]); });
  return { errors, total, stars: starsFor(errors, total) };
}
