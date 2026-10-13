import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ command }) => ({
  plugins: [
    react(),
    ...(command === 'serve' ? [createLocalSnapshotPlugin()] : []),
  ],
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
    open: false,
  },
  preview: {
    host: '127.0.0.1',
    port: 4173,
    strictPort: true,
    open: false,
  },
}));

function createLocalSnapshotPlugin() {
  return {
    name: 'ohora-v4-local-private-snapshot',
    apply: 'serve',
    async configureServer(server) {
      const { createLocalSnapshotMiddleware } = await import('./server/localSnapshotApi.js');
      server.middlewares.use('/api/ohora-dashboard', createLocalSnapshotMiddleware());
    },
  };
}
