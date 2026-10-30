import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  const aiAsistentEnv =
    env.AI_ASISTENT ??
    process.env.AI_ASISTENT ??
    env.VITE_AI_ASISTENT ??
    process.env.VITE_AI_ASISTENT ??
    'FALSE';

  return {
    plugins: [react(), tailwindcss()],
    envPrefix: ['VITE_', 'AI_'],
    define: {
      'process.env.AI_ASISTENT': JSON.stringify(aiAsistentEnv),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
