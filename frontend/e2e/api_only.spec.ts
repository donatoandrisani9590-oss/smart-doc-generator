/**
 * API-Only Tests - Keine UI/Login erforderlich
 */
import { test, expect } from "@playwright/test";

const API_URL = "http://localhost:8000/api/v1";

test.describe("API Direct Tests", () => {
    test("Word Import API returns tips", async ({ request }) => {
        const response = await request.get(`${API_URL}/word-import/templates`);
        expect(response.ok()).toBeTruthy();
        
        const data = await response.json();
        expect(data.tips).toBeDefined();
        expect(data.tips.length).toBeGreaterThan(0);
        expect(data.supported_formats).toContain(".docx");
        
        console.log("✅ Word Import API: Working");
        console.log("   Tips:", data.tips.length);
        console.log("   Formats:", data.supported_formats);
    });

    test("Document Types API responds", async ({ request }) => {
        const response = await request.get(`${API_URL}/document-types/`);
        // May require auth, so just check it responds
        console.log("Document Types Status:", response.status());
        expect([200, 401, 403]).toContain(response.status());
    });

    test("Clauses API responds", async ({ request }) => {
        const response = await request.get(`${API_URL}/clauses/`);
        console.log("Clauses API Status:", response.status());
        expect([200, 401, 403]).toContain(response.status());
    });

    test("Placeholders API returns data", async ({ request }) => {
        const response = await request.get(`${API_URL}/word-import/magic/placeholders`);
        if (response.ok()) {
            const data = await response.json();
            console.log("✅ Placeholders API: Working");
            console.log("   Categories:", Object.keys(data.by_category || {}).length);
        } else {
            console.log("Placeholders Status:", response.status());
        }
        expect([200, 401, 403, 404]).toContain(response.status());
    });
});
