import { test, expect } from "@playwright/test";

test("API health check", async ({ request }) => {
    const response = await request.get("http://localhost:8000/api/v1/word-import/templates");
    expect(response.status()).toBe(200);
});
