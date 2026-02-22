import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const allowedHosts = ["localhost", "127.0.0.1"];

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": "/src",
    },
  },
  server: {
    port: 5173,
    allowedHosts,
    proxy: {
      "/api": "http://localhost:3000",
    },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});
