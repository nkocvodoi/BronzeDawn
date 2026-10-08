import { defineConfig } from "vite";

// base "./" so the build works from any folder, including a GitHub Pages project URL.
export default defineConfig({
  base: "./",
  server: { fs: { allow: [".."] } },   // the game reads ../data/rules.json, shared with the Mac build
  build: { target: "es2022", chunkSizeWarningLimit: 1500 },
});
