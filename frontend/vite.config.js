
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import fs from 'node:fs'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    https: {
      key: fs.readFileSync('./localhost-key.pem'),
      cert: fs.readFileSync('./localhost.pem')
    }
  }
})
