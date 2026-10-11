import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({
  plugins: [react()],
  server: { port: Number(process.env.VITE_PORT || 5173), strictPort: true, proxy: { '/api': `http://127.0.0.1:${process.env.PORT || 3000}`, '/media': `http://127.0.0.1:${process.env.PORT || 3000}` } },
  build: { outDir: 'dist/client' },
});
