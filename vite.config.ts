import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import { devtools } from '@tanstack/devtools-vite'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tsConfigPaths from 'vite-tsconfig-paths'
import tailwindcss from '@tailwindcss/vite'
import { cloudflare } from '@cloudflare/vite-plugin'

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
    tanstackStart(),
    react({
      babel: {
        plugins: ['babel-plugin-react-compiler'],
      },
    }),
    cloudflare({
      viteEnvironment: {
        name: 'ssr',
      },
    }),
  ],
  optimizeDeps: {
    exclude: ['@tanstack/router-devtools-core'],
  },
  ssr: {
    noExternal: ['@convex-dev/better-auth'],
  },
  envPrefix: ['VITE_'],
})
