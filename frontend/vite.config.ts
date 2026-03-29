import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // Proxy /api and /health to Modal backend
      "/api": {
        target: "https://shrestha-sachin--mana-setu-http-api-dev.modal.run",
        changeOrigin: true,
        secure: true,
      },
      "/health": {
        target: "https://shrestha-sachin--mana-setu-http-api-dev.modal.run",
        changeOrigin: true,
        secure: true,
      },
    },
  },
});
