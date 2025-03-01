import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import polyfillNode from 'rollup-plugin-polyfill-node';

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(), 
    tailwindcss(),
    polyfillNode()
  ],
  define: {
    global: 'window'
  },
  optimizeDeps: {
    esbuildOptions: {
      define: {
        global: 'globalThis'
      }
    }
  },
  server: {
    proxy: {
      // Proxy REST API requests from /chess to your backend on port 8080.
      '/chess': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/chess/, '/chess'),
      },
      // Proxy WebSocket connections from /ws to your backend.
      '/ws': {
        target: 'http://localhost:8080',
        ws: true,
        changeOrigin: true,
      },
    },
  },
})
