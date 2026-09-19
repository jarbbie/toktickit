import { expect, test } from "@playwright/test";
import { accounts, capture, initialPassword, logout } from "./helpers";

test("authentication, mandatory password change, safe failures, busy state, and logout", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  await capture(page, "authentication", "login-initial");

  await page.getByLabel("Email").fill(accounts.nicha.email);
  await page.getByRole("textbox", { name: "Password" }).fill("Wrong-Lab3-Password!");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("alert")).toContainText("Unable to sign in.");
  await capture(page, "authentication", "login-invalid");

  await page.getByLabel("Email").fill("suda.inactive@toktickit.test");
  await page.getByRole("textbox", { name: "Password" }).fill(initialPassword);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("alert")).toContainText("Unable to sign in.");
  await capture(page, "authentication", "login-inactive");

  const gate = page.getByRole("heading", { name: /Change your initial password to continue/ });
  const home = page.getByRole("heading", { name: "My Tickets" });
  await page.getByLabel("Email").fill(accounts.nicha.email);
  await page.getByRole("textbox", { name: "Password" }).fill(initialPassword);
  await page.getByRole("button", { name: "Sign in" }).click();
  try {
    await expect(gate.or(home)).toBeVisible({ timeout: 8_000 });
  } catch {
    await page.getByLabel("Email").fill(accounts.nicha.email);
    await page.getByRole("textbox", { name: "Password" }).fill(accounts.nicha.changedPassword);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(home).toBeVisible();
  }
  if (await gate.isVisible()) {
    await capture(page, "authentication", "change-password-initial");
    await page.getByRole("textbox", { name: "Current Password", exact: true }).fill(initialPassword);
    await page.getByRole("textbox", { name: "New Password", exact: true }).fill(accounts.nicha.changedPassword);
    await page.getByRole("textbox", { name: "Confirm New Password", exact: true }).fill(accounts.nicha.changedPassword);
    await page.getByRole("button", { name: "Save Password" }).click();
  }
  await expect(home).toBeVisible();
  await expect(page.locator(".app-profile summary")).toContainText("Nicha Somchai");
  await expect(page.locator(".app-profile summary")).toContainText("Requester");
  await capture(page, "authentication", "authenticated-requester");

  await logout(page);
  await page.goto("/tickets");
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  await capture(page, "authentication", "logout-direct-access-blocked");

  let releaseLogin: (() => void) | undefined;
  await page.route("**/api/auth/login", async (route) => {
    await new Promise<void>((resolve) => { releaseLogin = resolve; });
    await route.continue();
  }, { times: 1 });
  await page.getByLabel("Email").fill(accounts.nicha.email);
  await page.getByRole("textbox", { name: "Password" }).fill(accounts.nicha.changedPassword);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("button", { name: "Signing in…" })).toBeDisabled();
  await capture(page, "authentication", "login-busy");
  releaseLogin?.();
  await expect(home).toBeVisible();
});
