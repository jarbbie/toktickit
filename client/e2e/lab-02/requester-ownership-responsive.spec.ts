import { expect, test } from "@playwright/test";
import { accounts, capture, fillCreateTicket, logout, signIn } from "../lab-03/helpers";

test("Lab 2 ownership regression rejects direct access by another authenticated Requester", async ({ page }) => {
  await signIn(page, accounts.preecha, "My Tickets");
  const summary = `Lab 2 ownership ${Date.now()}`;
  await fillCreateTicket(page, summary);
  await page.getByRole("button", { name: "Submit Ticket" }).click();
  await expect(page.getByRole("heading", { name: /Ticket created:/ })).toBeVisible();
  const detailRoute = await page.getByRole("link", { name: "View Ticket Details" }).getAttribute("href");
  await logout(page);

  await signIn(page, accounts.nicha, "My Tickets");
  await page.goto(detailRoute!);
  await expect(page.getByRole("alert")).toContainText("Unable to load ticket.");
  await capture(page, "requester", "lab2-cross-requester-ticket-denied");
});
