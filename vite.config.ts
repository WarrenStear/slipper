import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  assetsInclude: ["**/*.glb", "**/*.gltf", "**/*.ktx2", "**/*.wasm"],
  worker: {
    format: "es",
  },
  optimizeDeps: {
    include: ["three", "@react-three/fiber", "@react-three/drei", "@react-three/rapier"],
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    sourcemap: false,
    assetsInlineLimit: 0,
    chunkSizeWarningLimit: 1400,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (
            id.includes("/node_modules/react/") ||
            id.includes("/node_modules/react-dom/") ||
            id.includes("/node_modules/scheduler/") ||
            id.includes("/node_modules/zustand/") ||
            id.includes("/node_modules/use-sync-external-store/") ||
            id.includes("vite/preload-helper")
          ) {
            return "react-vendor";
          }
          if (id.includes("@dimforge/rapier3d-compat")) return "rapier-wasm";
          if (id.includes("@react-three/rapier")) return "physics";
          if (
            id.includes("@react-three/fiber") ||
            id.includes("@react-three/drei") ||
            id.includes("/node_modules/react-reconciler/") ||
            id.includes("/node_modules/its-fine/") ||
            id.includes("/node_modules/react-use-measure/") ||
            id.includes("/node_modules/suspend-react/")
          ) {
            return "r3f";
          }
          if (id.includes("/node_modules/three/")) return "three";
          return undefined;
        },
      },
    },
  },
});
