import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    open: true,
  },
  build: {
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor_react: ["react", "react-dom", "react-router-dom"],
          vendor_charts: ["recharts"],
          vendor_motion: ["framer-motion"],
          vendor_markdown: ["react-markdown", "remark-gfm", "rehype-highlight", "highlight.js"],
          vendor_supabase: ["@supabase/supabase-js"],
        },
      },
    },
  },
});
