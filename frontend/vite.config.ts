import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  // Relative paths so the built site works at any address (Netlify, Vercel, GitHub Pages sub-folder).
  base: './',
  plugins: [react()],
})
