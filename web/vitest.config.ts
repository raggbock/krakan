import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    exclude: ['node_modules', 'dist', '.next', '.open-next', 'e2e/**'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      // node_modules/@fyndstigen/shared is a hoisted symlink that points at the
      // main repo's packages/shared, not this worktree's. Aliasing here makes
      // vitest resolve the in-tree source so worktree-local changes are visible
      // to tests. Harmless on main — the alias still points at the same path.
      '@fyndstigen/shared/deps-factory': path.resolve(__dirname, '../packages/shared/src/deps-factory.ts'),
      '@fyndstigen/shared': path.resolve(__dirname, '../packages/shared/src/index.ts'),
    },
  },
})
