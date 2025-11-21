import { fileURLToPath, URL } from 'url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import shared_conf from '../shared/conf.ts';

// https://vitejs.dev/config/
export default defineConfig({
  base: shared_conf.base_pathname,
  plugins: [vue()],
  //build: { minify: false },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      'vue': 'vue/dist/vue.esm-bundler.js', // the default does NOT have the compiler we need for "vue template"s (cf README.md)
    },
  },
  server: {
    fs: {
        allow: ['../shared', '.'], // NB: when "base" is "/", this is not needed. Looks like a bug in vite
    },
    proxy: {
        '/api': {
            target: 'http://localhost:8000',
            xfwd: true,
        },
    },
  },
})
