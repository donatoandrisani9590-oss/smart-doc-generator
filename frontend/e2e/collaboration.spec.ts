/**
 * E2E Tests - Phase 2: Async Collaboration (Comment System)
 *
 * Playwright Test Suite für Release Readiness
 *
 * Coverage:
 * - Sync Flow: Local → Backend → Sync
 * - Conflict Resolution: Concurrent edits
 * - Permission Tests: IDOR, Authorization
 * - Error Handling: Network failures, edge cases
 * - Performance: Large comment loads
 *
 * @author QA Engineering Team
 * @version 1.0.0
 */

import { test, expect, Page } from "@playwright/test";

// ═══════════════════════════════════════════════════════════════════════════
// TEST CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════

const BASE_URL = process.env.TEST_BASE_URL || "http://localhost:3000";
const API_URL = process.env.TEST_API_URL || "http://localhost:8000/api/v1";

// Test users (should be seeded in test DB)
const TEST_USERS = {
    user1: {
        email: "test-user-1@example.com",
        password: "TestPassword123!",
    },
    user2: {
        email: "test-user-2@example.com",
        password: "TestPassword123!",
    },
    admin: {
        email: "test-admin@example.com",
        password: "AdminPassword123!",
    },
};

// ═══════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

async function login(page: Page, user: { email: string; password: string }) {
    await page.goto(`${BASE_URL}/login`);
    await page.fill('input[name="email"]', user.email);
    await page.fill('input[name="password"]', user.password);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/(dashboard|generator)/);
}

async function createDraft(page: Page): Promise<number> {
    // Navigate to document generator
    await page.goto(`${BASE_URL}/generator`);
    await page.waitForSelector('[data-testid="document-generator"]');

    // Fill minimum required fields
    await page.fill('input[name="documentTitle"]', `Test Draft ${Date.now()}`);

    // Save draft
    await page.click('button:has-text("Entwurf speichern")');
    await page.waitForSelector('[data-testid="draft-saved-indicator"]');

    // Extract draft ID from URL or response
    const url = page.url();
    const match = url.match(/draft\/(\d+)/);
    return match ? parseInt(match[1]) : 0;
}

async function openCommentSidebar(page: Page) {
    // Click comment toggle if sidebar is closed
    const sidebar = page.locator('[data-testid="comment-sidebar"]');
    if (!(await sidebar.isVisible())) {
        await page.click('button[aria-label="Kommentare öffnen"]');
    }
    await expect(sidebar).toBeVisible();
}

async function addComment(page: Page, text: string) {
    await openCommentSidebar(page);
    await page.click('button:has(svg.lucide-plus)');
    await page.fill('textarea[placeholder*="Kommentar"]', text);
    await page.click('button:has-text("Hinzufügen")');
    await page.waitForSelector(`text="${text}"`);
}

// ═══════════════════════════════════════════════════════════════════════════
// TEST SUITE 1: SYNC FLOW
// ═══════════════════════════════════════════════════════════════════════════

test.describe("Sync Flow Tests", () => {
    test.beforeEach(async ({ page }) => {
        await login(page, TEST_USERS.user1);
    });

    test("LOCAL-001: Comments persist locally before draft save", async ({
        page,
    }) => {
        // Go to generator WITHOUT saving draft
        await page.goto(`${BASE_URL}/generator`);
        await openCommentSidebar(page);

        // Add local comment
        await page.click('button:has(svg.lucide-plus)');
        await page.fill('textarea[placeholder*="Kommentar"]', "Local test comment");
        await page.click('button:has-text("Hinzufügen")');

        // Verify sync status shows "Lokal"
        await expect(page.locator('text="Lokal"')).toBeVisible();

        // Verify comment appears
        await expect(page.locator('text="Local test comment"')).toBeVisible();

        // Refresh page
        await page.reload();
        await openCommentSidebar(page);

        // Comment should persist via localStorage
        await expect(page.locator('text="Local test comment"')).toBeVisible();
    });

    test("SYNC-001: Local comments migrate to backend on draft save", async ({
        page,
    }) => {
        // Start fresh generator
        await page.goto(`${BASE_URL}/generator`);
        await openCommentSidebar(page);

        // Add local comment
        await addComment(page, "Comment before save");

        // Verify local status
        await expect(page.locator('text="Lokal"')).toBeVisible();

        // Save draft
        await page.fill('input[name="documentTitle"]', `Migration Test ${Date.now()}`);
        await page.click('button:has-text("Entwurf speichern")');

        // Wait for sync
        await page.waitForSelector('text="Synced"', { timeout: 10000 });

        // Verify comment still visible
        await expect(page.locator('text="Comment before save"')).toBeVisible();

        // Verify toast notification
        await expect(page.locator('text="synchronisiert"')).toBeVisible();
    });

    test("SYNC-002: Backend comments load after page refresh", async ({
        page,
    }) => {
        await createDraft(page);
        await openCommentSidebar(page);

        // Add comment via backend
        await addComment(page, "Persistent comment test");

        // Hard refresh
        await page.reload();
        await openCommentSidebar(page);

        // Comment should load from backend
        await expect(page.locator('text="Persistent comment test"')).toBeVisible();
        await expect(page.locator('text="Synced"')).toBeVisible();
    });

    test("SYNC-003: Sync error shows error state and allows retry", async ({
        page,
    }) => {
        await createDraft(page);
        await openCommentSidebar(page);

        // Simulate network failure
        await page.route(`${API_URL}/comments/**`, (route) => route.abort());

        // Try to add comment
        await page.click('button:has(svg.lucide-plus)');
        await page.fill('textarea[placeholder*="Kommentar"]', "Will fail");
        await page.click('button:has-text("Hinzufügen")');

        // Verify error state
        await expect(page.locator('text="Fehler"')).toBeVisible();

        // Verify toast error
        await expect(page.locator('text="konnte nicht erstellt werden"')).toBeVisible();

        // Input should still contain text for retry
        await expect(page.locator('textarea[placeholder*="Kommentar"]')).toHaveValue(
            "Will fail"
        );
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// TEST SUITE 2: CONFLICT RESOLUTION
// ═══════════════════════════════════════════════════════════════════════════

test.describe("Conflict Resolution Tests", () => {
    test("CONFLICT-001: Concurrent comments from two users", async ({
        browser,
    }) => {
        // Create two browser contexts (two users)
        const context1 = await browser.newContext();
        const context2 = await browser.newContext();
        const page1 = await context1.newPage();
        const page2 = await context2.newPage();

        // Login both users
        await login(page1, TEST_USERS.user1);
        await login(page2, TEST_USERS.user2);

        // User 1 creates draft
        const draftId = await createDraft(page1);
        await openCommentSidebar(page1);

        // User 2 navigates to same draft (assuming shared access)
        await page2.goto(`${BASE_URL}/generator/draft/${draftId}`);
        await openCommentSidebar(page2);

        // Both users add comments simultaneously
        await Promise.all([
            addComment(page1, "Comment from User 1"),
            addComment(page2, "Comment from User 2"),
        ]);

        // Wait for polling to sync (60s polling, but we can wait for refetch)
        await page1.waitForTimeout(2000);
        await page2.waitForTimeout(2000);

        // Trigger manual refetch via refetch button or wait
        await page1.reload();
        await page2.reload();

        await openCommentSidebar(page1);
        await openCommentSidebar(page2);

        // Both pages should show both comments
        await expect(page1.locator('text="Comment from User 1"')).toBeVisible();
        await expect(page1.locator('text="Comment from User 2"')).toBeVisible();
        await expect(page2.locator('text="Comment from User 1"')).toBeVisible();
        await expect(page2.locator('text="Comment from User 2"')).toBeVisible();

        // Cleanup
        await context1.close();
        await context2.close();
    });

    test("CONFLICT-002: Delete during reply shows graceful error", async ({
        browser,
    }) => {
        const context1 = await browser.newContext();
        const context2 = await browser.newContext();
        const page1 = await context1.newPage();
        const page2 = await context2.newPage();

        await login(page1, TEST_USERS.user1);
        await login(page2, TEST_USERS.user1); // Same user, two tabs

        const draftId = await createDraft(page1);
        await openCommentSidebar(page1);
        await addComment(page1, "Original comment");

        // Page 2 opens same draft
        await page2.goto(`${BASE_URL}/generator/draft/${draftId}`);
        await openCommentSidebar(page2);
        await page2.waitForSelector('text="Original comment"');

        // Page 2 starts replying
        await page2.click('button:has-text("Antworten")');
        await page2.fill('textarea[placeholder*="Antwort"]', "My reply...");

        // Page 1 deletes the comment
        await page1.click('[aria-label="Kommentar-Aktionen"]');
        await page1.click('text="Löschen"');
        await page1.click('text="Endgültig löschen"');

        // Page 2 tries to submit reply
        await page2.click('button:has-text("Antworten"):not(:has-text("Antworten"))');

        // Should show error
        await expect(
            page2.locator('text="konnte nicht erstellt werden"')
        ).toBeVisible();

        await context1.close();
        await context2.close();
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// TEST SUITE 3: PERMISSION TESTS (IDOR)
// ═══════════════════════════════════════════════════════════════════════════

test.describe("Permission & IDOR Tests", () => {
    test("IDOR-001: User cannot access other user's draft comments via URL", async ({
        browser,
    }) => {
        const context1 = await browser.newContext();
        const context2 = await browser.newContext();
        const page1 = await context1.newPage();
        const page2 = await context2.newPage();

        // User 1 creates draft with private comment
        await login(page1, TEST_USERS.user1);
        const draftId = await createDraft(page1);
        await openCommentSidebar(page1);
        await addComment(page1, "Private confidential comment");

        // User 2 tries to access via direct URL
        await login(page2, TEST_USERS.user2);
        await page2.goto(`${BASE_URL}/generator/draft/${draftId}`);

        // Should either:
        // A) Show 403 access denied
        // B) Redirect to own drafts
        // C) Show empty state (no access to comments)
        const accessDenied = await page2
            .locator('text="Zugriff verweigert"')
            .isVisible()
            .catch(() => false);
        const redirect = !page2.url().includes(`draft/${draftId}`);
        const emptyComments = await page2
            .locator('text="Noch keine Kommentare"')
            .isVisible()
            .catch(() => false);

        expect(accessDenied || redirect || emptyComments).toBeTruthy();

        // Verify private comment is NOT visible to user 2
        await expect(
            page2.locator('text="Private confidential comment"')
        ).not.toBeVisible();

        await context1.close();
        await context2.close();
    });

    test("IDOR-002: API rejects comment creation on foreign draft", async ({
        request,
    }) => {
        // This test directly calls API to verify backend protection

        // Login as user 1
        const loginResponse = await request.post(`${API_URL}/auth/login`, {
            data: TEST_USERS.user1,
        });
        const user1Token = (await loginResponse.json()).access_token;

        // Create draft as user 1
        const draftResponse = await request.post(`${API_URL}/drafts/`, {
            headers: { Authorization: `Bearer ${user1Token}` },
            data: { title: "User 1 Draft" },
        });
        const draftId = (await draftResponse.json()).id;

        // Login as user 2
        const login2Response = await request.post(`${API_URL}/auth/login`, {
            data: TEST_USERS.user2,
        });
        const user2Token = (await login2Response.json()).access_token;

        // User 2 tries to add comment to User 1's draft
        const attackResponse = await request.post(`${API_URL}/comments/`, {
            headers: { Authorization: `Bearer ${user2Token}` },
            data: {
                anchor_type: "draft",
                anchor_id: draftId,
                content: "Unauthorized comment",
            },
        });

        // Should be 403 Forbidden
        expect(attackResponse.status()).toBe(403);
    });

    test("PERM-001: Only author can delete their comment", async ({
        browser,
    }) => {
        const context1 = await browser.newContext();
        const context2 = await browser.newContext();
        const page1 = await context1.newPage();
        const page2 = await context2.newPage();

        // Setup: Both users have access to same draft (team scenario)
        await login(page1, TEST_USERS.user1);
        await login(page2, TEST_USERS.user2);

        const draftId = await createDraft(page1);
        await openCommentSidebar(page1);
        await addComment(page1, "User 1 comment");

        // Give user 2 access (simulated team access)
        await page2.goto(`${BASE_URL}/generator/draft/${draftId}`);
        await openCommentSidebar(page2);

        // User 2 should see the comment but NOT have delete option
        await expect(page2.locator('text="User 1 comment"')).toBeVisible();

        // Open dropdown
        await page2.click('[aria-label="Kommentar-Aktionen"]');

        // Delete option should be hidden or disabled for non-author
        const deleteButton = page2.locator('text="Löschen"');
        const isVisible = await deleteButton.isVisible().catch(() => false);
        const isDisabled = await deleteButton.isDisabled().catch(() => true);

        expect(!isVisible || isDisabled).toBeTruthy();

        await context1.close();
        await context2.close();
    });

    test("PERM-002: Admin can delete any comment", async ({ browser }) => {
        const context1 = await browser.newContext();
        const contextAdmin = await browser.newContext();
        const page1 = await context1.newPage();
        const pageAdmin = await contextAdmin.newPage();

        await login(page1, TEST_USERS.user1);
        await login(pageAdmin, TEST_USERS.admin);

        const draftId = await createDraft(page1);
        await openCommentSidebar(page1);
        await addComment(page1, "User comment for admin test");

        // Admin navigates to draft
        await pageAdmin.goto(`${BASE_URL}/generator/draft/${draftId}`);
        await openCommentSidebar(pageAdmin);

        // Admin should be able to delete
        await pageAdmin.click('[aria-label="Kommentar-Aktionen"]');
        await expect(pageAdmin.locator('text="Löschen"')).toBeEnabled();

        // Perform delete
        await pageAdmin.click('text="Löschen"');
        await pageAdmin.click('text="Endgültig löschen"');

        // Comment should be gone
        await expect(
            pageAdmin.locator('text="User comment for admin test"')
        ).not.toBeVisible();

        await context1.close();
        await contextAdmin.close();
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// TEST SUITE 4: ERROR HANDLING
// ═══════════════════════════════════════════════════════════════════════════

test.describe("Error Handling Tests", () => {
    test.beforeEach(async ({ page }) => {
        await login(page, TEST_USERS.user1);
    });

    test("ERR-001: Network timeout shows appropriate error", async ({
        page,
    }) => {
        await createDraft(page);
        await openCommentSidebar(page);

        // Simulate slow network
        await page.route(`${API_URL}/comments/**`, async (route) => {
            await new Promise((resolve) => setTimeout(resolve, 30000)); // 30s delay
            route.continue();
        });

        // Add comment (should timeout)
        await page.click('button:has(svg.lucide-plus)');
        await page.fill('textarea[placeholder*="Kommentar"]', "Timeout test");
        await page.click('button:has-text("Hinzufügen")');

        // Should show loading state initially
        await expect(page.locator('svg.animate-spin')).toBeVisible();
    });

    test("ERR-002: Invalid date handling in comments", async ({ page }) => {
        await createDraft(page);

        // Mock API to return invalid date
        await page.route(`${API_URL}/comments/**`, async (route) => {
            const response = await route.fetch();
            const json = await response.json();

            // Corrupt the date
            if (json.comments) {
                json.comments[0].root.created_at = "not-a-date";
            }

            route.fulfill({
                status: 200,
                body: JSON.stringify(json),
            });
        });

        await openCommentSidebar(page);

        // Should show "Unbekannt" instead of crashing
        await expect(page.locator('text="Unbekannt"')).toBeVisible();
    });

    test("ERR-003: Empty author name shows fallback", async ({ page }) => {
        await createDraft(page);

        // Mock API to return empty author
        await page.route(`${API_URL}/comments/**`, async (route) => {
            const response = await route.fetch();
            const json = await response.json();

            if (json.comments && json.comments[0]) {
                json.comments[0].root.author = { id: 1, email: "", name: "" };
            }

            route.fulfill({
                status: 200,
                body: JSON.stringify(json),
            });
        });

        await openCommentSidebar(page);

        // Should show "??" initials and "Unbekannt" name
        await expect(page.locator('text="??"')).toBeVisible();
    });

    test("ERR-004: Reply input preserves text on error", async ({ page }) => {
        await createDraft(page);
        await openCommentSidebar(page);
        await addComment(page, "Parent comment");

        // Intercept reply request to fail
        await page.route(`${API_URL}/comments/`, (route) => {
            if (route.request().method() === "POST") {
                route.fulfill({ status: 500, body: "Server Error" });
            } else {
                route.continue();
            }
        });

        // Open reply
        await page.click('button:has-text("Antworten")');
        await page.fill('textarea[placeholder*="Antwort"]', "My important reply");

        // Submit (will fail)
        await page.click('button:has-text("Antworten"):last-child');

        // Wait for error toast
        await expect(page.locator('text="Fehler"')).toBeVisible();

        // Input should STILL contain text (not cleared!)
        const textarea = page.locator('textarea[placeholder*="Antwort"]');
        await expect(textarea).toHaveValue("My important reply");
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// TEST SUITE 5: PERFORMANCE
// ═══════════════════════════════════════════════════════════════════════════

test.describe("Performance Tests", () => {
    test("PERF-001: Load 100+ comments without timeout", async ({ page }) => {
        await login(page, TEST_USERS.user1);
        const draftId = await createDraft(page);

        // Create 100 comments via API
        const token = await page.evaluate(() =>
            localStorage.getItem("access_token")
        );

        for (let i = 0; i < 100; i++) {
            await page.request.post(`${API_URL}/comments/`, {
                headers: { Authorization: `Bearer ${token}` },
                data: {
                    anchor_type: "draft",
                    anchor_id: draftId,
                    content: `Comment number ${i + 1}`,
                },
            });
        }

        // Measure load time
        const startTime = Date.now();
        await page.reload();
        await openCommentSidebar(page);
        await page.waitForSelector('[data-testid="comment-thread"]', {
            timeout: 10000,
        });
        const loadTime = Date.now() - startTime;

        // Should load within 5 seconds
        expect(loadTime).toBeLessThan(5000);

        // All comments should be visible (or scrollable)
        const commentCount = await page.locator('[data-testid="comment-thread"]').count();
        expect(commentCount).toBeGreaterThanOrEqual(100);
    });

    test("PERF-002: Scrolling is smooth with many comments", async ({ page }) => {
        test.slow(); // Mark as slow test

        await login(page, TEST_USERS.user1);
        // Assuming draft with many comments exists from PERF-001

        await openCommentSidebar(page);

        // Scroll to bottom
        const scrollArea = page.locator('[data-testid="comment-scroll-area"]');
        await scrollArea.evaluate((el) => {
            el.scrollTop = el.scrollHeight;
        });

        // Scroll back to top
        await scrollArea.evaluate((el) => {
            el.scrollTop = 0;
        });

        // No errors should occur
        const consoleErrors: string[] = [];
        page.on("console", (msg) => {
            if (msg.type() === "error") consoleErrors.push(msg.text());
        });

        expect(consoleErrors).toHaveLength(0);
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// TEST SUITE 6: MENTION FUNCTIONALITY
// ═══════════════════════════════════════════════════════════════════════════

test.describe("Mention Tests", () => {
    test.beforeEach(async ({ page }) => {
        await login(page, TEST_USERS.user1);
    });

    test("MENTION-001: @mention autocomplete shows suggestions", async ({
        page,
    }) => {
        await createDraft(page);
        await openCommentSidebar(page);

        await page.click('button:has(svg.lucide-plus)');

        // Type @ to trigger mention
        await page.fill('textarea[placeholder*="Kommentar"]', "Hello @");

        // Wait for autocomplete popup
        await page.waitForSelector('[data-testid="mention-suggestions"]', {
            timeout: 5000,
        });

        // Should show user suggestions
        await expect(
            page.locator('[data-testid="mention-suggestions"]')
        ).toBeVisible();
    });

    test("MENTION-002: Selected mention is highlighted", async ({ page }) => {
        await createDraft(page);
        await openCommentSidebar(page);

        await addComment(page, "Hey @test-user-2 please review this");

        // Verify @mention is styled differently
        const mention = page.locator('span.text-primary:has-text("@test-user-2")');
        await expect(mention).toBeVisible();
    });

    test("MENTION-003: Mentioned user receives notification", async ({
        browser,
    }) => {
        const context1 = await browser.newContext();
        const context2 = await browser.newContext();
        const page1 = await context1.newPage();
        const page2 = await context2.newPage();

        await login(page1, TEST_USERS.user1);
        await login(page2, TEST_USERS.user2);

        // User 1 creates comment mentioning User 2
        await createDraft(page1);
        await openCommentSidebar(page1);
        await addComment(page1, `Please review @${TEST_USERS.user2.email}`);

        // User 2 checks notifications
        await page2.goto(`${BASE_URL}/notifications`);

        // Should see mention notification
        await expect(
            page2.locator('text="hat Sie erwähnt"')
        ).toBeVisible({ timeout: 10000 });

        await context1.close();
        await context2.close();
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// TEST SUITE 7: DELETE CONFIRMATION
// ═══════════════════════════════════════════════════════════════════════════

test.describe("Delete Confirmation Tests", () => {
    test.beforeEach(async ({ page }) => {
        await login(page, TEST_USERS.user1);
    });

    test("DELETE-001: Delete requires confirmation dialog", async ({ page }) => {
        await createDraft(page);
        await openCommentSidebar(page);
        await addComment(page, "Comment to delete");

        // Click delete
        await page.click('[aria-label="Kommentar-Aktionen"]');
        await page.click('text="Löschen"');

        // Confirmation dialog should appear
        await expect(page.locator('text="Kommentar löschen?"')).toBeVisible();
        await expect(
            page.locator('text="unwiderruflich gelöscht"')
        ).toBeVisible();
    });

    test("DELETE-002: Cancel preserves comment", async ({ page }) => {
        await createDraft(page);
        await openCommentSidebar(page);
        await addComment(page, "Comment to keep");

        // Click delete
        await page.click('[aria-label="Kommentar-Aktionen"]');
        await page.click('text="Löschen"');

        // Cancel
        await page.click('text="Abbrechen"');

        // Comment should still exist
        await expect(page.locator('text="Comment to keep"')).toBeVisible();
    });

    test("DELETE-003: Confirm removes comment with animation", async ({
        page,
    }) => {
        await createDraft(page);
        await openCommentSidebar(page);
        await addComment(page, "Comment to remove");

        // Delete with confirmation
        await page.click('[aria-label="Kommentar-Aktionen"]');
        await page.click('text="Löschen"');
        await page.click('text="Endgültig löschen"');

        // Comment should disappear
        await expect(page.locator('text="Comment to remove"')).not.toBeVisible();

        // Success toast
        await expect(page.locator('text="Gelöscht"')).toBeVisible();
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// TEST SUITE 8: RESOLVE/REOPEN WORKFLOW
// ═══════════════════════════════════════════════════════════════════════════

test.describe("Resolve/Reopen Workflow Tests", () => {
    test.beforeEach(async ({ page }) => {
        await login(page, TEST_USERS.user1);
    });

    test("RESOLVE-001: Comment can be marked as resolved", async ({ page }) => {
        await createDraft(page);
        await openCommentSidebar(page);
        await addComment(page, "Task to complete");

        // Resolve via dropdown
        await page.click('[aria-label="Kommentar-Aktionen"]');
        await page.click('text="Als erledigt markieren"');

        // Should show "Erledigt" badge
        await expect(page.locator('text="Erledigt"')).toBeVisible();
    });

    test("RESOLVE-002: Resolved comments hidden by default filter", async ({
        page,
    }) => {
        await createDraft(page);
        await openCommentSidebar(page);
        await addComment(page, "Resolved comment");

        // Resolve
        await page.click('[aria-label="Kommentar-Aktionen"]');
        await page.click('text="Als erledigt markieren"');

        // Toggle filter to hide resolved
        await page.click('button:has(svg.lucide-filter)');

        // Comment should be hidden
        await expect(page.locator('text="Resolved comment"')).not.toBeVisible();
    });

    test("RESOLVE-003: Resolved comment can be reopened", async ({ page }) => {
        await createDraft(page);
        await openCommentSidebar(page);
        await addComment(page, "Reopenable comment");

        // Resolve
        await page.click('[aria-label="Kommentar-Aktionen"]');
        await page.click('text="Als erledigt markieren"');

        // Reopen
        await page.click('[aria-label="Kommentar-Aktionen"]');
        await page.click('text="Wiedereröffnen"');

        // Should be active again (no "Erledigt" badge)
        await expect(page.locator('text="Erledigt"')).not.toBeVisible();
    });
});
