import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/performance",
  testMatch: "**/*.spec.ts",
  workers: 1,
  use: {
    channel: "msedge",
    headless: true,
    baseURL: "http://127.0.0.1:1420",
    viewport: { width: 1200, height: 900 },
  },
  webServer: {
    command: "npm run dev",
    url: "http://127.0.0.1:1420",
    reuseExistingServer: false,
    timeout: 30000,
  },
});
