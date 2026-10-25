import { test } from 'node:test';
import assert from 'node:assert/strict';
import { convertChinese, chineseSource, createEngine } from '../src/engine.js';
import { normalize, settingsFrom } from '../src/shared.js';

test('繁简词组转换与其他目标语言', () => {
  assert.equal(convertChinese('這個軟體讓閱讀變得簡單，臺灣的朋友也喜歡。', 'zh'), '这个软体让阅读变得简单，台湾的朋友也喜欢。');
  assert.equal(convertChinese('欢迎阅读这条消息', 'zh-Hant'), '歡迎閱讀這條消息');
  assert.equal(convertChinese('Hello world', 'zh'), null);
  assert.equal(convertChinese('これは日本語の文章です', 'zh'), null);
  assert.equal(chineseSource('한국어 문장 漢字'), null);
  assert.equal(convertChinese('你好世界', 'en'), null);
  assert.equal(convertChinese('61. intermodal (adj.) – 複合運輸的 62. couchette (n.) – 列車臥鋪', 'zh'), '61. intermodal (adj.) – 复合运输的 62. couchette (n.) – 列车卧铺');
});
test('设置与语言代码校验', () => {
  assert.equal(normalize('zh-TW'), 'zh-Hant');
  assert.equal(normalize('zh-CN'), 'zh');
  assert.equal(normalize('en-US'), 'en');
  assert.equal(settingsFrom({target:'invalid'}).target, 'zh');
});
test('本地转换无需翻译 API，外语模型需用户初始化并缓存', async () => {
  globalThis.chrome = {i18n:{detectLanguage:async () => ({languages:[{language:'en', percentage:99}]})}};
  const requests = [];
  let calls = 0;
  globalThis.Translator = {availability:async () => 'downloadable', create:async () => ({translate:async () => {calls++; return '這是一段翻譯';}})};
  const engine = createEngine((...pair) => requests.push(pair), () => {});
  assert.equal(await engine.translate('歡迎回來', 'zh', true), '欢迎回来');
  assert.equal(await engine.translate('A meaningful English sentence', 'zh', true), null);
  assert.deepEqual(requests, [['en','zh']]);
  await engine.prepare('en','zh');
  assert.equal(await engine.translate('A meaningful English sentence', 'zh', true), '这是一段翻译');
  await engine.translate('A meaningful English sentence', 'zh', true);
  assert.equal(calls, 1);
  assert.equal(await engine.translate('Hello everyone', 'zh', false), 'Hello everyone');
  delete globalThis.Translator;
  await assert.rejects(createEngine(()=>{},()=>{}).translate('Hello everyone', 'zh', true), /无法使用内置翻译/);
});

test('多行日语逐行送入真实接口契约，保留换行避免模型遗漏', async () => {
  const inputs = [];
  globalThis.Translator = {availability:async()=> 'available',create:async()=>({translate:async input=>{inputs.push(input);return `中文:${input}`;}})};
  const engine = createEngine(()=>{},()=>{});
  const result = await engine.translate('おはようございます\n\n今日は雨です', 'zh', true);
  assert.deepEqual(inputs, ['おはようございます','今日は雨です']);
  assert.equal(result, '中文:おはようございます\n\n中文:今日は雨です');
  delete globalThis.Translator;
});
