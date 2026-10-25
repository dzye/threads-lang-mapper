import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { build } from 'esbuild';
import { candidates, makeTranslation, sourceText } from '../src/dom.js';
const pause = () => new Promise(resolve => setTimeout(resolve, 350));

test('保护编辑区、导航、链接，译文按纯文本写入', () => {
  const { window } = new JSDOM('<article><div dir="auto">這是帖文</div><div contenteditable="true"><div dir="auto">不要改動</div></div><button><span dir="auto">按鈕</span></button><a href="/user"><span dir="auto">帳號</span></a></article><nav><div data-threads-text>導航</div></nav>');
  assert.deepEqual(candidates(window.document).map(el=>el.textContent), ['這是帖文']);
  const box = makeTranslation(window.document, '<img src=x onerror=alert(1)>', 'zh');
  assert.equal(box.querySelector('img'), null);
  assert.match(box.textContent, /<img/);
});
test('Threads 实际正文结构只匹配 lang 内容区，跳过用户名', () => {
  const {window} = new JSDOM('<div data-pressable-container="true"><span dir="auto">username_123</span><div lang="zh-TW"><div><span dir="auto"><span>這是正文</span></span></div></div></div>');
  assert.deepEqual(candidates(window.document).map(el=>el.textContent), ['這是正文']);
});
test('动态帖文、节点复用、目标语言更改与关闭后恢复原文', async () => {
  const bundle = await build({entryPoints:['src/content.js'],bundle:true,write:false,format:'iife'});
  const dom = new JSDOM('<body><article><div dir="auto">這是第一條測試訊息</div></article></body>', {runScripts:'outside-only', url:'https://www.threads.com/'});
  const {window} = dom;
  let changed;
  window.chrome = {storage:{sync:{get:async()=>({settings:{foreign:false}})},onChanged:{addListener:fn=>changed=fn}},runtime:{onMessage:{addListener:()=>{}}}};
  window.eval(bundle.outputFiles[0].text);
  await pause();
  assert.equal(window.document.querySelector('[data-tlm="translation"] span').textContent, '这是第一条测试讯息');
  const article = window.document.querySelector('article');
  const next = window.document.createElement('div'); next.dir = 'auto'; next.textContent = '滾動載入的第二條訊息'; article.append(next);
  await pause();
  assert.equal(window.document.querySelectorAll('[data-tlm="translation"]').length, 2);
  next.textContent = '這是重新使用的節點';
  await pause();
  assert.equal(next.nextElementSibling.querySelector('span').textContent, '这是重新使用的节点');
  changed({settings:{newValue:{foreign:false,bilingual:false}}},'sync');
  await pause();
  assert.equal(next.style.display, 'none');
  assert.equal(next.textContent, '這是重新使用的節點');
  changed({settings:{newValue:{enabled:false}}},'sync');
  await pause();
  assert.equal(window.document.querySelectorAll('[data-tlm="translation"]').length, 0);
  assert.equal(next.style.display, '');
  dom.window.close();
});

test('译文保留原文链接和网址，拒绝脚本协议', () => {
  const {window} = new JSDOM('<div id="source"><a href="https://example.com/full/path">example.com/short…</a><a href="/@person">@person</a><a href="javascript:alert(1)">坏链接</a></div>', {url:'https://www.threads.com/'});
  const box = makeTranslation(window.document, '请访问 https://other.example/path。以及 example.com/short…', 'zh', window.document.querySelector('#source'));
  const links = [...box.querySelectorAll('a')];
  assert.deepEqual(links.map(a=>a.href), ['https://other.example/path', 'https://example.com/full/path', 'https://www.threads.com/@person']);
  assert.ok(links.every(a=>a.rel.includes('noopener') && a.target === '_blank'));
  assert.ok(!box.innerHTML.includes('javascript:'));
});
test('没有 lang 的外语正文也会匹配，用户名仍排除', () => {
  const {window} = new JSDOM('<div data-pressable-container="true"><span dir="auto">username</span><div><span dir="auto" style="--x-lineHeight:1.4">Good morning everyone</span></div></div>');
  assert.deepEqual(candidates(window.document).map(e=>e.textContent), ['Good morning everyone']);
});

test('提取正文排除网站翻译按钮，保留链接文字', () => {
  const {window} = new JSDOM('<div id="text">Hello <a href="https://example.com">link</a><button>翻译</button></div>');
  assert.equal(sourceText(window.document.querySelector('#text')), 'Hello link');
});
