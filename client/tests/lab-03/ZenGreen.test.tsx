import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import StaffQueue from "../../src/StaffQueue.js";
import * as api from "../../src/api.js";

const queue = {
  items: [{
    id: 3,
    ticketNumber: "TKT-2026-ZEN",
    summary: "Cannot connect to VPN",
    requestedPriority: "HIGH" as const,
    itPriority: "URGENT" as const,
    status: "OPEN" as const,
    category: { id: 2, name: "Hardware" },
    requester: { id: 1, name: "Nicha Somchai" },
    ownerId: null,
    owner: null,
    resolutionIndicatedAt: null,
    createdAt: "2026-08-03T00:00:00.000Z",
    updatedAt: "2026-08-04T00:00:00.000Z",
  }],
  page: 1,
  pageSize: 10,
  totalItems: 1,
  totalPages: 1,
};

afterEach(() => vi.restoreAllMocks());

describe("Zen Green visual tokens", () => {
  it("uses shared badges, cards, links, and labelled controls for queue data", async () => {
    vi.spyOn(api, "loadReferenceData").mockResolvedValue({ categories: [{ id: 2, name: "Hardware" }], relatedSystems: [] });
    vi.spyOn(api, "loadStaffTickets").mockResolvedValue(queue);

    render(<MemoryRouter initialEntries={["/staff/tickets"]}><StaffQueue /></MemoryRouter>);

    expect(await screen.findByRole("heading", { name: "Ticket Queue" })).toBeInTheDocument();
    expect(document.querySelector(".ticket-table-card")).toBeInTheDocument();
    expect(document.querySelector(".zen-priority-high")).toHaveTextContent("High");
    expect(document.querySelector(".zen-priority-urgent")).toHaveTextContent("Urgent");
    expect(document.querySelector(".zen-status-open")).toHaveTextContent("Open");
    expect(screen.getByLabelText("Search tickets")).toBeInTheDocument();
    expect(screen.getByLabelText("Current Status")).toBeInTheDocument();
  });
});
