import { defineConfig, loadEnv } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'


function figmaAssetResolver() {
  return {
    name: 'figma-asset-resolver',
    resolveId(id) {
      if (id.startsWith('figma:asset/')) {
        const filename = id.replace('figma:asset/', '')
        return path.resolve(__dirname, 'src/assets', filename)
      }
    },
  }
}

export default defineConfig(({ mode, command }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const proxyTarget =
    process.env.VITE_API_PROXY_TARGET ||
    env.VITE_API_PROXY_TARGET

  if (command === 'serve' && !proxyTarget) {
    throw new Error('VITE_API_PROXY_TARGET is required for the development proxy')
  }

  return {
    plugins: [
      figmaAssetResolver(),
      // The React and Tailwind plugins are both required for Make, even if
      // Tailwind is not being actively used – do not remove them
      react(),
      tailwindcss(),
    ],
    resolve: {
      alias: {
        // Alias @ to the src directory
        '@': path.resolve(__dirname, './src'),
      },
    },
    optimizeDeps: {
      include: ['three', 'three/addons/controls/OrbitControls.js'],
    },
    server: {
      host: 'localhost',
      port: 5188,
      strictPort: true,
      watch: { ignored: ['**/*.test.ts', '**/*.test.tsx'] },
      proxy: proxyTarget ? {
        '/backend-api': {
          target: proxyTarget,
          changeOrigin: true,
          rewrite: (requestPath) => requestPath.replace(/^\/backend-api/, ''),
        },
      } : undefined,
    },
    build: {
      emptyOutDir: true,
      chunkSizeWarningLimit: 600,
      rollupOptions: {
        output: {
          manualChunks: {
            financialCharts: ['lightweight-charts'],
            analyticsCharts: ['recharts'],
          },
        },
      },
    },
    // File types to support raw imports. Never add .css, .tsx, or .ts files to this.
    assetsInclude: ['**/*.svg', '**/*.csv'],
  }
})
