import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // DrvFS (9P) does not emit inotify events, so Vite's watcher never sees
  // edits made on /mnt/d. Poll the files instead so HMR picks up changes.
  server: { watch: { usePolling: true, interval: 500 } },
})
