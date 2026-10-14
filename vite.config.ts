/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: '/fam-game-night/',
  // Agent worktrees live inside the repo; keep their copies out of this tree's tests.
  test: { exclude: ['**/node_modules/**', '**/.claude/**', '**/dist/**'] },
})
