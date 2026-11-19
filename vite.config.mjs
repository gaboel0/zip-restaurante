import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { fileURLToPath } from 'node:url';

const here = (p) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig(({ mode }) => {
  // "npm run build:demo": versão de demonstração sem servidor, num único JS + CSS
  // (usada para gerar o artefato compartilhável em scripts/make-artifact.js).
  const demo = mode === 'demo';
  return {
    root: here('./client'),
    plugins: [vue()],
    define: demo ? { 'import.meta.env.VITE_DEMO': JSON.stringify('1') } : {},
    base: demo ? './' : '/',
    build: {
      outDir: here(demo ? './dist-demo' : './dist'),
      emptyOutDir: true,
      chunkSizeWarningLimit: demo ? 1500 : 700, // three.js fica só no chunk da tela de login
      cssCodeSplit: !demo,
      assetsInlineLimit: demo ? 100_000 : 4096,
      rolldownOptions: demo ? { output: { codeSplitting: false } } : {},
    },
    server: {
      port: 5173,
      proxy: { '/api': { target: 'http://localhost:3000', changeOrigin: false } },
    },
  };
});
