import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import StaffQueue from "../../src/StaffQueue.js";
import * as api from "../../src/api.js";

const staff = { id: 7, name: "Support One", email: "support.one@toktickit.test", role: "IT_STAFF" as const, isActive: true, mustChangePassword: false };
const references = { categories: [{ id: 2, name: "Hardware" }], relatedSystems: [] };
const queue = {
  items: [{
    id: 3, ticketNumber: "TKT-2026-C", summary: "Cannot connect to VPN", requestedPriority: "HIGH" as const, itPriority: "URGENT" as const, status: "OPEN" as const,
    category: { id: 2, name: "Hardware" }, requester: { id: 1, name: "Nicha Somchai" }, ownerId: 7, owner: staff, resolutionIndicatedAt: null,
    createdAt: "2026-08-03T00:00:00.000Z", updatedAt: "2026-08-04T00:00:00.000Z",
  }],
  page: 1, pageSize: 10, totalItems: 1, totalPages: 1,
};

function renderQueue() {
  return render(<MemoryRouter initialEntries={["/staff/tickets"]}><StaffQueue /></MemoryRouter>);
}

afterEach(() => vi.restoreAllMocks());

describe("Staff Ticket Queue", () => {
  it("shows queue fields, responsive card content, and sends filter controls to the API", async () => {
    vi.spyOn(api, "currentUser").mockResolvedValue({ user: staff, expiresAt: "2026-09-19T00:00:00.000Z" });
    vi.spyOn(api, "loadReferenceData").mockResolvedValue(references);
    const loadQueue = vi.spyOn(api, "loadStaffTickets").mockResolvedValue(queue);
    const user = userEvent.setup();
    renderQueue();

    expect(await screen.findByRole("heading", { name: "Ticket Queue" })).toBeInTheDocument();
    expect(screen.getAllByText("TKT-2026-C")).toHaveLength(2);
    expect(screen.getByText("Nicha Somchai")).toBeInTheDocument();
    expect(screen.getAllByText("Urgent").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Open").length).toBeGreaterThan(0);
    expect(document.querySelector(".staff-queue-mobile")).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText("IT Priority"), "URGENT");
    await waitFor(() => expect(loadQueue).toHaveBeenLastCalledWith(expect.objectContaining({ itPriority: "URGENT", page: 1 })));
    await user.selectOptions(screen.getByLabelText("Ownership"), "mine");
    await waitFor(() => expect(loadQueue).toHaveBeenLastCalledWith(expect.objectContaining({ itPriority: "URGENT", ownership: "mine" })));
    expect(screen.getAllByRole("link", { name: "TKT-2026-C" })[0]).toHaveAttribute("href", expect.stringContaining("/staff/tickets/3"));
  });

  it("shows a safe forbidden state without stale queue rows", async () => {
    vi.spyOn(api, "currentUser").mockResolvedValue({ user: staff, expiresAt: "2026-09-19T00:00:00.000Z" });
    vi.spyOn(api, "loadReferenceData").mockResolvedValue(references);
    vi.spyOn(api, "loadStaffTickets").mockRejectedValue(new api.ApiError("Access denied.", 403, "FORBIDDEN"));
    renderQueue();

    expect(await screen.findByRole("alert")).toHaveTextContent("You do not have permission to view the staff ticket queue.");
    expect(screen.queryByText("TKT-2026-C")).not.toBeInTheDocument();
  });

  it("distinguishes an empty queue from a filtered no-results state", async () => {
    vi.spyOn(api, "currentUser").mockResolvedValue({ user: staff, expiresAt: "2026-09-19T00:00:00.000Z" });
    vi.spyOn(api, "loadReferenceData").mockResolvedValue(references);
    vi.spyOn(api, "loadStaffTickets").mockResolvedValue({ ...queue, items: [], totalItems: 0, totalPages: 0 });
    const user = userEvent.setup();
    renderQueue();

    expect(await screen.findByText("No tickets are currently in the queue.")).toBeInTheDocument();
    await user.type(screen.getByLabelText("Search tickets"), "VPN");
    expect(await screen.findByText("No tickets match your filters.")).toBeInTheDocument();
  });
});
