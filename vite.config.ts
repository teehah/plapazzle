import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: '/plapazzle/',
  plugins: [react()],
  worker: {
    format: 'es',
  },
})
