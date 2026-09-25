import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { fileURLToPath } from "node:url";

export default defineConfig({
  plugins: [vue()],
  server: { strictPort: true },
  preview: { strictPort: true },
  build: {
    sourcemap: false,
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL("./index.html", import.meta.url)),
        classic: fileURLToPath(
          new URL("./classic/index.html", import.meta.url),
        ),
      },
      output: { manualChunks: { cloudbase: ["@cloudbase/js-sdk"] } },
    },
  },
});
