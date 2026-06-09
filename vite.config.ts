import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';
import { defineConfig, loadEnv } from 'vite';
import { execSync } from 'child_process';

function voiceGenPlugin() {
  return {
    name: 'voice-gen',
    buildStart() {
      const script = path.resolve(__dirname, 'scripts', 'generate', 'voices.py');
      if (!fs.existsSync(script)) return;
      const isBuild = process.env.VITE_VOICE_GEN === '1';
      if (isBuild) {
        try {
          execSync(`python3 "${script}"`, { stdio: 'inherit', cwd: __dirname, timeout: 300000 });
        } catch (e) {
          console.warn('[voice-gen] Failed to generate voices:', e);
        }
      } else {
        console.log('[voice-gen] Skipping voice generation (set VITE_VOICE_GEN=1 to enable)');
      }
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [voiceGenPlugin(), react(), tailwindcss()],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'src'),
      },
    },
    build: {
      chunkSizeWarningLimit: 750,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules/lucide-react')) return 'lucide';
            if (id.includes('/src/game_data.json')) return 'game-data';
            if (id.includes('node_modules/motion')) return 'motion';
            if (id.includes('node_modules/sonner')) return 'sonner';
            return undefined;
          },
        },
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      port: 3000,
      host: '0.0.0.0',
    },
  };
});
