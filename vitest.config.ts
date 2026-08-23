import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Source files are symlinked into the native-FS workspace from /mnt/d,
  // so keep symlink paths (and let Vite resolve node_modules from /tmp)
  // rather than resolving to /mnt/d, which has no local node_modules.
  resolve: { preserveSymlinks: true },
  server: {
    fs: {
      allow: ['/mnt/d/_projects/pet_project/map_project_browser'],
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    coverage: {
      // Local-only coverage report (no CI thresholds / no Codecov upload).
      // Run with `npm run test:coverage` to see the report in `coverage/`.
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      reportsDirectory: './coverage',
      // Per AGENTS.md §9.3, WebGL/<Canvas> and SVG `d` attributes are
      // intentionally untested — exclude the 3D scene / viz renderers and
      // pure style/token modules so the report reflects only the code we
      // actually exercise.
      exclude: [
        'node_modules/',
        'src/**/*.d.ts',
        'src/vite-env.d.ts',
        'src/main.tsx',
        'src/constants/designTokens.ts',
        // 3D scene: not unit-tested (WebGL/jsdom mismatch)
        'src/components/Globe.tsx',
        'src/components/GlobeScene.tsx',
        'src/components/AuxSurface.tsx',
        'src/components/IntersectionDisks.tsx',
        'src/components/LightSource.tsx',
        'src/components/Rays.tsx',
        'src/components/CutLine.tsx',
        'src/components/TouchPointPin.tsx',
        'vitest.config.ts',
        'vitest.setup.ts',
      ],
    },
  },
});
