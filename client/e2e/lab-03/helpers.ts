import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, type Page } from "@playwright/test";

export const initialPassword = "Lab3-Initial-2026!";

export const accounts = {
  nicha: {
    email: "nicha.somchai@toktickit.test",
    changedPassword: "Auth-Lab3-Password!",
  },
  anan: {
    email: "anan.kittisak@toktickit.test",
    changedPassword: "Requester-Lab3-Password!",
  },
  mali: {
    email: "mali.charoen@toktickit.test",
    changedPassword: "Lab2-E2E-Password!",
  },
  preecha: {
    email: "preecha.wattanakul@toktickit.test",
    changedPassword: "Staff-Requester-Password!",
  },
  supportOne: {
    email: "support.one@toktickit.test",
    changedPassword: "Staff-One-Lab3-Password!",
  },
  supportTwo: {
    email: "support.two@toktickit.test",
    changedPassword: "Staff-Two-Lab3-Password!",
  },
  admin: {
    email: "admin@toktickit.test",
    changedPassword: "Admin-Lab3-Password!",
  },
} as const;

export const viewports = [
  { width: 1440, height: 1000 },
  { width: 820, height: 1180 },
  { width: 390, height: 844 },
] as const;

const screenshotsRoot = fileURLToPath(new URL("../../../artifacts/lab-03/screenshots/", import.meta.url));

export async function capture(page: Page, screen: string, name: string, viewport?: { width: number; height: number }) {
  if (viewport) await page.setViewportSize(viewport);
  await expect(page.locator("main")).toBeVisible();
  await expectNoHorizontalOverflow(page);
  const target = path.join(screenshotsRoot, screen, `${name}.png`);
  await mkdir(path.dirname(target), { recursive: true });
  await page.screenshot({ path: target, fullPage: true });
}

export async function captureAllViewports(page: Page, screen: string, route: string, prefix: string) {
  for (const viewport of viewports) {
    await page.goto(route);
    await capture(page, screen, `${prefix}-${viewport.width}x${viewport.height}`, viewport);
  }
}

export async function expectNoHorizontalOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
}

async function fillLogin(page: Page, email: string, password: string) {
  await page.getByLabel("Email").fill(email);
  await page.getByRole("textbox", { name: "Password" }).fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
}

/**
 * Sign in using the disposable seed credential and complete the first-login
 * gate. If the account was already used by an earlier local run, retry with
 * the documented test password for that account so the suite remains rerun-safe.
 */
export async function signIn(page: Page, account: { email: string; changedPassword: string }, homeHeading: RegExp | string) {
  await page.goto("/login");
  const initialGate = page.getByRole("heading", { name: /Change your initial password to continue/ });
  const home = page.getByRole("heading", { name: homeHeading });
  await fillLogin(page, account.email, initialPassword);

  let currentPassword = initialPassword;
  try {
    await expect(initialGate.or(home)).toBeVisible({ timeout: 8_000 });
  } catch {
    await fillLogin(page, account.email, account.changedPassword);
    currentPassword = account.changedPassword;
    await expect(initialGate.or(home)).toBeVisible({ timeout: 8_000 });
  }

  if (await initialGate.isVisible()) {
    await page.getByLabel("Current Password").fill(currentPassword);
    await page.getByRole("textbox", { name: "New Password", exact: true }).fill(account.changedPassword);
    await page.getByLabel("Confirm New Password").fill(account.changedPassword);
    await page.getByRole("button", { name: "Save Password" }).click();
  }
  await expect(home).toBeVisible({ timeout: 8_000 });
}

export async function logout(page: Page) {
  const profile = page.locator(".app-profile summary");
  if (!(await page.getByRole("button", { name: "Logout" }).isVisible())) await profile.click();
  await page.getByRole("button", { name: "Logout" }).click();
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
}

export async function fillCreateTicket(page: Page, summary: string, priority = "MEDIUM") {
  await page.goto("/tickets/new");
  await page.getByLabel("Category").selectOption({ label: "Hardware" });
  await page.getByLabel("Related System").selectOption({ label: "VPN" });
  await page.getByLabel("Requested Priority").selectOption(priority);
  await page.getByLabel("Ticket Summary").fill(summary);
  await page.getByLabel("Description").fill("The VPN fails after university credentials are entered.");
}
