import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["test/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: ["src/**/index.ts", "**/*.d.ts"],
      thresholds: {
        lines: 75,
        statements: 75,
        functions: 80,
        branches: 70,
      },
      reporter: ["text", "html"],
    },
  },
});
