/**
 * Playwright Configuration for E2E Testing
 *
 * Document Generator - Phase 2: Async Collaboration
 */

import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
    testDir: "./e2e",
    testMatch: "**/*.spec.ts",

    /* Run tests in files in parallel */
    fullyParallel: true,

    /* Fail the build on CI if you accidentally left test.only in the source code */
    forbidOnly: !!process.env.CI,

    /* Retry on CI only */
    retries: process.env.CI ? 2 : 0,

    /* Opt out of parallel tests on CI */
    workers: process.env.CI ? 1 : undefined,

    /* Reporter to use */
    reporter: [
        ["html", { open: "never" }],
        ["list"],
        ...(process.env.CI ? [["github"] as const] : []),
    ],

    /* Shared settings for all the projects below */
    use: {
        /* Base URL to use in actions like `await page.goto('/')` */
        baseURL: process.env.TEST_BASE_URL || "http://localhost:5173",

        /* Collect trace when retrying the failed test */
        trace: "on-first-retry",

        /* Screenshot on failure */
        screenshot: "only-on-failure",

        /* Video on failure */
        video: "on-first-retry",

        /* Timeout for actions */
        actionTimeout: 10000,
    },

    /* Configure projects for major browsers */
    projects: [
        {
            name: "chromium",
            use: { ...devices["Desktop Chrome"] },
        },

        {
            name: "firefox",
            use: { ...devices["Desktop Firefox"] },
        },

        {
            name: "webkit",
            use: { ...devices["Desktop Safari"] },
        },

        /* Test against mobile viewports */
        {
            name: "Mobile Chrome",
            use: { ...devices["Pixel 5"] },
        },

        {
            name: "Mobile Safari",
            use: { ...devices["iPhone 12"] },
        },
    ],

    /* Run your local dev server before starting the tests */
    webServer: [
        {
            command: "npm run dev",
            url: "http://localhost:5173",
            reuseExistingServer: true,  // Always reuse if already running
            timeout: 120000,
        },
    ],

    /* Global test timeout */
    timeout: 30000,

    /* Expect timeout */
    expect: {
        timeout: 5000,
    },

    /* Output folder for test artifacts */
    outputDir: "test-results/",

    /* Folder for test artifacts on failure */
    snapshotDir: "snapshots/",
});
