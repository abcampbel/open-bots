import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    restoreMocks: true,
    coverage: {
      provider: 'v8',
      include: ['api/**/*.ts', 'src/lib/**/*.ts'],
      reporter: ['text', 'lcov'],
    },
  },
});
