import { defineConfig } from 'vitest/config';

// Only pure TypeScript modules are tested here — nothing that imports
// react-native, which Vitest's node environment cannot resolve.
export default defineConfig({
  resolve: {
    // Mirror the `@/* -> src/*` mapping in tsconfig.json; without it Vitest
    // cannot resolve the type-only imports the source files use.
    // `.pathname` rather than node:url's fileURLToPath: this file is checked
    // by the app's tsc run, which has the DOM URL lib loaded and would flag
    // the node:url overload as a mismatched URL type.
    alias: {
      '@': new URL('./src/', import.meta.url).pathname,
    },
  },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    globals: false,
  },
});
