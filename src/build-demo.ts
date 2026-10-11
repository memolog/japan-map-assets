import {cp, mkdir, readFile, rm, writeFile} from 'node:fs/promises';

// Publish only the demo, generated assets, and redistribution notices.
const html = await readFile('preview/index.html', 'utf8');
await readFile('dist/manifest.json');
await rm('_site', {recursive: true, force: true});
await mkdir('_site', {recursive: true});
await cp('dist', '_site/dist', {recursive: true});
for (const name of ['LICENSE', 'DATA_LICENSE.md']) {
  await cp(name, `_site/${name}`);
}
await writeFile('_site/index.html', html.replace('<base href="../">', '<base href="./">'));
await writeFile('_site/.nojekyll', '');
console.log('Static demo built in _site/');
