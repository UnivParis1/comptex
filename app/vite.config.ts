import { fileURLToPath, URL } from 'url'

import { defineConfig } from 'vite'
import { createVuePlugin as vue } from "vite-plugin-vue2";
import shared_conf from '../shared/conf';

// https://vitejs.dev/config/
export default defineConfig({
  base: shared_conf.base_pathname,
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      'vue': 'vue/dist/vue.js', // the default does NOT have the compiler we need for "vue template"s (cf README.md)
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
