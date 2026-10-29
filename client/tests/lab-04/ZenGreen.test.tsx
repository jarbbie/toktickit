import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Dashboard from "../../src/Dashboard.js";
import * as api from "../../src/api.js";

const staff = { id: 7, name: "Support One", email: "support@example.test", role: "IT_STAFF" as const, isActive: true, mustChangePassword: false };

afterEach(() => vi.restoreAllMocks());

describe("Lab 4 dashboard Zen Green and accessible states", () => {
  it("uses semantic linked cards, visible status text, and the existing badge palette", async () => {
    vi.spyOn(api, "loadStaffDashboard").mockResolvedValue({
      asOf: "2026-10-30T03:00:00.000Z",
      windowStart: "2026-10-24T17:00:00.000Z",
      counts: {
        unassignedOpen: { count: 0, href: "/staff/tickets?statusGroup=open&ownership=unassigned" },
        ownedByMeOpen: { count: 0, href: "/staff/tickets?statusGroup=open&ownership=mine" },
        byStatus: [],
        byITPriority: [],
      },
      recentlyUpdated: [{ id: 2, ticketNumber: "TKT-2026-ABC12345", summary: "VPN access is unavailable", requester: { id: 1, name: "Requester One" }, status: "WAITING_FOR_REQUESTER", itPriority: "URGENT", owner: null, updatedAt: "2026-10-30T02:00:00.000Z", href: "/staff/tickets/2" }],
      urgentTickets: [],
    });
    const { container } = render(<MemoryRouter><Dashboard user={staff} /></MemoryRouter>);

    const linkedCard = await screen.findByRole("link", { name: /Unassigned Open Tickets: 0/ });
    expect(linkedCard).toHaveClass("card", "dashboard-metric");
    expect(container.querySelector(".zen-status-waiting-for-requester")).toHaveTextContent("Waiting for Requester");
    expect(container.querySelector(".zen-priority-urgent")).toHaveTextContent("Urgent");
    expect(container.querySelector(".dashboard-ticket-link")).toHaveAttribute("href", "/staff/tickets/2");
    expect(screen.getByRole("link", { name: /Unassigned Open Tickets: 0/ })).toHaveAccessibleName(/View matching tickets/);
  });

  it("announces loading and keeps the dashboard heading available", () => {
    vi.spyOn(api, "loadStaffDashboard").mockReturnValue(new Promise(() => {}));
    render(<MemoryRouter><Dashboard user={staff} /></MemoryRouter>);

    expect(screen.getByRole("status")).toHaveTextContent("Loading dashboard…");
    expect(screen.getByRole("heading", { name: "Dashboard" })).toBeInTheDocument();
  });
});
