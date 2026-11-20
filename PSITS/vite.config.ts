import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const pretty = mode === "pretty";

  return {
    plugins: [react()],
    resolve: {
      alias: {
        "@": fileURLToPath(new URL("./src", import.meta.url)),
      },
    },
    server: {
      // Avoid CORS issues in dev by proxying API requests through Vite.
      proxy: {
        "/api": {
          target: "http://localhost:3000",
          changeOrigin: true,
        },
        "/uploads": {
          target: "http://localhost:3000",
          changeOrigin: true,
        },
        "/socket.io": {
          target: "http://localhost:3000",
          changeOrigin: true,
          ws: true,
        },
      },
    },
    build: pretty
      ? {
          // "Pretty" output for reviewing CSS/JS
          minify: false,
          cssMinify: false,
          sourcemap: true,
        }
      : {
          rollupOptions: {
            output: {
              manualChunks(id) {
                if (id.includes("node_modules")) {
                  if (id.includes("recharts") || id.includes("d3-")) {
                    return "vendor-charts";
                  }
                  if (id.includes("xlsx")) {
                    return "vendor-xlsx";
                  }
                  if (id.includes("lucide-react")) {
                    return "vendor-icons";
                  }
                }
                return undefined;
              },
            },
          },
        },
    test: {
      environment: 'jsdom',
      setupFiles: ['./jest.setup.ts'],
      globals: true,
      exclude: ['node_modules', 'dist', 'tests/**'],
    },
  };
});
