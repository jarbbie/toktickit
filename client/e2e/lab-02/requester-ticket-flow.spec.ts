import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test, type Page } from "@playwright/test";

const screenshots = fileURLToPath(new URL("../../../artifacts/lab-02/screenshots/", import.meta.url));

async function selectRequester(page: Page, name: string) {
  await page.goto("/");
  await page.getByLabel(/Development Requester/).selectOption({ label: name });
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("heading", { name: "My Tickets" })).toBeVisible();
}

async function createTicket(page: Page, summary: string) {
  await page.goto("/tickets/new");
  await page.getByRole("button", { name: "Submit Ticket" }).click();
  await expect(page.getByText("Category is required.")).toBeVisible();
  await captureState(page, "create-validation");
  await page.getByLabel(/Attachment/).setInputFiles({ name: "notes.txt", mimeType: "text/plain", buffer: Buffer.from("invalid") });
  await expect(page.getByText("Choose a JPG, PNG, WEBP, or PDF file.")).toBeVisible();
  await captureState(page, "create-invalid-attachment");
  await page.getByLabel(/Attachment/).setInputFiles({ name: "creation-evidence.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4\nCreation evidence") });
  await page.getByLabel(/Category/).selectOption({ label: "Hardware" });
  await page.getByLabel(/Related System/).selectOption({ label: "VPN" });
  await page.getByLabel(/Ticket Summary/).fill(summary);
  await page.getByLabel(/Description/).fill("The VPN fails after university credentials are entered.");
  let releaseRequest = () => {};
  await page.route("**/api/tickets", async (route) => {
    await new Promise<void>((resolve) => { releaseRequest = resolve; });
    await route.continue();
  }, { times: 1 });
  await page.getByRole("button", { name: "Submit Ticket" }).click();
  await expect(page.getByRole("button", { name: "Submitting…" })).toBeDisabled();
  await captureState(page, "create-submitting");
  releaseRequest();
  await expect(page.getByRole("heading", { name: /Ticket created:/ })).toBeVisible();
  await captureState(page, "create-success");
  await page.getByRole("link", { name: "View My Tickets" }).click();
  const row = page.locator("tr", { hasText: summary });
  await expect(row).toBeVisible();
  await row.getByRole("link", { name: /TKT-/ }).click();
  await expect(page.getByLabel("Ticket No.")).toHaveValue(/TKT-/);
  await expect(page.getByText(/creation-evidence\.pdf/)).toBeVisible();
  return new URL(page.url()).pathname;
}

async function captureState(page: Page, name: string) {
  const target = path.join(screenshots, "states", `${name}.png`);
  await mkdir(path.dirname(target), { recursive: true });
  await page.screenshot({ path: target, fullPage: true });
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
  let requesterMode: "hold" | "real" | "empty" | "failure" = "hold";
  let releaseRequesters = () => {};
  const heldRequesters = new Promise<void>((resolve) => { releaseRequesters = resolve; });
  await page.route(/\/api\/requesters(?:\?.*)?$/, async (route) => {
    if (requesterMode === "hold") {
      await heldRequesters;
      await route.continue();
    } else if (requesterMode === "empty") {
      await route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
    } else if (requesterMode === "failure") {
      await route.fulfill({ status: 500, contentType: "application/json", body: '{"error":"Unable to load requesters."}' });
    } else {
      await route.continue();
    }
  });
  await page.goto("/select", { waitUntil: "domcontentloaded" });
  await expect(page.getByText("Loading Development Requesters…")).toBeVisible();
  await captureState(page, "requester-loading");
  requesterMode = "real";
  releaseRequesters();
  await expect(page.getByLabel(/Development Requester/)).toBeVisible();

  requesterMode = "empty";
  await page.reload();
  await expect(page.getByText("No active Development Requesters are available.")).toBeVisible();
  await captureState(page, "requester-empty");

  requesterMode = "failure";
  await page.reload();
  await expect(page.getByRole("alert")).toContainText("Unable to load requester and reference data.");
  await captureState(page, "requester-failure");
  requesterMode = "real";
  await page.reload();
  await expect(page.getByLabel(/Development Requester/)).toBeVisible();

  for (const viewport of [{ width: 1440, height: 1000 }, { width: 820, height: 1180 }, { width: 390, height: 844 }]) {
    await capture(page, "requester-selection", viewport, "/select");
  }
  await selectRequester(page, "Nicha Somchai");
  const detailRoute = await createTicket(page, summary);

  await page.getByLabel("Add attachment").setInputFiles({ name: "evidence.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4\nE2E evidence") });
  await page.getByRole("button", { name: "Upload attachment" }).click();
  const evidenceAttachment = page.getByRole("listitem").filter({ hasText: /^evidence\.pdf/ });
  await expect(evidenceAttachment).toBeVisible();
  const [download] = await Promise.all([page.waitForEvent("download"), evidenceAttachment.getByRole("link", { name: "Download" }).click()]);
  expect(download.suggestedFilename()).toBe("evidence.pdf");
  await capture(page, "ticket-detail-active", { width: 1440, height: 1000 }, detailRoute);
  await evidenceAttachment.getByRole("button", { name: "Remove" }).click();
  await page.getByLabel("Removal reason").fill("E2E removal check");
  await page.getByRole("button", { name: "Confirm removal" }).click();
  await expect(evidenceAttachment.getByText("Removed")).toBeVisible();
  await expect(evidenceAttachment.getByRole("link", { name: "Download" })).toHaveCount(0);

  const requesterId = Number(await page.evaluate(() => sessionStorage.getItem("toktickit.requesterId")));
  const [categories, relatedSystems] = await Promise.all([
    page.request.get("http://localhost:3000/api/categories").then((response) => response.json()),
    page.request.get("http://localhost:3000/api/related-systems").then((response) => response.json()),
  ]);
  const categoryId = categories.find((item: { name: string }) => item.name === "Hardware").id;
  const relatedSystemId = relatedSystems.find((item: { name: string }) => item.name === "VPN").id;
  await Promise.all(Array.from({ length: 10 }, (_, index) => page.request.post("http://localhost:3000/api/tickets", { data: { requesterId, categoryId, relatedSystemId, requestedPriority: "MEDIUM", summary: `Pagination evidence ${Date.now()}-${index}`, description: "Ticket created to demonstrate the owned paginated list." } })));

  for (const viewport of [{ width: 1440, height: 1000 }, { width: 820, height: 1180 }, { width: 390, height: 844 }]) {
    await capture(page, "create-ticket", viewport, "/tickets/new");
    await capture(page, "my-tickets", viewport, "/tickets");
    await capture(page, "ticket-detail", viewport, detailRoute);
  }

  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/tickets");
  await page.getByLabel("Category").selectOption({ label: "Hardware" });
  await page.getByLabel("Requested Priority").selectOption("MEDIUM");
  await page.getByLabel("Current Status").selectOption("NEW");
  await page.getByRole("button", { name: /Sort by Ticket Number/ }).click();
  await expect(page.getByRole("button", { name: /Next/ })).toBeEnabled();
  await captureState(page, "my-tickets-filter-sort-pagination-page-1");
  await page.getByRole("button", { name: /Next/ }).click();
  await expect(page.locator(".current-page")).toHaveText("2");
  await captureState(page, "my-tickets-filter-sort-pagination-page-2");
  await page.getByLabel("Search tickets").fill("no-ticket-can-match-this");
  await expect(page.getByText("No tickets match your filters.")).toBeVisible();
  await captureState(page, "my-tickets-no-results");

  await page.goto("/tickets/new");
  await page.getByLabel(/Category/).selectOption({ label: "Hardware" });
  await page.getByLabel(/Related System/).selectOption({ label: "VPN" });
  await page.getByLabel(/Ticket Summary/).fill("Preserved after API failure");
  await page.getByLabel(/Description/).fill("These values must remain after the safe API failure.");
  await page.route("**/api/tickets", (route) => route.fulfill({ status: 500, contentType: "application/json", body: '{"error":"Unable to create ticket."}' }), { times: 1 });
  await page.getByRole("button", { name: "Submit Ticket" }).click();
  await expect(page.getByRole("alert")).toContainText("Unable to create ticket.");
  await expect(page.getByLabel(/Ticket Summary/)).toHaveValue("Preserved after API failure");
  await captureState(page, "create-api-failure");

  await page.locator(".app-profile summary").click();
  await page.getByRole("button", { name: "Change Requester" }).click();
  await page.getByLabel(/Development Requester/).selectOption({ label: "Preecha Wattanakul" });
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByText("No tickets yet.")).toBeVisible();
  await captureState(page, "my-tickets-empty");
});
