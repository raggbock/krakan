import { defineConfig } from 'vitest/config'
import path from 'path'
import { createRequire } from 'module'

// In git worktrees the local web/node_modules is empty; point vite's resolver
// at the main project's web/node_modules so test dependencies are found.
const MAIN_WEB_MODULES = path.resolve(__dirname, '../../../../web/node_modules')
const MAIN_ROOT_MODULES = path.resolve(__dirname, '../../../../node_modules')

// Resolve a package from the main project's node_modules
function mainPkg(pkg: string): string {
  return path.resolve(MAIN_WEB_MODULES, pkg)
}

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
      // Redirect bare specifiers that vite can't find in the empty local
      // node_modules to the main project's installed packages.
      '@testing-library/jest-dom/vitest': mainPkg('@testing-library/jest-dom/vitest'),
      '@testing-library/jest-dom': mainPkg('@testing-library/jest-dom'),
      '@testing-library/react': mainPkg('@testing-library/react'),
'react-leaflet': mainPkg('react-leaflet'),
      'leaflet': mainPkg('leaflet'),
      'leaflet/dist/leaflet.css': mainPkg('leaflet/dist/leaflet.css'),
    },
    moduleDirectories: [
      'node_modules',
      MAIN_WEB_MODULES,
      MAIN_ROOT_MODULES,
    ],
  },
})
