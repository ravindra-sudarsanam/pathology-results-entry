/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    // Dates in tests are formatted in a fixed zone so they never depend on the machine.
    env: { TZ: 'UTC' },
    restoreMocks: true,
  },
});
