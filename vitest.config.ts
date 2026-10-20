import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'unit',
          globals: true,
          environment: 'jsdom',
          setupFiles: './src/test/setup.ts',
          include: ['src/**/*.test.{ts,tsx}'],
        },
      },
      {
        // Headless Rapier regression suite (GAME_REVIEW.md §4-A). Real physics, no mocks.
        test: {
          name: 'physics',
          environment: 'node',
          include: ['tests/physics/**/*.test.ts'],
          testTimeout: 120_000,
        },
      },
    ],
  },
})
