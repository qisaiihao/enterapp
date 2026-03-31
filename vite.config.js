const path = require('path');
const { defineConfig } = require('vite');
const uni = require('@dcloudio/vite-plugin-uni').default;
const { viteCommonjs } = require('@originjs/vite-plugin-commonjs');

module.exports = defineConfig({
  plugins: [viteCommonjs(), uni()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.')
    }
  },
  optimizeDeps: {
    entries: [path.resolve(__dirname, 'index.html')]
  },
  build: {
    rollupOptions: {
      input: {
        app: path.resolve(__dirname, 'index.html')
      }
    }
  }
});
