import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import StaffQueue from "../../src/StaffQueue.js";
import * as api from "../../src/api.js";

const references = { categories: [{ id: 2, name: "Hardware" }], relatedSystems: [] };
const emptyQueue = { items: [], page: 1, pageSize: 10, totalItems: 0, totalPages: 0 };

function renderQueue(path: string) {
  return render(<MemoryRouter initialEntries={[path]}><StaffQueue /></MemoryRouter>);
}

afterEach(() => vi.restoreAllMocks());

describe("Lab 4 Staff Queue dashboard filters", () => {
  it("parses dashboard update-window filters, labels them, and clears them", async () => {
    vi.spyOn(api, "loadReferenceData").mockResolvedValue(references);
    const load = vi.spyOn(api, "loadStaffTickets").mockResolvedValue(emptyQueue);
    renderQueue("/staff/tickets?statusGroup=open&updatedAfter=2026-10-24T17%3A00%3A00.000Z&sortBy=updatedAt&direction=desc");

    expect(await screen.findByRole("heading", { name: "Ticket Queue" })).toBeInTheDocument();
    await waitFor(() => expect(load).toHaveBeenCalledWith(expect.objectContaining({ statusGroup: "open", updatedAfter: "2026-10-24T17:00:00.000Z", sortBy: "updatedAt", direction: "desc" })));
    expect(screen.getByText(/Active queue filters: Open Tickets/)).toBeInTheDocument();
    expect(screen.getByText(/Updated since/)).toBeInTheDocument();

    await userEvent.setup().click(screen.getAllByRole("button", { name: "Clear Filters" })[0]);
    await waitFor(() => expect(load).toHaveBeenLastCalledWith(expect.not.objectContaining({ statusGroup: "open", updatedAfter: expect.anything() })));
  });

  it("preserves the urgent priority group and dedicated sort without a conflicting status/priority", async () => {
    vi.spyOn(api, "loadReferenceData").mockResolvedValue(references);
    const load = vi.spyOn(api, "loadStaffTickets").mockResolvedValue(emptyQueue);
    renderQueue("/staff/tickets?statusGroup=open&itPriorityGroup=high_or_urgent&sortBy=urgentWork&direction=desc&status=RESOLVED&itPriority=LOW");

    await waitFor(() => {
      const request = load.mock.calls[load.mock.calls.length - 1][0];
      expect(request).toEqual(expect.objectContaining({ statusGroup: "open", itPriorityGroup: "high_or_urgent", sortBy: "urgentWork", status: "", itPriority: "" }));
      expect(request).not.toHaveProperty("direction");
    });
    expect(screen.getByLabelText("Sort by")).toHaveValue("urgentWork");
    expect(screen.getByLabelText("Direction")).toBeDisabled();
    expect(screen.getByLabelText("Direction")).toHaveValue("fixed");
    expect(screen.getByText(/URGENT tickets come first, then HIGH; tickets with older updates come first within each priority/)).toBeInTheDocument();
    expect(screen.getByText(/HIGH or URGENT IT Priority/)).toBeInTheDocument();

    await userEvent.setup().selectOptions(screen.getByLabelText("Current Status"), "RESOLVED");
    await waitFor(() => expect(load).toHaveBeenLastCalledWith(expect.objectContaining({ status: "RESOLVED", statusGroup: undefined, itPriorityGroup: undefined, sortBy: "updatedAt" })));
  });
});
