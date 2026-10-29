import { expect, test } from "@playwright/test";
import { accounts, fillCreateTicket, logout, signIn } from "../lab-03/helpers";
import { captureLab4AllViewports } from "./helpers";

async function changeStatus(page: import("@playwright/test").Page, target: string, label: string) {
  await page.getByLabel("Next status").selectOption(target);
  const confirmation = page.getByRole("dialog", { name: "Confirm status change" });
  if (await confirmation.count()) await confirmation.getByRole("button", { name: "Confirm status change" }).click();
  else {
    await page.getByRole("button", { name: "Update Status" }).click();
    await expect(page.getByText(`Status changed to ${label}.`, { exact: true })).toBeVisible();
    return;
  }
  await expect(page.getByText(`Status changed to ${label}.`, { exact: true })).toBeVisible();
}

test("enforces Ticket gates, records ordered history, and keeps Requester feedback advisory", async ({ page }) => {
  await signIn(page, accounts.anan, "My Tickets");
  await fillCreateTicket(page, `Lab 4 workflow ${Date.now()}`);
  await page.getByRole("button", { name: "Submit Ticket" }).click();
  await expect(page.getByRole("heading", { name: /Ticket created:/ })).toBeVisible();
  await page.getByRole("link", { name: "View Ticket Details" }).click();
  const requesterRoute = page.url();
  const ticketId = requesterRoute.split("/").pop()!;
  await expect(page.getByText(/History begins with Lab 4 transitions/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Update Status" })).toHaveCount(0);
  await page.getByRole("button", { name: "Problem appears resolved" }).click();
  await expect(page.getByText(/Current status remains New/)).toBeVisible();
  await expect(page.getByText(/History begins with Lab 4 transitions/)).toBeVisible();

  await logout(page);
  await signIn(page, accounts.supportOne, "Ticket Queue");
  const staffRoute = `/staff/tickets/${ticketId}`;
  await page.goto(staffRoute);
  await expect(page.getByRole("heading", { name: /^Ticket TKT-/ })).toBeVisible();

  await changeStatus(page, "OPEN", "Open");
  await changeStatus(page, "IN_PROGRESS", "In Progress");
  await changeStatus(page, "WAITING_FOR_REQUESTER", "Waiting for Requester");
  await changeStatus(page, "IN_PROGRESS", "In Progress");

  await page.getByRole("button", { name: "Add Action" }).click();
  await page.getByLabel(/Action Description/).fill("Restore and verify VPN access");
  await page.getByLabel("Follow-Up Required").check();
  await page.getByLabel(/Follow-up Note/).fill("Confirm access with the Requester");
  await page.getByRole("button", { name: "Create Action" }).click();
  await expect(page.getByText("Action created.", { exact: true })).toBeVisible();
  const action = page.locator(".actions-taken-item").first();

  await page.getByLabel("Next status").selectOption("RESOLVED");
  await page.getByRole("dialog", { name: "Confirm status change" }).getByRole("button", { name: "Confirm status change" }).click();
  await expect(page.getByRole("alert")).toContainText("complete or cancel 1 active Action");
  await expect(page.getByRole("alert")).toContainText("Review Actions Taken");
  await expect(page.getByLabel("Next status")).toHaveValue("RESOLVED");

  await action.getByRole("button", { name: "Complete" }).click();
  const completion = page.getByRole("dialog", { name: "Complete Action" });
  await completion.getByLabel(/Result/).fill("VPN session restored and verified");
  await completion.getByRole("button", { name: "Confirm completion" }).click();
  await expect(page.getByText("Action completed.", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Update Status" }).click();
  await page.getByRole("dialog", { name: "Confirm status change" }).getByRole("button", { name: "Confirm status change" }).click();
  await expect(page.getByRole("alert")).toContainText("clear 1 required follow-up");

  await action.getByRole("button", { name: "Edit Action" }).click();
  await page.getByLabel("Follow-Up Required").click();
  await page.getByRole("alertdialog", { name: "Clear follow-up note?" }).getByRole("button", { name: "Clear note" }).click();
  await page.getByRole("button", { name: "Save Action" }).click();
  await expect(page.getByText("Action updated.", { exact: true })).toBeVisible();
  await changeStatus(page, "RESOLVED", "Resolved");
  await expect(page.getByRole("heading", { name: "Ticket Status History" })).toBeVisible();
  await expect(page.locator(".ticket-status-history-list li")).toHaveCount(5);

  await changeStatus(page, "CLOSED", "Closed");
  await changeStatus(page, "REOPENED", "Reopened");
  await page.getByRole("button", { name: "Add Action" }).click();
  await page.getByLabel(/Action Description/).fill("Prepare a final cancellation check");
  await page.getByRole("button", { name: "Create Action" }).click();
  await expect(page.getByText("Action created.", { exact: true })).toBeVisible();
  await page.getByLabel("Next status").selectOption("CANCELLED");
  await page.getByRole("dialog", { name: "Confirm status change" }).getByRole("button", { name: "Confirm status change" }).click();
  await expect(page.getByRole("alert")).toContainText("Complete or cancel 1 active Action");
  await page.locator(".actions-taken-item").last().getByRole("button", { name: "Cancel Action" }).click();
  await page.getByRole("dialog", { name: "Cancel Action" }).getByRole("button", { name: "Confirm cancellation" }).click();
  await expect(page.getByText("Action cancelled.", { exact: true })).toBeVisible();
  await changeStatus(page, "CANCELLED", "Cancelled");

  await captureLab4AllViewports(page, "ticket-workflow", staffRoute, "staff-ticket-workflow");
  await logout(page);
  await signIn(page, accounts.anan, "My Tickets");
  await page.goto(requesterRoute);
  await expect(page.locator(".ticket-status-history-list li")).toHaveCount(8);
  await expect(page.getByText("Changed by Support One (IT Staff)").first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Update Status" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Problem appears resolved" })).toHaveCount(0);
  await captureLab4AllViewports(page, "ticket-workflow", requesterRoute, "requester-ticket-history");
});
