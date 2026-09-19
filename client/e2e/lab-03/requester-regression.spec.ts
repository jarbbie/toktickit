import { expect, test } from "@playwright/test";
import { accounts, capture, captureAllViewports, fillCreateTicket, logout, signIn } from "./helpers";

test("authenticated Requester regression, attachment lifecycle, comments, indication, and ownership denial", async ({ page }) => {
  await signIn(page, accounts.anan, "My Tickets");

  await page.goto("/tickets/new");
  await page.getByRole("button", { name: "Submit Ticket" }).click();
  await expect(page.getByText("Category is required.")).toBeVisible();
  await expect(page.getByText("Description must be between 10 and 4000 characters.")).toBeVisible();
  await capture(page, "requester", "create-validation");

  const summary = `Lab 3 E2E requester ${Date.now()}`;
  await fillCreateTicket(page, summary, "HIGH");
  await page.getByLabel("Attachment").setInputFiles({ name: "invalid.txt", mimeType: "text/plain", buffer: Buffer.from("not a PDF") });
  await expect(page.getByText("Choose a JPG, PNG, WEBP, or PDF file.")).toBeVisible();
  await capture(page, "requester", "create-invalid-attachment");

  await page.getByLabel("Attachment").setInputFiles({ name: "requester-evidence.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4\nRequester evidence") });
  let releaseCreate: (() => void) | undefined;
  await page.route("**/api/tickets", async (route) => {
    await new Promise<void>((resolve) => { releaseCreate = resolve; });
    await route.continue();
  }, { times: 1 });
  await page.getByRole("button", { name: "Submit Ticket" }).click();
  await expect(page.getByRole("button", { name: "Submitting…" })).toBeDisabled();
  await capture(page, "requester", "create-submitting");
  releaseCreate?.();
  await expect(page.getByRole("heading", { name: /Ticket created:/ })).toBeVisible();
  await expect(page.getByText("Your ticket is saved with status New.")).toBeVisible();
  await capture(page, "requester", "create-success");

  const detailLink = page.getByRole("link", { name: "View Ticket Details" });
  const detailRoute = await detailLink.getAttribute("href");
  expect(detailRoute).toMatch(/^\/tickets\/\d+$/);
  await detailLink.click();
  await expect(page.getByLabel("Ticket No.")).toHaveValue(/TKT-/);
  await expect(page.getByLabel("Requester")).toHaveValue("Anan Kittisak");
  await expect(page.getByLabel("Requested Priority")).toHaveValue("HIGH");
  await expect(page.getByLabel("IT Priority")).toHaveValue("HIGH");
  await expect(page.getByLabel("Summary")).toHaveValue(summary);

  await page.getByLabel("Add public comment").fill("Please let me know when the support team has checked this.");
  await page.getByRole("button", { name: "Post Comment" }).click();
  await expect(page.getByText("Please let me know when the support team has checked this.")).toBeVisible();
  await page.getByRole("button", { name: "Problem appears resolved" }).click();
  await expect(page.getByText(/Indicated on/)).toBeVisible();

  const uploadResponsePromise = page.waitForResponse((response) => response.url().includes("/api/tickets/") && response.url().endsWith("/attachments") && response.request().method() === "POST");
  await page.getByLabel("Add attachment").setInputFiles({ name: "active-download.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4\nActive download evidence") });
  await page.getByRole("button", { name: "Upload attachment" }).click();
  const uploadResponse = await uploadResponsePromise;
  expect(uploadResponse.status()).toBe(201);
  const uploaded = await uploadResponse.json() as { id: number };
  const uploadedItem = page.getByRole("listitem").filter({ hasText: "active-download.pdf" });
  await expect(uploadedItem).toBeVisible();
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    uploadedItem.getByRole("link", { name: "Download" }).click(),
  ]);
  expect(download.suggestedFilename()).toBe("active-download.pdf");
  await capture(page, "requester", "ticket-detail-active");

  await uploadedItem.getByRole("button", { name: "Remove" }).click();
  await page.getByLabel("Removal reason").fill("Duplicate evidence for the browser verification.");
  await page.getByRole("button", { name: "Confirm removal" }).click();
  await expect(uploadedItem.getByText("Removed")).toBeVisible();
  await expect(uploadedItem.getByRole("link", { name: "Download" })).toHaveCount(0);
  await expect(uploadedItem).toContainText("Duplicate evidence for the browser verification.");
  await capture(page, "requester", "ticket-detail-removed");

  await captureAllViewports(page, "requester", detailRoute!, "ticket-detail");

  await logout(page);
  await signIn(page, accounts.mali, "My Tickets");
  await page.goto(detailRoute!);
  await expect(page.getByRole("alert")).toContainText("Unable to load ticket.");
  await capture(page, "requester", "cross-requester-ticket-denied");

  const foreignDownload = await page.request.get(`http://localhost:3000/api/attachments/${uploaded.id}/download`);
  expect(foreignDownload.status()).toBe(404);
  await capture(page, "requester", "cross-requester-attachment-denied");

  await page.goto("/tickets/new");
  await fillCreateTicket(page, "Preserved after browser API failure");
  await page.route("**/api/tickets", (route) => route.fulfill({ status: 500, contentType: "application/json", body: '{"error":"Unable to create ticket."}' }), { times: 1 });
  await page.getByRole("button", { name: "Submit Ticket" }).click();
  await expect(page.getByRole("alert")).toContainText("Unable to create ticket.");
  await expect(page.getByLabel("Ticket Summary")).toHaveValue("Preserved after browser API failure");
  await capture(page, "requester", "create-api-failure");
});
