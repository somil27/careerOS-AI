import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";

// Standard TanStack Start + Vite configuration.
// - tsconfig paths: @/* alias
// - Tailwind v4 via @tailwindcss/vite
// - React SWC plugin
// - TanStack Start (routes, server functions, SSR, nitro build)
export default defineConfig({
  plugins: [
    tsConfigPaths(),
    tailwindcss(),
    tanstackStart({
      // Route the framework-generated server bundle through our SSR wrapper.
      server: { entry: "src/server.ts" },
    }),
    viteReact(),
  ],
  resolve: {
    dedupe: ["react", "react-dom", "@tanstack/react-router", "@tanstack/react-start"],
  },
  server: {
    host: true,
    port: Number(process.env.PORT) || 8080,
    strictPort: false,
  },
});
