import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const apiTarget = env.VITE_API_PROXY_TARGET || 'http://localhost:5000'

  return {
    plugins: [
      react(),
      tailwindcss(),
    ],
    resolve: {
      alias: { '@': path.resolve(__dirname, './src') }
    },
    // Proxy API calls to the backend during dev AND build-preview
    server: {
      proxy: {
        '/api': apiTarget,
        '/uploads': apiTarget,
      },
    },
    preview: {
      proxy: {
        '/api': apiTarget,
        '/uploads': apiTarget,
      },
    },
  }
})
