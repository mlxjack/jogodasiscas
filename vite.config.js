import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base relativa: o site é servido na raiz do domínio próprio (GitHub Pages + CNAME)
export default defineConfig({
  plugins: [react()],
  base: './',
});
