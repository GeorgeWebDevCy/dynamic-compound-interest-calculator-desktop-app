import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  base: './', // ensure assets resolve when loaded from file:// in Electron builds
  plugins: [react()],
})
