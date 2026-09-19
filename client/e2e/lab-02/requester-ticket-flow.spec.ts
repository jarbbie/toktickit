import { expect, test } from "@playwright/test";
import { accounts, capture, captureAllViewports, fillCreateTicket, logout, signIn } from "../lab-03/helpers";

test("Lab 2 requester Ticket flow continues through authenticated Lab 3 identity", async ({ page }) => {
  await signIn(page, accounts.mali, "My Tickets");
  await page.goto("/tickets/new");
  await page.getByRole("button", { name: "Submit Ticket" }).click();
  await expect(page.getByText("Category is required.")).toBeVisible();
  await capture(page, "requester", "lab2-create-validation");

  const summary = `Lab 2 regression ${Date.now()}`;
  await fillCreateTicket(page, summary);
  await page.getByRole("button", { name: "Submit Ticket" }).click();
  await expect(page.getByRole("heading", { name: /Ticket created:/ })).toBeVisible();
  const detailRoute = await page.getByRole("link", { name: "View Ticket Details" }).getAttribute("href");
  await page.getByRole("link", { name: "View Ticket Details" }).click();
  await expect(page.getByLabel("Requester")).toHaveValue("Mali Charoen");

  await page.getByLabel("Add attachment").setInputFiles({ name: "lab2-regression.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4\nLab 2 regression") });
  await page.getByRole("button", { name: "Upload attachment" }).click();
  const attachment = page.getByRole("listitem").filter({ hasText: "lab2-regression.pdf" });
  await expect(attachment).toBeVisible();
  const [download] = await Promise.all([page.waitForEvent("download"), attachment.getByRole("link", { name: "Download" }).click()]);
  expect(download.suggestedFilename()).toBe("lab2-regression.pdf");
  await attachment.getByRole("button", { name: "Remove" }).click();
  await page.getByLabel("Removal reason").fill("Lab 2 regression removal");
  await page.getByRole("button", { name: "Confirm removal" }).click();
  await expect(attachment.getByText("Removed")).toBeVisible();
  await captureAllViewports(page, "requester", detailRoute!, "lab2-ticket-detail");
  await logout(page);
});
