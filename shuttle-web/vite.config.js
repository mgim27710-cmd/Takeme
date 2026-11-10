import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 3000,
    sourcemap: false,
  },
  server: {
    proxy: {
      '/routing': {
        target: 'http://localhost:8081',
        changeOrigin: true,
      },
      '/auth': {
        target: 'http://localhost:8081',
        changeOrigin: true,
      },
      '/parent': {
        target: 'http://localhost:8081',
        changeOrigin: true,
      },
      '/teacher': {
        target: 'http://localhost:8081',
        changeOrigin: true,
      },
      '/chat': {
        target: 'http://localhost:8081',
        changeOrigin: true,
      },
      '/approval': {
        target: 'http://localhost:8081',
        changeOrigin: true,
      },
      '/directions': {
        target: 'http://localhost:8081',
        changeOrigin: true,
      },
      '/socket.io': {
        target: 'http://localhost:8081',
        ws: true,
        changeOrigin: true,
      },
    },
  },
})
