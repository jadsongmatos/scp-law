import { defineConfig } from 'vitest/config';
import path from 'path';

// Isolated test config: pure-logic unit tests only. Deliberately does NOT
// load the game's Vite plugins (voice-gen/python, react, tailwind) so tests
// stay fast and free of build side effects.
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
