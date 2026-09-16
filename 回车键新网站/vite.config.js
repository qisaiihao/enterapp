import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

export default defineConfig({
  plugins: [vue()],
  server: { strictPort: true },
  preview: { strictPort: true },
  build: {
    sourcemap: false,
    rollupOptions: {
      output: { manualChunks: { cloudbase: ["@cloudbase/js-sdk"] } },
    },
  },
});
