import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  server: {
    port: 5173,
    allowedHosts: true,
    hmr: false,
    proxy: {
      '/api': {
        target: 'http://localhost:5283',
        changeOrigin: true,
        secure: false,
      },
      '/swagger': {
        target: 'http://localhost:5283',
        changeOrigin: true,
        secure: false,
      },
      '/attendance_photos': {
        target: 'http://localhost:5283',
        changeOrigin: true,
        secure: false,
      }
    }
  }
})
