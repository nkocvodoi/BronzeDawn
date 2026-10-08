import { defineConfig } from "vite";
import { resolve } from "node:path";

// base "./" so the build works from any folder, including a GitHub Pages project URL.
// gallery.html is a second page that shows every sprite, for checking the art.
export default defineConfig({
  base: "./",
  server: { fs: { allow: [".."] } },   // the game reads ../data/rules.json, shared with the Mac build
  build: {
    target: "es2022",
    chunkSizeWarningLimit: 1500,
    rollupOptions: { input: { main: resolve(__dirname, "index.html"), gallery: resolve(__dirname, "gallery.html") } },
  },
});
