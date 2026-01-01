import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import { devtools } from '@tanstack/devtools-vite'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tsConfigPaths from 'vite-tsconfig-paths'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  server: {
    port: 3000,
  },
  plugins: [
    tailwindcss(),
    devtools(),
    tsConfigPaths({
      projects: ['./tsconfig.json'],
    }),
    tanstackStart({
      customViteReactPlugin: true,
    }),
    react(),
  ],
  optimizeDeps: {
    exclude: ['@tanstack/router-devtools-core'],
  },
  envPrefix: ['VITE_', 'CLERK_'],
})
