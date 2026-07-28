import { defineConfig } from 'vite';

// `base` is set from an environment variable so a GitHub Pages deploy, which serves
// the site from /<repo-name>/, does not end up as a blank white page.
export default defineConfig({
  base: process.env.VITE_BASE ?? '/',
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
});
