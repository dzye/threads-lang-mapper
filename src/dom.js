export const selector = '[data-threads-text], [data-testid="post-text"], [data-pressable-container="true"] [lang] [dir="auto"], [data-pressable-container="true"] [dir="auto"][style*="--x-lineHeight"], article [dir="auto"], [role="article"] [dir="auto"]';
export function sourceText(el) {
  const copy = el.cloneNode(true);
  copy.querySelectorAll('button, [role="button"], time, [data-tlm]').forEach(node => node.remove());
  return copy.textContent;
}
export function candidates(root = document) {
  return [...root.querySelectorAll(selector)].filter(el => {
    if (el.closest('[data-tlm], nav, header, button, [role="button"], [contenteditable], textarea, input, [translate="no"]')) return false;
    if (el.querySelector('[dir="auto"], time')) return false;
    if (el.closest('a') && !el.closest('[data-testid="post-text"], [data-threads-text]')) return false;
    return /\p{Letter}/u.test(el.textContent) && el.textContent.trim().length >= 2 && el.textContent.length <= 6000;
  });
}
export function safeLink(value, base) {
  try {
    const url = new URL(value, base);
    return ['http:', 'https:'].includes(url.protocol) ? url.href : null;
  } catch { return null; }
}
function linkNode(doc, label, href) {
  const link = doc.createElement('a');
  link.textContent = label; link.href = href; link.target = '_blank'; link.rel = 'noopener noreferrer';
  link.style.cssText = 'color:inherit;text-decoration:underline;text-underline-offset:3px;overflow-wrap:anywhere;';
  return link;
}
export function makeTranslation(doc, translated, target, source) {
  const box = doc.createElement('div');
  box.dataset.tlm = 'translation';
  box.lang = target;
  box.dir = 'auto';
  box.style.cssText = 'margin:8px 0 4px;padding:9px 12px;border-inline-start:2px solid #bbf065;background:light-dark(#f4f7ef,#20271a);color:inherit;font-size:inherit;line-height:1.6;white-space:pre-wrap;border-radius:0 8px 8px 0;';
  const label = doc.createElement('small');
  label.textContent = '译文 · Threads 中文阅读';
  label.style.cssText = 'display:block;font-size:10px;opacity:.6;margin-bottom:4px;';
  const text = doc.createElement('span');
  const links = [...(source?.querySelectorAll('a[href]') || [])].map(a => ({label:a.textContent, href:safeLink(a.getAttribute('href'), doc.baseURI)})).filter(a=>a.href);
  const used = new Set();
  // Treat all output as text; only create anchors for verified HTTP(S) URLs.
  const pattern = /https?:\/\/[^\s<>"\u3000-\u303f\uff00-\uffef]+|www\.[^\s<>"\u3000-\u303f\uff00-\uffef]+/gu;
  let cursor = 0;
  for (const match of translated.matchAll(pattern)) {
    text.append(doc.createTextNode(translated.slice(cursor, match.index)));
    const raw = match[0].replace(/[.,;:!?)}\]]+$/u, '');
    const original = links.find(a => a.label === raw || a.href === raw);
    const href = original?.href || safeLink(raw.startsWith('www.') ? `https://${raw}` : raw, doc.baseURI);
    if (href) { text.append(linkNode(doc, raw, href)); used.add(href); }
    else text.append(doc.createTextNode(raw));
    text.append(doc.createTextNode(match[0].slice(raw.length)));
    cursor = match.index + match[0].length;
  }
  text.append(doc.createTextNode(translated.slice(cursor)));
  // Restore original inline captions (mentions and shortened URLs included)
  // when the model preserved them verbatim.
  for (const node of [...text.childNodes]) {
    if (node.nodeType !== 3) continue;
    let rest = node.textContent;
    const fragment = doc.createDocumentFragment();
    while (rest) {
      const next = links.filter(a=>a.label?.trim() && rest.includes(a.label)).map(a=>({...a,index:rest.indexOf(a.label)})).sort((a,b)=>a.index-b.index || b.label.length-a.label.length)[0];
      if (!next) { fragment.append(doc.createTextNode(rest)); break; }
      fragment.append(doc.createTextNode(rest.slice(0,next.index)), linkNode(doc,next.label,next.href));
      used.add(next.href);
      rest = rest.slice(next.index+next.label.length);
    }
    node.replaceWith(fragment);
  }
  box.append(label, text);
  // Model output may rewrite a caption or omit/truncate a URL. Keep original
  // destinations independently, so hiding the source never removes access.
  const remaining = links.filter(a => !used.has(a.href) && (used.add(a.href), true));
  if (remaining.length) {
    const footer = doc.createElement('div');
    footer.style.cssText = 'margin-top:8px;font-size:12px;line-height:1.8;';
    footer.append(doc.createTextNode('原文链接：'));
    for (const item of remaining) { footer.append(linkNode(doc, item.label || item.href, item.href), doc.createTextNode('  ')); }
    box.append(footer);
  }
  return box;
}
