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
  },
});
