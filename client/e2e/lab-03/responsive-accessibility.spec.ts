import { expect, test } from "@playwright/test";
import { accounts, capture, expectNoHorizontalOverflow, logout, signIn } from "./helpers";

const edgeViewports = [
  { width: 767, height: 900 },
  { width: 768, height: 900 },
  { width: 991, height: 900 },
  { width: 992, height: 900 },
] as const;

test("major Lab 3 screens remain usable at breakpoint edges", async ({ page }) => {
  await signIn(page, accounts.admin, "User Management");
  for (const viewport of edgeViewports) {
    await page.setViewportSize(viewport);
    await page.goto("/admin/users");
    await expect(page.getByRole("heading", { name: "User Management" })).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await capture(page, "user-management", `breakpoint-${viewport.width}`, viewport);
  }

  await logout(page);
  await signIn(page, accounts.anan, "My Tickets");
  for (const viewport of edgeViewports.slice(0, 2)) {
    await page.setViewportSize(viewport);
    await page.goto("/tickets");
    await expect(page.getByRole("heading", { name: "My Tickets" })).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await capture(page, "requester", `my-tickets-breakpoint-${viewport.width}`, viewport);
  }
});
