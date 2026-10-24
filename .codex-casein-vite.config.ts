import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const appRoot = 'D:/учебники/case-in/.codex-casein-preview'

export default defineConfig({
  root: appRoot,
  cacheDir: 'D:/учебники/case-in/.codex-casein-vite-cache',
  plugins: [react()],
  optimizeDeps: { include: ['react', 'react-dom/client', 'lucide-react'] },
  server: { host: '127.0.0.1', port: 5180, strictPort: true },
})
