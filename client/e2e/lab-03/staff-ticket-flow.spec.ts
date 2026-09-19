import { expect, test } from "@playwright/test";
import { accounts, capture, captureAllViewports, fillCreateTicket, logout, signIn } from "./helpers";

test("IT Staff queue, ticket operations, comments, notes, and attachment continuity", async ({ page }) => {
  await signIn(page, accounts.preecha, "My Tickets");
  const summary = `Lab 3 E2E staff workflow ${Date.now()}`;
  await fillCreateTicket(page, summary, "MEDIUM");
  await page.getByRole("button", { name: "Submit Ticket" }).click();
  await expect(page.getByRole("heading", { name: /Ticket created:/ })).toBeVisible();
  const detailRoute = await page.getByRole("link", { name: "View Ticket Details" }).getAttribute("href");
  expect(detailRoute).toMatch(/^\/tickets\/\d+$/);
  await page.getByRole("link", { name: "View Ticket Details" }).click();
  await page.getByLabel("Add attachment").setInputFiles({ name: "staff-continuity.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4\nStaff continuity evidence") });
  await page.getByRole("button", { name: "Upload attachment" }).click();
  await expect(page.getByRole("listitem").filter({ hasText: "staff-continuity.pdf" })).toBeVisible();
  await logout(page);

  await signIn(page, accounts.supportOne, "Ticket Queue");
  await captureAllViewports(page, "staff-queue", "/staff/tickets", "queue");

  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/staff/tickets");
  await page.getByLabel("Search tickets").fill("no-ticket-matches-this-browser-audit");
  await expect(page.getByRole("status")).toContainText("No tickets match your filters.");
  await capture(page, "staff-queue", "queue-no-results");
  await page.route("**/api/staff/tickets*", (route) => route.fulfill({ status: 500, contentType: "application/json", body: '{"error":"Unable to load staff tickets."}' }), { times: 1 });
  await page.getByLabel("Search tickets").fill("trigger-queue-failure");
  await expect(page.getByRole("alert")).toContainText("Unable to load staff ticket queue.");
  await capture(page, "staff-queue", "queue-api-failure");
  await page.getByLabel("Search tickets").fill("");
  const row = page.locator("tr").filter({ hasText: summary });
  await expect(row).toBeVisible();
  await expect(row).toContainText("Unassigned");
  await row.getByRole("link", { name: /TKT-/ }).click();
  await expect(page.getByText("Staff Ticket Detail")).toBeVisible();
  await expect(page.getByRole("button", { name: "Claim Ticket" })).toBeVisible();
  await page.getByRole("button", { name: "Claim Ticket" }).click();
  await expect(page.getByText("Ticket claimed successfully.")).toBeVisible();

  await page.getByLabel("Ticket Owner", { exact: true }).selectOption({ label: "Support Two (IT Staff)" });
  await expect(page.getByRole("dialog")).toContainText("Confirm owner change");
  await expect(page.getByRole("button", { name: "Confirm owner change" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByLabel("Ticket Owner", { exact: true }).selectOption({ label: "Support Two (IT Staff)" });
  await page.getByRole("button", { name: "Confirm owner change" }).click();
  await expect(page.getByText("Ticket owner updated.")).toBeVisible();

  await page.getByLabel("IT Priority", { exact: true }).selectOption("HIGH");
  await page.getByRole("button", { name: "Save IT Priority" }).click();
  await expect(page.getByText("IT Priority updated.")).toBeVisible();

  await page.getByLabel("Next status").selectOption("OPEN");
  await page.getByRole("button", { name: "Update Status" }).click();
  await expect(page.getByText("Status changed to Open.")).toBeVisible();

  await page.getByLabel("Add public comment").fill("Support has started investigating this ticket.");
  await page.getByRole("button", { name: "Post public comment" }).click();
  await expect(page.getByText("Support has started investigating this ticket.")).toBeVisible();

  await page.getByLabel("Add internal note").fill("Internal verification note for the staff workflow.");
  await page.getByRole("button", { name: "Save internal note" }).click();
  await expect(page.getByText("Internal verification note for the staff workflow.")).toBeVisible();

  const attachment = page.getByRole("listitem").filter({ hasText: "staff-continuity.pdf" });
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    attachment.getByRole("link", { name: "Download" }).click(),
  ]);
  expect(download.suggestedFilename()).toBe("staff-continuity.pdf");
  await expect(attachment.getByRole("button", { name: "Remove" })).toHaveCount(0);
  await capture(page, "staff-ticket-detail", "operations-desktop");
  await capture(page, "staff-ticket-detail", "operations-mobile", { width: 390, height: 844 });

  await logout(page);
  await signIn(page, accounts.preecha, "My Tickets");
  const forbiddenStaffDetail = await page.request.get(`http://localhost:3000/api/staff/tickets/${detailRoute!.split("/").pop()}`);
  expect(forbiddenStaffDetail.status()).toBe(403);
  await page.goto(detailRoute!);
  await expect(page.getByText("Support has started investigating this ticket.")).toBeVisible();
  await expect(page.getByText("Internal verification note for the staff workflow.")).toHaveCount(0);
  await expect(page.getByText("Internal Notes")).toHaveCount(0);
  await page.getByRole("button", { name: "Problem appears resolved" }).click();
  await expect(page.getByText(/Indicated on/)).toBeVisible();
  await capture(page, "requester", "staff-resolution-indication");
  await capture(page, "requester", "staff-public-comment-visible-private-note-hidden");
});
