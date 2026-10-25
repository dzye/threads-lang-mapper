import * as OpenCC from 'opencc-js';
import { normalize, shouldTranslate } from './shared.js';
const simplify = OpenCC.Converter({ from: 'tw', to: 'cn' });
const traditional = OpenCC.Converter({ from: 'cn', to: 'tw' });
export function chineseSource(text) {
  // Kana and Hangul take precedence over shared CJK characters.
  if (/[\u3040-\u30ff\uac00-\ud7af]/u.test(text)) return null;
  const han = text.match(/\p{Script=Han}/gu)?.length || 0;
  const letters = text.match(/\p{Letter}/gu)?.length || 0;
  return han && han / letters > 0.6 ? (simplify(text) !== text ? 'zh-Hant' : 'zh') : null;
}
export function convertChinese(text, target) {
  if (!['zh', 'zh-Hant'].includes(target) || !/\p{Script=Han}/u.test(text) || /[\u3040-\u30ff\uac00-\ud7af]/u.test(text)) return null;
  const converted = target === 'zh' ? simplify(text) : traditional(text);
  // Mixed-language posts can still convert their Chinese characters offline.
  return converted !== text || chineseSource(text) ? converted : null;
}
export async function detect(text, detector) {
  if (/[\u3040-\u30ff]/u.test(text)) return 'ja';
  if (/[\uac00-\ud7af]/u.test(text)) return 'ko';
  const chinese = chineseSource(text);
  if (chinese) return chinese;
  if (detector) {
    const [best] = await detector.detect(text);
    return best && best.confidence >= 0.6 && best.detectedLanguage !== 'und' ? normalize(best.detectedLanguage) : null;
  }
  const result = await chrome.i18n.detectLanguage(text);
  const best = result.languages?.find(item => item.language !== 'und');
  if (!best || best.percentage < 60 || result.isReliable === false) return null;
  return normalize(best.language);
}
export function createEngine(onRequired, onProgress) {
  const sessions = new Map();
  const cache = new Map();
  let detectorPromise;
  function prepareDetector() {
    if (!detectorPromise) {
      detectorPromise = globalThis.LanguageDetector.create({monitor(m) { m.addEventListener('downloadprogress', e => onProgress(`正在下载语言识别模型：${Math.round(e.loaded * 100)}%`)); }});
      detectorPromise.catch(() => { detectorPromise = undefined; });
    }
    return detectorPromise;
  }
  function prepare(source, target) {
    if (source === 'auto') return prepareDetector();
    const key = `${source}:${target}`;
    if (sessions.has(key)) return sessions.get(key);
    const promise = globalThis.Translator.create({ sourceLanguage: source, targetLanguage: target, monitor(m) { m.addEventListener('downloadprogress', e => onProgress(`正在下载 ${source} 语言模型：${Math.round(e.loaded * 100)}%`)); } });
    sessions.set(key, promise);
    promise.catch(() => sessions.delete(key));
    return promise;
  }
  return {
    prepare,
    async translate(text, target, foreign, selected) {
      if (selected?.length === 0) return text;
      const local = convertChinese(text, target);
      if (local !== null) {
        const source = simplify(text) !== text ? 'zh-Hant' : 'zh';
        return shouldTranslate(source, selected) ? local : text;
      }
      if (!foreign) return text;
      if (!detectorPromise && globalThis.LanguageDetector && await globalThis.LanguageDetector.availability() === 'available') {
        try { await prepareDetector(); } catch { /* Use conservative fallback below. */ }
      }
      let detector;
      try { detector = detectorPromise ? await detectorPromise : undefined; } catch { /* Preserve original on low confidence. */ }
      const source = await detect(text, detector);
      if (!source) {
        if (globalThis.LanguageDetector && !detector) onRequired('auto', target);
        return text;
      }
      if (source === target || !shouldTranslate(source, selected)) return text;
      if (!globalThis.Translator) throw new Error('此浏览器无法使用内置翻译；繁简转换仍可自动运行。请使用支持 Translator API 的桌面 Chrome。');
      const key = `${source}:${target}`;
      const cacheKey = `${key}:${text}`;
      if (cache.has(cacheKey)) return cache.get(cacheKey);
      if (!sessions.has(key)) {
        const availability = await globalThis.Translator.availability({sourceLanguage: source, targetLanguage: target});
        if (availability === 'unavailable') throw new Error(`浏览器暂不支持 ${source} → ${target}；已保留原文。`);
        if (availability !== 'available') { onRequired(source, target); return null; }
      }
      try {
        const translator = await prepare(source, target);
        // Chrome's model can omit lines from a multi-line request. Translate
        // each non-empty line independently and preserve every line boundary.
        const parts = text.split(/(\r?\n)/);
        const translatedParts = [];
        for (const part of parts) {
          translatedParts.push(part.trim() ? await translator.translate(part) : part);
        }
        let translated = translatedParts.join('');
        if (target === 'zh') translated = simplify(translated);
        if (cache.size >= 500) cache.delete(cache.keys().next().value);
        cache.set(cacheKey, translated);
        return translated;
      } catch (error) {
        if (error.name === 'NotAllowedError') { onRequired(source, target); return null; }
        throw error;
      }
    }
  };
}
