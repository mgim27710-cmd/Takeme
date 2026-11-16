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
        target: 'https://52.63.245.203.sslip.io',
        secure: false,
        changeOrigin: true,
      },
      '/auth': {
        target: 'https://52.63.245.203.sslip.io',
        secure: false,
        changeOrigin: true,
      },
      '/parent': {
        target: 'https://52.63.245.203.sslip.io',
        secure: false,
        changeOrigin: true,
      },
      '/teacher': {
        target: 'https://52.63.245.203.sslip.io',
        secure: false,
        changeOrigin: true,
      },
      '/chat': {
        target: 'https://52.63.245.203.sslip.io',
        secure: false,
        changeOrigin: true,
      },
      '/approval': {
        target: 'https://52.63.245.203.sslip.io',
        secure: false,
        changeOrigin: true,
      },
      '/directions': {
        target: 'https://52.63.245.203.sslip.io',
        secure: false,
        changeOrigin: true,
      },
      '/socket.io': {
        target: 'https://52.63.245.203.sslip.io',
        secure: false,
        ws: true,
        changeOrigin: true,
      },
    },
  },
})
