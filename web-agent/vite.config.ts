import path from "path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"
import tsconfigPaths from "vite-tsconfig-paths"

export default defineConfig({
  plugins: [react(), tailwindcss(), tsconfigPaths()],
  resolve: {
    alias: {
      // This alias is for shadcn/ui
      "@": path.resolve(__dirname, "./src"),
      "src": path.resolve(__dirname, "./src"),
    },
    extensions: ['.ts', '.tsx', '.js', '.jsx', '.json'],
  },
  build: {
    // Ensure TypeScript paths are resolved correctly
    rollupOptions: {
      external: [],
    },
  },
  // Add the proxy for API requests
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:8001",
        changeOrigin: true, // Recommended for virtual hosted sites
        secure: false,      // If your backend is not using HTTPS
      },
    },
  },
})