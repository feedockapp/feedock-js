import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    // Only source specs — never the compiled dist/*.spec.js the build emits.
    include: ["src/**/*.spec.ts"],
  },
});
