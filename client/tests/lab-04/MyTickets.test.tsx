import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import App from "../../src/App.js";
import * as api from "../../src/api.js";

const referenceData = { categories: [{ id: 2, name: "Hardware" }], relatedSystems: [{ id: 3, name: "VPN" }] };
const emptyList = { items: [], page: 1, pageSize: 10, totalItems: 0, totalPages: 0 };
const resolvedList = {
  items: [{ id: 1, ticketNumber: "TKT-2026-RESOLVED", summary: "Resolved VPN issue", requestedPriority: "MEDIUM" as const, itPriority: "LOW" as const, status: "RESOLVED" as const, category: { id: 2, name: "Hardware" }, createdAt: "2026-10-20T00:00:00.000Z", updatedAt: "2026-10-29T00:00:00.000Z", resolvedAt: "2026-10-29T00:00:00.000Z" }],
  page: 1, pageSize: 10, totalItems: 1, totalPages: 1,
};

function renderApp(path: string) {
  return render(<MemoryRouter initialEntries={[path]}><App /></MemoryRouter>);
}

afterEach(() => vi.restoreAllMocks());

describe("Lab 4 My Tickets dashboard filters", () => {
  it("parses and labels the resolved window and preserves resolution-time sorting", async () => {
    vi.spyOn(api, "loadReferenceData").mockResolvedValue(referenceData);
    const load = vi.spyOn(api, "loadTickets").mockResolvedValue(resolvedList);
    renderApp("/tickets?statusGroup=resolved&resolvedAfter=2026-10-24T17%3A00%3A00.000Z&sortBy=resolvedAt&direction=desc");

    expect(await screen.findByRole("heading", { name: "My Tickets" })).toBeInTheDocument();
    await waitFor(() => expect(load).toHaveBeenCalledWith(expect.objectContaining({ statusGroup: "resolved", resolvedAfter: "2026-10-24T17:00:00.000Z", sortBy: "resolvedAt", direction: "desc" })));
    expect(screen.getByText(/Active filters: Resolved Tickets/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Sort by Resolved Date/ })).toBeInTheDocument();

    await userEvent.setup().click(screen.getAllByRole("button", { name: "Clear Filters" })[0]);
    await waitFor(() => expect(load).toHaveBeenLastCalledWith(expect.not.objectContaining({ statusGroup: "resolved", resolvedAfter: expect.anything() })));
  });

  it("keeps a status group distinct from explicit status and shows the filter label", async () => {
    vi.spyOn(api, "loadReferenceData").mockResolvedValue(referenceData);
    const load = vi.spyOn(api, "loadTickets").mockResolvedValue(emptyList);
    renderApp("/tickets?statusGroup=open&status=RESOLVED");

    expect(await screen.findByRole("heading", { name: "My Tickets" })).toBeInTheDocument();
    await waitFor(() => expect(load).toHaveBeenCalledWith(expect.objectContaining({ statusGroup: "open", status: "" })));
    expect(screen.getByText(/Active filters: Open Tickets/)).toBeInTheDocument();
    expect(screen.getByLabelText("Current Status")).toHaveValue("");
  });
});
