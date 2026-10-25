export const sourceLanguages = {
  'zh-Hant':'繁体中文', zh:'简体中文', en:'英语', ja:'日语', ko:'韩语',
  ar:'阿拉伯语', bg:'保加利亚语', bn:'孟加拉语', cs:'捷克语', da:'丹麦语', de:'德语', el:'希腊语', es:'西班牙语', fi:'芬兰语', fr:'法语', he:'希伯来语', hi:'印地语', hr:'克罗地亚语', hu:'匈牙利语', id:'印尼语', it:'意大利语', kn:'卡纳达语', lt:'立陶宛语', mr:'马拉地语', nl:'荷兰语', no:'挪威语', pl:'波兰语', pt:'葡萄牙语', ro:'罗马尼亚语', ru:'俄语', sk:'斯洛伐克语', sl:'斯洛文尼亚语', sv:'瑞典语', ta:'泰米尔语', te:'泰卢固语', th:'泰语', tr:'土耳其语', uk:'乌克兰语', vi:'越南语', other:'其他识别出的语言'
};
export const allSourceLanguages = Object.keys(sourceLanguages);
export const defaults = { enabled: true, target: 'zh', bilingual: true, foreign: true, translateLanguages: [...allSourceLanguages] };
export function shouldTranslate(source, selected = allSourceLanguages) {
  return selected.includes(Object.hasOwn(sourceLanguages, source) ? source : 'other');
}
export function invertLanguages(selected) {
  return allSourceLanguages.filter(code => !selected.includes(code));
}
export const languages = { zh: '简体中文', 'zh-Hant': '繁體中文', en: 'English', ja: '日本語', ko: '한국어', fr: 'Français', de: 'Deutsch', es: 'Español', pt: 'Português', ru: 'Русский', vi: 'Tiếng Việt', th: 'ไทย', id: 'Bahasa Indonesia', ar: 'العربية' };
export function normalize(language) {
  if (/^zh(-?(TW|HK|MO|Hant))?$/i.test(language) && !/^zh$/i.test(language)) return 'zh-Hant';
  if (/^zh/i.test(language)) return 'zh';
  return language.toLowerCase().split('-')[0];
}
export function settingsFrom(value = {}) {
  return { enabled: typeof value.enabled === 'boolean' ? value.enabled : true, target: Object.hasOwn(languages, value.target) ? value.target : 'zh', bilingual: typeof value.bilingual === 'boolean' ? value.bilingual : true, foreign: typeof value.foreign === 'boolean' ? value.foreign : true, translateLanguages: Array.isArray(value.translateLanguages) ? [...new Set(value.translateLanguages.filter(code => allSourceLanguages.includes(code)))] : [...allSourceLanguages] };
}
