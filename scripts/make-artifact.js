// Junta o build de demonstração (dist-demo/) num único HTML para publicar como artefato.
// Uso: npm run artifact  ->  gera artifact/zip-restaurante-demo.html
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const dist = path.join(root, 'dist-demo');
const assets = path.join(dist, 'assets');
const files = fs.readdirSync(assets);
const js = files.filter((f) => f.endsWith('.js'));
const css = files.filter((f) => f.endsWith('.css'));
if (js.length !== 1) throw new Error(`Esperava 1 arquivo JS no build demo, achei ${js.length}: ${js.join(', ')}`);

const read = (f) => fs.readFileSync(path.join(assets, f), 'utf8');
const style = css.map(read).join('\n').replace(/<\/style/gi, '<\\/style');
const script = read(js[0]).replace(/<\/script/gi, '<\\/script');

const html = `<title>ZipRotas Painel da Loja</title>
<meta name="theme-color" content="#1e1e1e">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Onest:wght@400;500;600;700;800&display=swap">
<style>
:root { color-scheme: dark; }
html, body { height: 100%; background: #1e1e1e; }
${style}
</style>
<div id="app"></div>
<script type="module">
${script}
</script>
`;

const outDir = path.join(root, 'artifact');
fs.mkdirSync(outDir, { recursive: true });
const out = path.join(outDir, 'zip-restaurante-demo.html');
fs.writeFileSync(out, html);
console.log(`Artefato: ${path.relative(root, out)} (${(html.length / 1024).toFixed(0)} KB)`);
