import { languages, settingsFrom, sourceLanguages, allSourceLanguages, invertLanguages } from './shared.js';
const status = document.querySelector('#status');
const select = document.querySelector('#target');
for (const [code, name] of Object.entries(languages)) select.add(new Option(name, code));
let settings = settingsFrom((await chrome.storage.sync.get('settings')).settings);
async function saveSettings() {
  try { await chrome.storage.sync.set({settings}); document.querySelector('#saved').textContent = '已保存 ✓'; }
  catch { document.querySelector('#saved').textContent = '保存失败，请重试'; }
}
const languageList = document.querySelector('#source-languages');
function renderLanguages() {
  languageList.replaceChildren();
  document.querySelector('#language-count').textContent = `${settings.translateLanguages.length} / ${allSourceLanguages.length} 已选`;
  for (const [code, name] of Object.entries(sourceLanguages)) {
    const label = document.createElement('label');
    const input = document.createElement('input');
    input.type = 'checkbox'; input.value = code; input.checked = settings.translateLanguages.includes(code);
    input.addEventListener('change', () => {
      settings.translateLanguages = input.checked ? [...settings.translateLanguages, code] : settings.translateLanguages.filter(item=>item!==code);
      document.querySelector('#language-count').textContent = `${settings.translateLanguages.length} / ${allSourceLanguages.length} 已选`;
      saveSettings();
    });
    label.append(input, document.createTextNode(name)); languageList.append(label);
  }
}
renderLanguages();
document.querySelector('#select-all').addEventListener('click', () => { settings.translateLanguages = [...allSourceLanguages]; renderLanguages(); saveSettings(); });
document.querySelector('#invert-selection').addEventListener('click', () => { settings.translateLanguages = invertLanguages(settings.translateLanguages); renderLanguages(); saveSettings(); });
for (const key of ['enabled', 'bilingual', 'foreign', 'target']) {
  const field = document.getElementById(key);
  if (key === 'target') field.value = settings[key]; else field.checked = settings[key];
  field.addEventListener('change', async () => {
    settings[key] = key === 'target' ? field.value : field.checked;
    await saveSettings();
  });
}
const [tab] = await chrome.tabs.query({active:true, currentWindow:true});
try {
  const result = await chrome.tabs.sendMessage(tab.id, {type:'status'});
  status.textContent = result.status || `已连接 Threads · 本页已转换 ${result.count} 处${result.pending ? ' · 请在页面启用语言模型' : ''}`;
} catch {
  status.textContent = '请打开或刷新 Threads 页面，插件会自动开始。';
  document.querySelector('#rescan').disabled = true;
}
document.querySelector('#rescan').addEventListener('click', async () => {
  try { await chrome.tabs.sendMessage(tab.id, {type:'rescan'}); status.textContent = '已开始重新扫描，请在 Threads 页面查看结果。'; }
  catch { status.textContent = '无法连接页面，请刷新 Threads 后重试。'; }
});
