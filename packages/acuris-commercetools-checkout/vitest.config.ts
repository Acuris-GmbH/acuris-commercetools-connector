import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    setupFiles: ["./test/setup.ts"],
    include: ["test/**/*.test.tsx", "test/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.{ts,tsx}"],
      exclude: ["src/**/index.ts", "**/*.d.ts"],
      thresholds: {
        // boundary.ts has many defensive `??` fallbacks that inflate branch
        // count without meaningful test value; threshold tuned to 65.
        lines: 75,
        statements: 75,
        functions: 75,
        branches: 65,
      },
      reporter: ["text", "html"],
    },
  },
});
