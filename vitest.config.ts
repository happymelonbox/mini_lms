import path from "node:path";
import { defineConfig } from "vitest/config";

const alias = { "@": path.resolve(__dirname) };
// Projects do not inherit root test options, so each one spreads this.
const common = { clearMocks: true, unstubGlobals: true, unstubEnvs: true };

export default defineConfig({
  test: {
    projects: [
      {
        resolve: { alias },
        test: {
          ...common,
          name: "unit",
          include: ["{app,components,hooks,lib}/**/*.test.ts", "proxy.test.ts", "tests/*.test.ts"],
        },
      },
      {
        resolve: { alias },
        test: {
          ...common,
          name: "components",
          include: ["**/*.test.tsx"],
          exclude: ["**/node_modules/**", "**/.next/**"],
          environment: "jsdom",
          setupFiles: ["tests/setup-components.ts"],
        },
      },
      {
        resolve: { alias },
        test: {
          ...common,
          name: "integration",
          include: ["tests/integration/**/*.test.ts"],
          setupFiles: ["tests/integration/setup.ts"],
        },
      },
    ],
  },
});
