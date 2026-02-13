import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  resolve: {
    dedupe: ["react", "react-dom"],
  },
  server: {
    // 1. Autoriser l'URL ngrok
    allowedHosts: true,

    // 2. CORRECTION CRITIQUE POUR NGROK (Règle l'erreur de la 2ème image)
    hmr: {
      clientPort: 443, // Force le client à passer par le port HTTPS standard
    },

    // 3. Le Proxy pour votre Socket.io
    proxy: {
      "/socket.io": {
        target: "http://localhost:3001",
        changeOrigin: true,
        secure: false,
        ws: true, // Important pour les websockets
      },
      "/api": {
        target: "http://localhost:3001",
        changeOrigin: true,
        secure: false,
      },
      "/blindtest": {
        target: "http://127.0.0.1:3001",
        changeOrigin: true,
      },
    },
  },
});
