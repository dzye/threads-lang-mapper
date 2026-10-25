import { build } from 'esbuild';
import { mkdir, copyFile, cp, rm } from 'node:fs/promises';
await rm('dist', {recursive:true,force:true});
await mkdir('dist', {recursive:true});
await build({entryPoints:['src/content.js'],bundle:true,outdir:'dist',target:'chrome138',format:'iife',minify:true});
await build({entryPoints:['src/popup.js'],bundle:true,outdir:'dist',target:'chrome138',format:'esm',minify:true});
for (const file of ['manifest.json','popup.html','popup.css']) await copyFile(`src/${file}`, `dist/${file}`);
await cp('node_modules/opencc-js/LICENSE', 'dist/OpenCC-LICENSE.txt');
await cp('node_modules/opencc-js/LICENSES', 'dist/LICENSES', {recursive:true});
await cp('node_modules/opencc-js/THIRD_PARTY_LICENSES.md', 'dist/THIRD_PARTY_LICENSES.md');
console.log('可加载扩展已生成：dist/');

await mkdir('dist/assets/brand', {recursive:true});
for (const size of [16,32,48,128]) await copyFile(`src/assets/brand/icon-${size}.png`, `dist/assets/brand/icon-${size}.png`);
