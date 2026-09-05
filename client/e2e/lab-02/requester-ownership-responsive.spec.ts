import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test, type Page } from "@playwright/test";

const states = fileURLToPath(new URL("../../../artifacts/lab-02/screenshots/states/", import.meta.url));

async function capture(page: Page, name: string) {
  await mkdir(states, { recursive: true });
  await page.screenshot({ path: path.join(states, `${name}.png`), fullPage: true });
}

async function selectRequester(page: Page, name: string) {
  await page.goto("/");
  await page.getByLabel(/Development Requester/).selectOption({ label: name });
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("heading", { name: "My Tickets" })).toBeVisible();
}

test("switching requesters hides another requester’s ticket", async ({ page }) => {
  const summary = `E2E ownership ${Date.now()}`;
  await selectRequester(page, "Nicha Somchai");
  await page.goto("/tickets/new");
  await page.getByLabel(/Category/).selectOption({ label: "Hardware" });
  await page.getByLabel(/Related System/).selectOption({ label: "VPN" });
  await page.getByLabel(/Ticket Summary/).fill(summary);
  await page.getByLabel(/Description/).fill("The VPN fails after university credentials are entered.");
  await page.getByLabel(/Attachment/).setInputFiles({ name: "owned.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4\nOwned evidence") });
  await page.getByRole("button", { name: "Submit Ticket" }).click();
  await page.getByRole("link", { name: "View My Tickets" }).click();
  const row = page.locator("tr", { hasText: summary });
  const detailRoute = await row.getByRole("link", { name: /TKT-/ }).getAttribute("href");
  await page.goto(detailRoute!);
  const attachmentUrl = await page.getByRole("link", { name: "Download" }).getAttribute("href");
  await page.goto("/tickets");

  await page.locator(".app-profile summary").click();
  await page.getByRole("button", { name: "Change Requester" }).click();
  await page.getByLabel(/Development Requester/).selectOption({ label: "Anan Kittisak" });
  const otherRequesterId = await page.getByLabel(/Development Requester/).inputValue();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByText(summary)).toHaveCount(0);
  await capture(page, "requester-b-list");
  await page.goto(detailRoute!);
  await expect(page.getByRole("alert")).toContainText("Unable to load ticket.");
  await capture(page, "cross-requester-ticket-denied");
  const unownedAttachmentUrl = new URL(attachmentUrl!);
  unownedAttachmentUrl.searchParams.set("requesterId", otherRequesterId);
  await page.goto(unownedAttachmentUrl.toString());
  await expect(page.locator("body")).toContainText("Attachment not found.");
  await capture(page, "cross-requester-attachment-denied");
});
