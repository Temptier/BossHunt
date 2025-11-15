import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: '/BossHunt/', // Your GitHub repo name
  plugins: [react()],
  server: {
    host: true,
    allowedHosts: true,
  }
});