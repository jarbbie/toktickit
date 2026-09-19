import { expect, test } from "@playwright/test";
import { accounts, capture, captureAllViewports, logout, signIn } from "./helpers";

test("Administrator user management, safety conflicts, reset gate, and forbidden access", async ({ page }) => {
  await signIn(page, accounts.admin, "User Management");
  await captureAllViewports(page, "user-management", "/admin/users", "list");

  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/admin/users");
  const runId = Date.now();
  const createdEmail = `e2e.user.${runId}@toktickit.test`;
  const createdName = `E2E Created Requester ${runId}`;
  const updatedName = `E2E Updated Requester ${runId}`;
  const createdInitialPassword = "Created-Initial-Password!";
  const resetPassword = "Created-Reset-Password!";
  const changedPassword = "Created-Changed-Password!";

  await page.getByRole("button", { name: "+ Create user" }).click();
  await page.getByLabel("Display name").fill(createdName);
  await page.getByLabel("Email").fill(createdEmail);
  await page.getByLabel("User role").selectOption("REQUESTER");
  await page.getByRole("textbox", { name: "Initial password", exact: true }).fill(createdInitialPassword);
  await page.getByLabel("Confirm password").fill(createdInitialPassword);
  await page.getByRole("button", { name: "Create user", exact: true }).click();
  await expect(page.locator(".alert.alert-success")).toContainText("User created.");
  await expect(page.getByText(createdName, { exact: true }).first()).toBeVisible();
  await capture(page, "user-management", "create-success");

  await page.getByLabel("Search users").fill(createdEmail);
  await expect(page.getByText(createdEmail, { exact: true }).first()).toBeVisible();
  await page.getByRole("button", { name: `Edit ${createdName}` }).first().click();
  await page.getByLabel("Display name").fill(updatedName);
  await page.getByLabel("Account active").uncheck();
  await page.getByRole("checkbox", { name: /I understand this deactivates/ }).check();
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.locator(".alert.alert-success")).toContainText("User changes saved.");
  await expect(page.getByText(updatedName, { exact: true }).first()).toBeVisible();

  await page.getByRole("button", { name: `Reset initial password for ${updatedName}` }).first().click();
  await page.getByLabel("New initial password").fill(resetPassword);
  await page.getByLabel("Confirm password").fill(resetPassword);
  await page.getByRole("button", { name: "Set initial password", exact: true }).click();
  await expect(page.locator(".alert.alert-success")).toContainText("Initial password reset.");
  await capture(page, "user-management", "edit-reset-success");

  await page.getByLabel("Search users").fill(createdEmail);
  await page.getByRole("button", { name: `Edit ${updatedName}` }).first().click();
  await page.getByLabel("Account active").check();
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(page.locator(".alert.alert-success")).toContainText("User changes saved.");

  await page.getByRole("button", { name: "+ Create user" }).click();
  await page.getByLabel("Display name").fill("Duplicate E2E User");
  await page.getByLabel("Email").fill(createdEmail);
  await page.getByLabel("User role").selectOption("REQUESTER");
  await page.getByRole("textbox", { name: "Initial password", exact: true }).fill(createdInitialPassword);
  await page.getByLabel("Confirm password").fill(createdInitialPassword);
  await page.getByRole("button", { name: "Create user", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Email is already in use.");
  await capture(page, "user-management", "duplicate-email-validation");
  await page.getByRole("button", { name: "Cancel" }).click();

  await page.getByLabel("Search users").fill("");
  await page.getByRole("button", { name: "Edit Lab Administrator" }).first().click();
  await expect(page.getByLabel("Account active")).toBeDisabled();
  await page.getByLabel("User role").selectOption("REQUESTER");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByRole("alert")).toContainText("last active Administrator");
  await capture(page, "user-management", "last-admin-safety-conflict");
  await page.getByRole("button", { name: "Cancel" }).click();

  await logout(page);
  await page.goto("/login");
  await page.getByLabel("Email").fill(createdEmail);
  await page.getByRole("textbox", { name: "Password" }).fill(resetPassword);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { name: /Change your initial password to continue/ })).toBeVisible();
  await capture(page, "authentication", "admin-created-user-password-gate");
  await page.getByLabel("Current Password").fill(resetPassword);
  await page.getByRole("textbox", { name: "New Password", exact: true }).fill(changedPassword);
  await page.getByLabel("Confirm New Password").fill(changedPassword);
  await page.getByRole("button", { name: "Save Password" }).click();
  await expect(page.getByRole("heading", { name: "My Tickets" })).toBeVisible();
  await logout(page);

  await signIn(page, accounts.nicha, "My Tickets");
  await page.goto("/admin/users");
  await expect(page.getByRole("heading", { name: "Access denied" })).toBeVisible();
  await capture(page, "user-management", "requester-forbidden");
});
