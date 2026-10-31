import { expect, test, type Page } from "../../client/e2e/test-api";
import { accounts, expectNoHorizontalOverflow, logout, signIn } from "../../client/e2e/lab-03/helpers";
import { captureLab4AllViewports } from "../../client/e2e/lab-04/helpers";

async function expectDashboardLayout(page: Page, role: "requester" | "staff") {
  for (const width of [1440, 820, 390, 767, 768, 991, 992]) {
    await page.setViewportSize({ width, height: width === 820 ? 1180 : width === 390 ? 844 : 1000 });
    await expectNoHorizontalOverflow(page);
    const metricColumns = await page.locator(".dashboard-metrics").evaluate((element) => getComputedStyle(element).gridTemplateColumns.split(" ").length);
    const expectedColumns = width < 768 ? 1 : role === "requester" && width >= 992 ? 3 : 2;
    expect(metricColumns).toBe(expectedColumns);
    const listColumns = await page.locator(".dashboard-list-grid").evaluate((element) => getComputedStyle(element).gridTemplateColumns.split(" ").length);
    expect(listColumns).toBe(width >= 992 ? 2 : 1);
  }
}

test("role dashboards have keyboard-accessible drill-downs and responsive layouts", async ({ page }) => {
  const browserErrors: string[] = [];
  const unauthorizedPaths: string[] = [];
  page.on("pageerror", (error) => browserErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error" && !/Failed to load resource: .*401 \(Unauthorized\)/.test(message.text())) {
      browserErrors.push(message.text());
    }
  });
  page.on("response", (response) => {
    if (response.status() === 401) unauthorizedPaths.push(new URL(response.url()).pathname);
  });

  await signIn(page, accounts.anan, "Dashboard");
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  await expect(page.locator("main")).not.toContainText(/\b(?:TODO|TBD|coming soon|placeholder)\b/i);
  const navigation = page.getByRole("navigation", { name: "Main navigation" });
  await expect(navigation.getByRole("link", { name: "Dashboard" })).toHaveAttribute("aria-current", "page");
  await expect(navigation.getByRole("link", { name: "My Tickets" })).toBeVisible();
  await expect(navigation.getByRole("link", { name: "Create Ticket" })).toBeVisible();

  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.locator(".dashboard-metric").first()).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/tickets\?statusGroup=open/);
  await expect(page.getByText(/Active filters: Open Tickets/)).toBeVisible();
  await page.goto("/dashboard");
  await expect(page.locator(".dashboard-metric").first()).toBeVisible();
  await expectDashboardLayout(page, "requester");
  await captureLab4AllViewports(page, "requester-dashboard", "/dashboard", "requester-dashboard");

  await logout(page);
  await signIn(page, accounts.supportOne, "Dashboard");
  await expect(page.getByRole("link", { name: "Ticket Queue" })).toBeVisible();
  await expect(page.getByRole("link", { name: "My Tickets" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Tickets by Status" })).toBeVisible();
  await expect(page.locator("main")).not.toContainText(/\b(?:TODO|TBD|coming soon|placeholder)\b/i);

  await page.getByRole("link", { name: /Unassigned Open Tickets/ }).click();
  await expect(page).toHaveURL(/\/staff\/tickets\?statusGroup=open&ownership=unassigned/);
  await expect(page.getByText(/Active queue filters: Open Tickets/)).toBeVisible();
  await page.goto("/dashboard");
  await expect(page.getByRole("link", { name: /View urgent work/i })).toBeVisible();
  await expectDashboardLayout(page, "staff");
  await captureLab4AllViewports(page, "staff-dashboard", "/dashboard", "staff-dashboard");
  expect(browserErrors).toEqual([]);
  // A rerun may need to retry the first-login seed password after an earlier
  // run already changed it; that expected fallback receives 401 from login.
  expect(unauthorizedPaths.every((pathname) => pathname === "/api/auth/me" || pathname === "/api/auth/login")).toBe(true);
});
