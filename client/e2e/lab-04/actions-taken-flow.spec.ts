import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { accounts, fillCreateTicket, logout, signIn } from "../lab-03/helpers";
import { captureLab4, captureLab4AllViewports } from "./helpers";

test("Requester reads Actions while Support creates, assigns, edits, starts, completes, and cancels them", async ({ page }) => {
  await signIn(page, accounts.anan, "My Tickets");
  const summary = `Lab 4 Actions UI ${Date.now()}`;
  await fillCreateTicket(page, summary);
  await page.getByRole("button", { name: "Submit Ticket" }).click();
  await expect(page.getByRole("heading", { name: /Ticket created:/ })).toBeVisible();
  await page.getByRole("link", { name: "View Ticket Details" }).click();
  await expect(page.getByRole("heading", { name: "Actions Taken" })).toBeVisible();
  await expect(page.getByText(/No Actions have been recorded/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Add Action" })).toHaveCount(0);
  const requesterRoute = page.url();
  const ticketId = requesterRoute.split("/").pop()!;

  await logout(page);
  await signIn(page, accounts.supportOne, "Ticket Queue");
  const staffRoute = `/staff/tickets/${ticketId}`;
  await page.goto(staffRoute);
  await expect(page.getByRole("heading", { name: /^Ticket TKT-/ })).toBeVisible();

  await page.getByRole("button", { name: "Add Action" }).click();
  await page.getByRole("button", { name: "Create Action" }).click();
  await expect(page.getByText("Description must be between 1 and 2000 characters.")).toBeVisible();
  await page.getByLabel(/Action Description/).fill("Restore first-hop gateway");
  await page.getByLabel("Assignee").selectOption({ label: "Support Two (IT Staff)" });
  await page.getByLabel("Follow-Up Required").check();
  await page.getByLabel(/Follow-up Note/).fill("Confirm stable connection tomorrow");
  await page.getByLabel("Attachment Notes").fill("Review the existing gateway screenshot");
  await page.getByRole("button", { name: "Create Action" }).click();
  await expect(page.getByText("Action created.", { exact: true })).toBeVisible();
  const firstAction = page.locator(".actions-taken-item").nth(0);
  await expect(firstAction.locator(".actions-taken-fields dd").nth(3)).toHaveText("Support Two");
  await expect(firstAction).toContainText("Confirm stable connection tomorrow");
  await firstAction.getByText(/Action history/).click();
  await expect(firstAction).toContainText("CREATED");
  await captureLab4(page, "actions-taken", "support-created-desktop");

  await firstAction.getByRole("button", { name: "Change assignee" }).click();
  await page.getByLabel("Assignee", { exact: true }).selectOption({ label: "Support One (IT Staff)" });
  await page.getByRole("button", { name: "Save assignee" }).click();
  await expect(page.getByText("Action assignee updated.", { exact: true })).toBeVisible();
  await expect(firstAction.locator(".actions-taken-fields dd").nth(3)).toHaveText("Support One");

  await firstAction.getByRole("button", { name: "Edit Action" }).click();
  await page.getByLabel(/Action Description/).fill("Restore the gateway and verify access");
  await page.getByLabel("Attachment Notes").fill("Check the existing gateway screenshot");
  await page.getByRole("button", { name: "Save Action" }).click();
  await expect(page.getByText("Action updated.", { exact: true })).toBeVisible();
  await expect(firstAction).toContainText("Restore the gateway and verify access");

  await firstAction.getByRole("button", { name: "Start" }).click();
  await expect(page.getByText("Action started.", { exact: true })).toBeVisible();
  await expect(firstAction).toContainText("In Progress");
  await firstAction.getByRole("button", { name: "Complete" }).click();
  const completeDialog = page.getByRole("dialog", { name: "Complete Action" });
  await expect(completeDialog).toBeVisible();
  await completeDialog.getByLabel(/Result/).fill("Gateway restarted; requester access verified");
  await completeDialog.getByRole("button", { name: "Confirm completion" }).click();
  await expect(page.getByText("Action completed.", { exact: true })).toBeVisible();
  await expect(firstAction).toContainText("Gateway restarted; requester access verified");

  await page.getByRole("button", { name: "Add Action" }).click();
  await page.getByLabel(/Action Description/).fill("Document the final service check");
  await page.getByRole("button", { name: "Create Action" }).click();
  await expect(page.getByText("Action created.", { exact: true })).toBeVisible();
  const secondAction = page.locator(".actions-taken-item").nth(1);
  await secondAction.getByRole("button", { name: "Cancel Action" }).click();
  const cancelDialog = page.getByRole("dialog", { name: "Cancel Action" });
  await expect(cancelDialog).toBeVisible();
  await cancelDialog.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await secondAction.getByRole("button", { name: "Cancel Action" }).click();
  await page.getByRole("dialog", { name: "Cancel Action" }).getByRole("button", { name: "Confirm cancellation" }).click();
  await expect(page.getByText("Action cancelled.", { exact: true })).toBeVisible();
  await expect(secondAction).toContainText("Cancelled");
  await captureLab4AllViewports(page, "actions-taken", staffRoute, "support-actions");

  await logout(page);
  await signIn(page, accounts.anan, "My Tickets");
  await page.goto(requesterRoute);
  await expect(page.getByText("Restore the gateway and verify access")).toBeVisible();
  await expect(page.getByText("Gateway restarted; requester access verified")).toBeVisible();
  await expect(page.getByText("Document the final service check")).toBeVisible();
  await expect(page.getByText(/Action history/)).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Add Action" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Edit Action" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Start" })).toHaveCount(0);
  await captureLab4AllViewports(page, "actions-taken", requesterRoute, "requester-actions");
});

test("keeps an Action draft when the selected assignee is deactivated before save", async ({ page, browser }) => {
  const runId = Date.now();
  const temporaryStaffName = `Lab 4 Temporary Staff ${runId}`;
  const temporaryStaffEmail = `e2e.actions.staff.${runId}@toktickit.test`;
  const temporaryPassword = `E2E-${randomUUID()}-aA1!`;

  await signIn(page, accounts.admin, "User Management");
  await page.goto("/admin/users");
  await page.getByRole("button", { name: "+ Create user" }).click();
  await page.getByLabel("Display name").fill(temporaryStaffName);
  await page.getByLabel("Email").fill(temporaryStaffEmail);
  await page.getByLabel("User role").selectOption("IT_STAFF");
  await page.getByRole("textbox", { name: "Initial password", exact: true }).fill(temporaryPassword);
  await page.getByRole("textbox", { name: "Confirm password", exact: true }).fill(temporaryPassword);
  await page.getByRole("button", { name: "Create user", exact: true }).click();
  await expect(page.getByText(temporaryStaffName, { exact: true }).first()).toBeVisible();

  await logout(page);
  await signIn(page, accounts.anan, "My Tickets");
  await fillCreateTicket(page, `Lab 4 inactive assignee ${Date.now()}`);
  await page.getByRole("button", { name: "Submit Ticket" }).click();
  await page.getByRole("link", { name: "View Ticket Details" }).click();
  const requesterRoute = page.url();
  const ticketId = requesterRoute.split("/").pop()!;

  await logout(page);
  await signIn(page, accounts.supportOne, "Ticket Queue");
  await page.goto(`/staff/tickets/${ticketId}`);
  await page.getByRole("button", { name: "Add Action" }).click();
  await page.getByLabel(/Action Description/).fill("Keep this draft through the unavailable-assignee response");
  await page.getByLabel("Assignee", { exact: true }).selectOption({ label: `${temporaryStaffName} (IT Staff)` });

  const adminContext = await browser.newContext({ baseURL: "http://localhost:5173" });
  const adminPage = await adminContext.newPage();
  await signIn(adminPage, accounts.admin, "User Management");
  await adminPage.goto("/admin/users");
  await adminPage.getByLabel("Search users").fill(temporaryStaffEmail);
  await adminPage.getByRole("button", { name: `Edit ${temporaryStaffName}` }).first().click();
  await adminPage.getByLabel("Account active").uncheck();
  await adminPage.getByRole("checkbox", { name: /I understand this deactivates/ }).check();
  await adminPage.getByRole("button", { name: "Save changes" }).click();
  await expect(adminPage.getByText("User changes saved.", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Create Action" }).click();
  await expect(page.getByRole("alert")).toContainText("That assignee is unavailable.");
  await expect(page.getByLabel(/Action Description/)).toHaveValue("Keep this draft through the unavailable-assignee response");
  await expect(page.getByLabel("Assignee", { exact: true }).getByRole("option", { name: /no longer available/ })).toBeDisabled();
  await page.getByLabel("Assignee", { exact: true }).selectOption({ label: "Support One (IT Staff)" });
  await page.getByRole("button", { name: "Create Action" }).click();
  await expect(page.getByText("Action created.", { exact: true })).toBeVisible();

  await adminPage.getByLabel("Search users").fill(temporaryStaffEmail);
  await adminPage.getByRole("button", { name: `Edit ${temporaryStaffName}` }).first().click();
  await adminPage.getByLabel("Account active").check();
  await adminPage.getByRole("button", { name: "Save changes" }).click();
  await expect(adminPage.getByText("User changes saved.", { exact: true })).toBeVisible();
  await adminContext.close();
});
