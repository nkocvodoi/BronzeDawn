import { defineConfig, type Plugin } from "vite";
import { createReadStream, existsSync, statSync } from "node:fs";
import { extname, resolve, sep } from "node:path";

/** Serves web/assets-local/ at /assets-local/ on the dev server only: art and sound for playing on this
 *  machine that may not be published. It is never built into dist/ and never committed. */
function localAssets(): Plugin {
  const root = resolve(__dirname, "assets-local");
  const types: Record<string, string> = {
    ".json": "application/json", ".png": "image/png", ".webp": "image/webp", ".gif": "image/gif", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
    ".ogg": "audio/ogg", ".mp3": "audio/mpeg", ".wav": "audio/wav", ".woff2": "font/woff2", ".ttf": "font/ttf",
  };
  return {
    name: "assets-local",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use("/assets-local", (req, res, next) => {
        const path = resolve(root, "." + decodeURIComponent((req.url ?? "/").split("?")[0]));
        if (!path.startsWith(root + sep) || !existsSync(path) || !statSync(path).isFile()) return next();
        res.setHeader("content-type", types[extname(path).toLowerCase()] ?? "application/octet-stream");
        createReadStream(path).pipe(res);
      });
    },
  };
}

// base "./" so the build works from any folder, including a GitHub Pages project URL.
// gallery.html is a second page that shows every sprite, for checking the art.
export default defineConfig(({ command }) => ({
  base: "./",
  plugins: [localAssets()],
  // Whether there are manifests to read, so a game without assets asks for nothing (no 404s in the console).
  // Checked when the dev server starts or the build runs: restart the dev server after adding a manifest.
  define: {
    __PUBLIC_ASSETS__: JSON.stringify(existsSync(resolve(__dirname, "public/assets/manifest.json"))),
    __LOCAL_ASSETS__: JSON.stringify(command === "serve" && existsSync(resolve(__dirname, "assets-local/manifest.json"))),
  },
  server: { fs: { allow: [".."] } },   // the game reads ../data/rules.json, shared with the Mac build
  build: {
    target: "es2022",
    chunkSizeWarningLimit: 1500,
    rollupOptions: { input: { main: resolve(__dirname, "index.html"), gallery: resolve(__dirname, "gallery.html") } },
  },
}));
