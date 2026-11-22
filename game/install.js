// Install the game as an app (Android / desktop Chrome via beforeinstallprompt, iOS Safari via a short how-to) and a fullscreen toggle.
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const ico = (id) => `<svg class="ic" aria-hidden="true"><use href="#i-${id}"/></svg>`;
let deferred = null, reg = null;
const KEY = 'shtab-install-hide';
export const standalone = () => matchMedia('(display-mode: fullscreen)').matches || matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
export const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
export const canInstall = () => !standalone() && (!!deferred || isIOS());
export const canFullscreen = () => !standalone() && !!document.documentElement.requestFullscreen && document.fullscreenEnabled;
const hidden = () => { try { return Date.now() < +(localStorage.getItem(KEY) || 0); } catch { return false; } };

export function initInstall({ toast, onChange }) {
  if ('serviceWorker' in navigator) addEventListener('load', () => navigator.serviceWorker.register('./sw.js?v=20261122i', { scope: './' }).then((r) => { reg = r; }).catch(() => {}));
  addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferred = e; onChange?.(); banner(toast); });
  addEventListener('appinstalled', () => { deferred = null; document.getElementById('install-bar')?.remove(); toast('Штаб на рабочем столе. Открывайте его как приложение'); onChange?.(); });
  document.addEventListener('fullscreenchange', () => onChange?.());
  if (isIOS() && !standalone()) setTimeout(() => banner(toast), 2500);
}
export function showInstallBanner(toast) { if (canInstall()) banner(toast); }
function banner(toast) {
  if (hidden() || standalone() || document.getElementById('install-bar') || document.querySelector('.app')?.hidden) return;
  const bar = document.createElement('aside'); bar.id = 'install-bar'; bar.className = 'inst'; bar.setAttribute('aria-label', 'Установить приложение');
  bar.innerHTML = `<img src="./icons/icon-192.png" alt="" width="48" height="48"><div><b>Штаб на рабочем столе</b><span>Открывается сразу, на весь экран, как приложение.</span></div>
    <button class="cta cta-sm" type="button" data-install>Установить</button><button class="icon-btn inst-x" type="button" data-install-hide aria-label="Не сейчас">${ico('x')}</button>`;
  document.body.append(bar); requestAnimationFrame(() => bar.classList.add('is-in'));
  bar.querySelector('[data-install]').onclick = () => install(toast);
  bar.querySelector('[data-install-hide]').onclick = () => { try { localStorage.setItem(KEY, String(Date.now() + 14 * 864e5)); } catch {} bar.classList.remove('is-in'); setTimeout(() => bar.remove(), 300); };
}
export async function install(toast) {
  if (deferred) { const d = deferred; deferred = null; d.prompt(); const r = await d.userChoice.catch(() => null); if (r?.outcome === 'accepted') document.getElementById('install-bar')?.remove(); else toast?.('Можно установить позже: вкладка «Агент» → «Установить»'); return; }
  if (isIOS()) return iosHowTo();
  toast?.('В этом браузере установка из меню: «⋮» → «Установить приложение» или «Добавить на главный экран»');
}
function iosHowTo() {
  const sh = document.getElementById('sheet');
  sh.innerHTML = `<form method="dialog" class="sheet-in ios-how"><img src="./icons/icon-192.png" alt="" width="72" height="72" class="ios-ic"><h2 id="sheet-t">Штаб на экран «Домой»</h2>
    <ol class="ios-steps"><li><span class="ios-n">1</span><span>Внизу Safari нажмите <b>«Поделиться»</b> <svg class="ios-share" viewBox="0 0 24 24" aria-label="значок Поделиться"><path d="M12 3v12M8 7l4-4 4 4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M6 11H5v9h14v-9h-1" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg></span></li>
    <li><span class="ios-n">2</span><span>Прокрутите и выберите <b>«На экран „Домой“»</b></span></li><li><span class="ios-n">3</span><span>Нажмите <b>«Добавить»</b>. Штаб откроется с иконки на весь экран.</span></li></ol>
    <p class="fine">Только в Safari. В Chrome на iPhone: «⋯» → «На экран „Домой“».</p>
    <div class="sheet-a"><button class="cta cta-sm" value="close">Понятно</button></div></form>`;
  sh.showModal();
}
export async function toggleFullscreen(toast) {
  try { if (document.fullscreenElement) await document.exitFullscreen(); else await document.documentElement.requestFullscreen({ navigationUI: 'hide' }); }
  catch { toast?.('Браузер не разрешил полный экран'); }
}

// Updates: the page asks for a fresh index.html (no cache) when the app opens or comes back to the screen.
// If the build changed, it reloads by itself when nothing is in progress, otherwise it offers «Обновить».
const BUILD = '20261122i';
let lastCheck = 0, offered = false;
async function latestBuild() {
  const r = await fetch('./index.html?check=' + Date.now(), { cache: 'no-store', credentials: 'same-origin' });
  const m = (await r.text()).match(/game\.js\?v=([0-9a-z]+)/); return m ? m[1] : '';
}
async function applyUpdate() { try { await reg?.update(); } catch {} location.reload(); }
export function watchUpdates({ toast, busy }) {
  const check = async (force) => {
    if (!navigator.onLine || offered || (!force && Date.now() - lastCheck < 60000)) return; lastCheck = Date.now();
    let v = ''; try { v = await latestBuild(); } catch { return; }
    if (!v || v === BUILD) return;
    let tried = ''; try { tried = sessionStorage.getItem('shtab-upd') || ''; } catch {}
    if (!busy() && tried !== v) { try { sessionStorage.setItem('shtab-upd', v); } catch {} return applyUpdate(); } // one silent reload per version, never a loop
    offered = true; updateBar(toast);
  };
  setTimeout(() => check(true), 1500);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { reg?.update().catch(() => {}); check(); } });
  addEventListener('focus', () => check());
}
function updateBar() {
  if (document.getElementById('upd-bar')) return;
  const bar = document.createElement('aside'); bar.id = 'upd-bar'; bar.className = 'inst upd'; bar.setAttribute('role', 'status');
  bar.innerHTML = `<div><b>Вышло обновление штаба</b><span>Допройдите задание и обновите, прогресс сохранится.</span></div><button class="cta cta-sm" type="button" data-upd>Обновить</button>`;
  document.body.append(bar); requestAnimationFrame(() => bar.classList.add('is-in'));
  bar.querySelector('[data-upd]').onclick = applyUpdate;
}
