import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
  plugins: [svelte()],
  base: './',
  server: { fs: { allow: ['.'] } },
  test: { include: ['tests/**/*.test.js'] },
});
