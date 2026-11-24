import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const testDb = process.env.TEST_DATABASE_URL ?? "postgresql://postgres@localhost:5432/clearance_test";

export default defineConfig({
    resolve: {
        alias: {
            "@": fileURLToPath(new URL("./src", import.meta.url)),
            // `server-only` throws outside the react-server condition; tests run plain Node.
            "server-only": fileURLToPath(new URL("./tests/helpers/empty.ts", import.meta.url)),
        },
    },
    test: {
        include: ["tests/**/*.test.ts"],
        environment: "node",
        globalSetup: ["./tests/helpers/global-setup.ts"],
        env: { DATABASE_URL: testDb, TZ: "Asia/Baghdad" },
        // Integration tests share one database; run files one after another.
        fileParallelism: false,
        testTimeout: 20_000,
    },
});
