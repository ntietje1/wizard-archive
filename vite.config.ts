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
      // customViteReactPlugin: true,
    }),
    react({
      babel: {
        plugins: ['babel-plugin-react-compiler'],
      },
    }),
    // {
    //   name: 'fix-better-auth-optimize',
    //   configResolved(config) {
    //     const exclude = config.optimizeDeps.exclude
    //     const idx = exclude?.indexOf('better-auth')
    //     if (idx != null && idx >= 0) {
    //       exclude.splice(idx, 1)
    //     }
    //   },
    // },
  ],
  optimizeDeps: {
    exclude: ['@tanstack/router-devtools-core'],
  },
  ssr: {
    noExternal: ['@convex-dev/better-auth'],
  },
  envPrefix: ['VITE_'],
})
