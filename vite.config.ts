import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwind from "@tailwindcss/vite";
export default defineConfig({
  plugins: [react(), tailwind()],
  server: { port: 1420, strictPort: true },
  test: { environment: "jsdom", include: ["tests/unit/**/*.test.{ts,tsx}"] },
});
