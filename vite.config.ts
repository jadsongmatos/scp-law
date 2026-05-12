import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';
import {defineConfig, loadEnv} from 'vite';
import {execSync} from 'child_process';

function voiceGenPlugin() {
  return {
    name: 'voice-gen',
    buildStart() {
      const script = path.resolve(__dirname, 'generate_voices.py');
      if (!fs.existsSync(script)) return;
      const isBuild = process.env.VITE_VOICE_GEN === '1';
      if (isBuild) {
        try {
          execSync(`python3 "${script}"`, {stdio: 'inherit', cwd: __dirname, timeout: 300000});
        } catch (e) {
          console.warn('[voice-gen] Failed to generate voices:', e);
        }
      } else {
        console.log('[voice-gen] Skipping voice generation (set VITE_VOICE_GEN=1 to enable)');
      }
    },
  };
}

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [voiceGenPlugin(), react(), tailwindcss()],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      chunkSizeWarningLimit: 600,
      rollupOptions: {
        output: {
          manualChunks: {
            'lucide': ['lucide-react'],
            'game-data': ['./src/game_data.json'],
          },
        },
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
