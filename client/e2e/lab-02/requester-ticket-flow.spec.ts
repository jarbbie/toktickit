import { expect, test } from "@playwright/test";
import { accounts, capture, captureAllViewports, fillCreateTicket, logout, signIn } from "../lab-03/helpers";

test("Lab 2 requester Ticket flow continues through authenticated Lab 3 identity", async ({ page }) => {
  await signIn(page, accounts.mali, "My Tickets");
  await page.goto("/tickets/new");
  await page.getByRole("button", { name: "Submit Ticket" }).click();
  await expect(page.getByText("Category is required.")).toBeVisible();
  await capture(page, "requester", "lab2-create-validation");

  const summary = `Lab 2 regression ${Date.now()}`;
  await fillCreateTicket(page, summary);
  await page.getByRole("button", { name: "Submit Ticket" }).click();
  await expect(page.getByRole("heading", { name: /Ticket created:/ })).toBeVisible();
  const detailRoute = await page.getByRole("link", { name: "View Ticket Details" }).getAttribute("href");
  await page.getByRole("link", { name: "View Ticket Details" }).click();
  await expect(page.getByLabel("Requester")).toHaveValue("Mali Charoen");

  await page.getByLabel("Add attachment").setInputFiles({ name: "lab2-regression.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4\nLab 2 regression") });
  await page.getByRole("button", { name: "Upload attachment" }).click();
  const attachment = page.getByRole("listitem").filter({ hasText: "lab2-regression.pdf" });
  await expect(attachment).toBeVisible();
  const [download] = await Promise.all([page.waitForEvent("download"), attachment.getByRole("link", { name: "Download" }).click()]);
  expect(download.suggestedFilename()).toBe("lab2-regression.pdf");
  await attachment.getByRole("button", { name: "Remove" }).click();
  await page.getByLabel("Removal reason").fill("Lab 2 regression removal");
  await page.getByRole("button", { name: "Confirm removal" }).click();
  await expect(attachment.getByText("Removed")).toBeVisible();

  await page.goto("/tickets");
  await expect(page.locator("tr", { hasText: summary })).toBeVisible();

  const categoryResponse = await page.request.get("http://localhost:3000/api/categories");
  const relatedSystemResponse = await page.request.get("http://localhost:3000/api/related-systems");
  expect(categoryResponse.ok()).toBe(true);
  expect(relatedSystemResponse.ok()).toBe(true);
  const categories = await categoryResponse.json() as Array<{ id: number; name: string }>;
  const relatedSystems = await relatedSystemResponse.json() as Array<{ id: number; name: string }>;
  const categoryId = categories.find((item) => item.name === "Hardware")?.id;
  const relatedSystemId = relatedSystems.find((item) => item.name === "VPN")?.id;
  if (categoryId === undefined || relatedSystemId === undefined) throw new Error("Seed reference data is missing Hardware or VPN.");
  const paginationTickets = await Promise.all(Array.from({ length: 10 }, (_, index) => page.request.post("http://localhost:3000/api/tickets", {
    headers: { Origin: "http://localhost:5173" },
    data: {
      categoryId,
      relatedSystemId,
      requestedPriority: "MEDIUM",
      summary: `Pagination evidence ${Date.now()}-${index}`,
      description: "Ticket created to demonstrate the owned paginated list.",
    },
  })));
  expect(paginationTickets.every((response) => response.ok())).toBe(true);

  await page.getByLabel("Category").selectOption({ label: "Hardware" });
  await page.getByLabel("Requested Priority").selectOption("MEDIUM");
  await page.getByLabel("Current Status").selectOption("NEW");
  await page.getByRole("button", { name: /Sort by Ticket Number/ }).click();
  await expect(page.getByRole("button", { name: /Next/ })).toBeEnabled();
  await page.getByRole("button", { name: /Next/ }).click();
  await expect(page.locator(".current-page")).toHaveText("2");

  await page.getByLabel("Search tickets").fill("no-ticket-can-match-this");
  await expect(page.getByText("No tickets match your filters.")).toBeVisible();

  await page.goto("/tickets/new");
  await page.getByLabel("Category").selectOption({ label: "Hardware" });
  await page.getByLabel("Related System").selectOption({ label: "VPN" });
  await page.getByLabel("Ticket Summary").fill("Preserved after API failure");
  await page.getByLabel("Description").fill("These values must remain after the safe API failure.");
  await page.route("**/api/tickets", (route) => route.fulfill({
    status: 500,
    contentType: "application/json",
    body: '{"error":"Unable to create ticket."}',
  }), { times: 1 });
  await page.getByRole("button", { name: "Submit Ticket" }).click();
  await expect(page.getByRole("alert")).toContainText("Unable to create ticket.");
  await expect(page.getByLabel("Ticket Summary")).toHaveValue("Preserved after API failure");

  await page.route("**/api/tickets*", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ items: [], page: 1, pageSize: 10, totalItems: 0, totalPages: 0 }),
  }));
  await page.goto("/tickets");
  await expect(page.getByText("No tickets yet.")).toBeVisible();
  await page.unroute("**/api/tickets*");

  await captureAllViewports(page, "requester", detailRoute!, "lab2-ticket-detail");
  await logout(page);
});
