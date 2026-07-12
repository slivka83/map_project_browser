import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  // Source files are symlinked into this native-FS workspace from the
  // /mnt/d project (DrvFS blocks a local node_modules there). Keep symlink
  // paths so Vite resolves everything within this root instead of /mnt/d.
  resolve: { preserveSymlinks: true },
  plugins: [react(), tailwindcss()],
})
