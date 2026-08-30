import { expect, test, type Page } from "@playwright/test";

async function selectRequester(page: Page, name: string) {
  await page.goto("/");
  await page.getByLabel("Development Requester").selectOption({ label: name });
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("heading", { name: "My Tickets" })).toBeVisible();
}

test("switching requesters hides another requester’s ticket", async ({ page }) => {
  const summary = `E2E ownership ${Date.now()}`;
  await selectRequester(page, "Nicha Somchai");
  await page.goto("/tickets/new");
  await page.getByLabel(/Category/).selectOption({ label: "Hardware" });
  await page.getByLabel(/Related System/).selectOption({ label: "VPN" });
  await page.getByLabel(/Ticket Summary/).fill(summary);
  await page.getByLabel(/Description/).fill("The VPN fails after university credentials are entered.");
  await page.getByRole("button", { name: "Submit Ticket" }).click();
  await page.getByRole("link", { name: "View My Tickets" }).click();
  const row = page.locator("tr", { hasText: summary });
  const detailRoute = await row.getByRole("link", { name: "Open" }).getAttribute("href");

  await page.getByRole("button", { name: "Change Requester" }).click();
  await page.getByLabel("Development Requester").selectOption({ label: "Anan Kittisak" });
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByText(summary)).toHaveCount(0);
  await page.goto(detailRoute!);
  await expect(page.getByRole("alert")).toContainText("Unable to load ticket.");
});
