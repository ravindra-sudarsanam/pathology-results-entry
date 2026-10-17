/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    // Dates in tests are formatted in a fixed zone so they never depend on the machine.
    env: { TZ: 'UTC' },
    restoreMocks: true,
    coverage: {
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/__tests__/**',
        'src/test/**',
        'src/main.tsx',
        'src/mocks/browser.ts',
        'src/**/*.d.ts',
        'src/domain/types.ts',
      ],
    },
  },
});
