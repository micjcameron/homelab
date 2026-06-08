import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    // Dev: proxy API calls to the local Nest server.
    proxy: {
      '/api': 'http://localhost:8090',
    },
  },
  build: {
    outDir: 'dist',
  },
});
