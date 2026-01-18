import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [react()],
    base: '/',
    server: {
        host: true,  // Expose on network for mobile testing
        port: 5173,
        allowedHosts: ['localhost', '.ngrok-free.dev', '.ngrok.io']
    },
    build: {
        outDir: 'dist',
    }
})
