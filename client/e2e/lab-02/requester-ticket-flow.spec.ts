import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test, type Page } from "@playwright/test";

const screenshots = fileURLToPath(new URL("../../../artifacts/lab-02/screenshots/", import.meta.url));

async function selectRequester(page: Page, name: string) {
  await page.goto("/");
  await page.getByLabel("Development Requester").selectOption({ label: name });
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("heading", { name: "My Tickets" })).toBeVisible();
}

async function createTicket(page: Page, summary: string) {
  await page.goto("/tickets/new");
  await page.getByLabel(/Category/).selectOption({ label: "Hardware" });
  await page.getByLabel(/Related System/).selectOption({ label: "VPN" });
  await page.getByLabel(/Ticket Summary/).fill(summary);
  await page.getByLabel(/Description/).fill("The VPN fails after university credentials are entered.");
  await page.getByRole("button", { name: "Submit Ticket" }).click();
  await expect(page.getByRole("heading", { name: /Ticket created:/ })).toBeVisible();
  await page.getByRole("link", { name: "View My Tickets" }).click();
  const row = page.locator("tr", { hasText: summary });
  await expect(row).toBeVisible();
  await row.getByRole("link", { name: "Open" }).click();
  await expect(page.getByLabel("Ticket No.")).toHaveValue(/TKT-/);
  return new URL(page.url()).pathname;
}

async function capture(page: Page, screen: string, viewport: { width: number; height: number }, route: string) {
  await page.setViewportSize(viewport);
  await page.goto(route);
  await expect(page.locator("main")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  const target = path.join(screenshots, screen, `${viewport.width}x${viewport.height}.png`);
  await mkdir(path.dirname(target), { recursive: true });
  await page.screenshot({ path: target, fullPage: true });
}

test("requester creates, finds, opens, downloads, removes, and captures evidence", async ({ page }) => {
  const summary = `E2E VPN ${Date.now()}`;
  await selectRequester(page, "Nicha Somchai");
  const detailRoute = await createTicket(page, summary);

  await page.getByLabel("Add attachment").setInputFiles({ name: "evidence.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4\nE2E evidence") });
  await page.getByRole("button", { name: "Upload attachment" }).click();
  await expect(page.getByText(/evidence\.pdf/)).toBeVisible();
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("link", { name: "Download" }).click()]);
  expect(download.suggestedFilename()).toBe("evidence.pdf");
  await capture(page, "ticket-detail-active", { width: 1440, height: 1000 }, detailRoute);
  await page.getByRole("button", { name: "Remove" }).click();
  await page.getByLabel("Removal reason").fill("E2E removal check");
  await page.getByRole("button", { name: "Confirm removal" }).click();
  await expect(page.getByText("Removed")).toBeVisible();
  await expect(page.getByRole("link", { name: "Download" })).toHaveCount(0);

  for (const viewport of [{ width: 1440, height: 1000 }, { width: 820, height: 1180 }, { width: 390, height: 844 }]) {
    await capture(page, "create-ticket", viewport, "/tickets/new");
    await capture(page, "my-tickets", viewport, "/tickets");
    await capture(page, "ticket-detail", viewport, detailRoute);
  }
});
