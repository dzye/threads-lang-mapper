import { defaults, settingsFrom, languages } from './shared.js';
import { createEngine } from './engine.js';
import { candidates, makeTranslation, sourceText } from './dom.js';
let settings = defaults;
let generation = 0;
let timer;
let running = false;
let rerun = false;
let status = '';
let dismissed = false;
let downloadComplete = false;
const records = new Map();
const pending = new Map();
const loading = new Set();
const host = document.createElement('div');
host.dataset.tlm = 'controls';
host.style.cssText = 'position:fixed;bottom:18px;right:18px;z-index:2147483647;';
const shadow = host.attachShadow({mode:'closed'});
shadow.innerHTML = `<style>:host{font:13px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#e8eadf}section{position:relative;background:#20251d;border:1px solid #48513e;border-radius:14px;padding:12px 38px 12px 14px;max-width:290px;box-shadow:0 4px 24px #0003}p{margin:0;line-height:1.6}button{background:#c5f37c;color:#20251d;border:0;border-radius:6px;padding:7px 10px;margin:8px 5px 0 0;cursor:pointer}small{display:block;color:#b5bcac;margin-top:6px}button:disabled{opacity:.5}.close{position:absolute;top:5px;right:5px;margin:0;padding:4px 8px;background:transparent;color:#e8eadf;font-size:20px;line-height:1}.close:focus-visible{outline:2px solid #c5f37c}</style><section aria-live="polite"><button class="close" type="button" aria-label="关闭提示" title="关闭提示">×</button><p></p><div></div><small>繁简转换始终在本地完成</small></section>`;
shadow.querySelector('.close').addEventListener('click', () => { dismissed = true; render(); });
const engine = createEngine((source, target) => {
  const key = `${source}:${target}`;
  if (!pending.has(key)) { dismissed = false; downloadComplete = false; }
  pending.set(key, {source,target}); render();
}, (message, complete = false) => { status = message; downloadComplete = complete; render(); });
function render() {
  host.hidden = dismissed || downloadComplete || !settings.enabled || (!status && !pending.size);
  shadow.querySelector('p').textContent = status || '首次翻译此语言，请点击加载浏览器模型，之后自动翻译。';
  const buttons = shadow.querySelector('div');
  buttons.replaceChildren();
  for (const [key, {source,target}] of pending) {
    const button = document.createElement('button');
    button.textContent = source === 'auto' ? (loading.has(key) ? '正在加载语言识别…' : '启用智能语言识别') : (loading.has(key) ? `正在加载 ${languages[source] || source}…` : `启用 ${languages[source] || source} → ${languages[target]}`);
    button.disabled = loading.has(key);
    button.addEventListener('click', async () => {
      loading.add(key);
      button.disabled = true;
      dismissed = false; downloadComplete = false;
      status = '正在准备语言模型…';
      // create() starts directly inside the user gesture, before any await.
      try { const ready = engine.prepare(source, target); render(); await ready; pending.delete(key); status = ''; schedule(); }
      catch (error) { dismissed = false; downloadComplete = false; status = `模型加载失败：${error.message}`; }
      loading.delete(key);
      render();
    });
    buttons.append(button);
  }
}
function restore() {
  for (const [el, record] of records) {
    record.box.remove();
    el.style.display = record.display;
  }
  records.clear();
}
function schedule() {
  if (timer) return;
  timer = setTimeout(() => { timer = undefined; scan(); }, 180);
}
async function scan() {
  if (running) { rerun = true; return; }
  if (!settings.enabled) return;
  if (/^\/(direct|inbox|messages|chat)(\/|$)/i.test(location.pathname)) { restore(); return; }
  running = true;
  const current = generation;
  try {
    for (const [el, record] of records) {
      if (!el.isConnected || sourceText(el) !== record.original || !record.box.isConnected) {
        record.box.remove(); el.style.display = record.display; records.delete(el);
      }
    }
    for (const el of candidates()) {
      if (current !== generation) break;
      if (records.has(el)) continue;
      const rect = el.getBoundingClientRect();
      if (rect.bottom < -400 || rect.top > innerHeight + 700) continue;
      const original = sourceText(el);
      try {
        const translated = await engine.translate(original, settings.target, settings.foreign, settings.translateLanguages);
        if (current !== generation || !el.isConnected || sourceText(el) !== original) continue;
        if (!translated || translated === original) continue;
        const box = makeTranslation(document, translated, settings.target, el);
        const display = el.style.display;
        if (!settings.bilingual) el.style.display = 'none';
        el.after(box);
        records.set(el, {original, box, display});
      } catch (error) { status = error.message; render(); }
    }
  } finally { running = false; if (rerun) { rerun = false; schedule(); } }
}
chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (message.type === 'status') respond({count:records.size, status, pending:pending.size});
  if (message.type === 'rescan') { dismissed = false; downloadComplete = false; status = ''; schedule(); respond({ok:true}); }
});
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'sync' || !changes.settings) return;
  settings = settingsFrom(changes.settings.newValue);
  generation++; dismissed = false; downloadComplete = false; pending.clear(); status = ''; restore(); render(); schedule();
});
async function start() {
  settings = settingsFrom((await chrome.storage.sync.get('settings')).settings);
  document.body.append(host); render();
  new MutationObserver(mutations => {
    if (mutations.some(m => !m.target.closest?.('[data-tlm]') && (m.type === 'characterData' || [...m.addedNodes, ...m.removedNodes].some(n => !(n.nodeType === 1 && n.hasAttribute('data-tlm')))))) schedule();
  }).observe(document.body, {childList:true, subtree:true, characterData:true});
  addEventListener('scroll', schedule, {passive:true, capture:true});
  schedule();
}
start().catch(error => console.warn('Threads 中文阅读：', error));
