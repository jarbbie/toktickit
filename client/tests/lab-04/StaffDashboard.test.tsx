import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import App from "../../src/App.js";
import * as api from "../../src/api.js";
import type { StaffDashboard } from "../../src/api.js";

const staffDashboard: StaffDashboard = {
  asOf: "2026-10-30T03:00:00.000Z",
  windowStart: "2026-10-24T17:00:00.000Z",
  counts: {
    unassignedOpen: { count: 3, href: "/staff/tickets?statusGroup=open&ownership=unassigned" },
    ownedByMeOpen: { count: 2, href: "/staff/tickets?statusGroup=open&ownership=mine" },
    byStatus: [
      { status: "NEW", count: 2, href: "/staff/tickets?status=NEW" },
      { status: "OPEN", count: 3, href: "/staff/tickets?status=OPEN" },
      { status: "IN_PROGRESS", count: 1, href: "/staff/tickets?status=IN_PROGRESS" },
      { status: "WAITING_FOR_REQUESTER", count: 1, href: "/staff/tickets?status=WAITING_FOR_REQUESTER" },
      { status: "RESOLVED", count: 4, href: "/staff/tickets?status=RESOLVED" },
      { status: "CLOSED", count: 1, href: "/staff/tickets?status=CLOSED" },
      { status: "REOPENED", count: 0, href: "/staff/tickets?status=REOPENED" },
      { status: "CANCELLED", count: 0, href: "/staff/tickets?status=CANCELLED" },
    ],
    byITPriority: [
      { itPriority: "LOW", count: 0, href: "/staff/tickets?statusGroup=open&itPriority=LOW" },
      { itPriority: "MEDIUM", count: 2, href: "/staff/tickets?statusGroup=open&itPriority=MEDIUM" },
      { itPriority: "HIGH", count: 2, href: "/staff/tickets?statusGroup=open&itPriority=HIGH" },
      { itPriority: "URGENT", count: 1, href: "/staff/tickets?statusGroup=open&itPriority=URGENT" },
    ],
  },
  recentlyUpdated: [{ id: 40, ticketNumber: "TKT-2026-ABC12345", summary: "Campus VPN unavailable", requester: { id: 2, name: "Requester One" }, status: "OPEN", itPriority: "HIGH", owner: null, updatedAt: "2026-10-30T02:00:00.000Z", href: "/staff/tickets/40" }],
  urgentTickets: [{ id: 41, ticketNumber: "TKT-2026-DEF12345", summary: "Gateway offline", requester: { id: 3, name: "Requester Two" }, status: "IN_PROGRESS", itPriority: "URGENT", owner: { id: 7, name: "Support One", role: "IT_STAFF" }, updatedAt: "2026-10-29T02:00:00.000Z", href: "/staff/tickets/41" }],
  myActionsTaken: { count: 2, recent: [
    { id: 101, ticketId: 41, ticketNumber: "TKT-2026-DEF12345", summary: "Gateway offline", description: "Replaced the uplink cable.", status: "COMPLETED", actionAt: "2026-10-30T02:30:00.000Z", href: "/staff/tickets/41" },
    { id: 100, ticketId: 40, ticketNumber: "TKT-2026-ABC12345", summary: "Campus VPN unavailable", description: "Checked the authentication service.", status: "IN_PROGRESS", actionAt: "2026-10-30T01:30:00.000Z", href: "/staff/tickets/40" },
  ] },
};

function renderApp(path = "/dashboard") {
  return render(<MemoryRouter initialEntries={[path]}><App /></MemoryRouter>);
}

afterEach(() => vi.restoreAllMocks());

describe("Staff and Administrator Dashboard", () => {
  it("shows operational counts, all status links, priorities, and exact queue drill-downs", async () => {
    vi.spyOn(api, "currentUser").mockResolvedValue({
      user: { id: 7, name: "Support One", email: "support@example.test", role: "IT_STAFF", isActive: true, mustChangePassword: false },
      expiresAt: "2026-10-30T04:00:00.000Z",
    });
    const load = vi.spyOn(api, "loadStaffDashboard").mockResolvedValue(staffDashboard);
    renderApp();

    expect(await screen.findByRole("heading", { name: "Dashboard" })).toBeInTheDocument();
    expect(load).toHaveBeenCalledOnce();
    expect(await screen.findByRole("link", { name: /Unassigned Open Tickets: 3/ })).toHaveAttribute("href", staffDashboard.counts.unassignedOpen.href);
    expect(screen.getByRole("link", { name: /My Open Tickets: 2/ })).toHaveAttribute("href", staffDashboard.counts.ownedByMeOpen.href);
    expect(screen.getByRole("link", { name: /Reopened 0/ })).toHaveAttribute("href", "/staff/tickets?status=REOPENED");
    expect(screen.getByRole("link", { name: /Low/ })).toHaveAttribute("href", "/staff/tickets?statusGroup=open&itPriority=LOW");
    expect(screen.getByRole("link", { name: /View recent tickets/ })).toHaveAttribute("href", expect.stringContaining("/staff/tickets?statusGroup=open&updatedAfter="));
    expect(screen.getByRole("link", { name: /View urgent work/ })).toHaveAttribute("href", "/staff/tickets?statusGroup=open&itPriorityGroup=high_or_urgent&sortBy=urgentWork");
    expect(screen.getByRole("link", { name: /Requester: Requester One/ })).toHaveAttribute("href", "/staff/tickets/40");
    expect(screen.getByRole("link", { name: /Requester: Requester One/ })).toHaveTextContent("Unassigned");
    expect(screen.getByRole("link", { name: /Owner: Support One/ })).toHaveTextContent("TKT-2026-DEF12345");
    expect(screen.getByRole("heading", { name: "My Actions Taken" })).toBeInTheDocument();
    expect(screen.getByLabelText("2 Actions Taken")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Replaced the uplink cable/ })).toHaveAttribute("href", "/staff/tickets/41");
    expect(screen.getByRole("link", { name: /Checked the authentication service/ })).toHaveAttribute("href", "/staff/tickets/40");
    expect(screen.queryByText("private.requester@example.test")).not.toBeInTheDocument();
  });

  it("renders the same operational dashboard for Administrators", async () => {
    vi.spyOn(api, "currentUser").mockResolvedValue({
      user: { id: 9, name: "Admin One", email: "admin@example.test", role: "ADMINISTRATOR", isActive: true, mustChangePassword: false },
      expiresAt: "2026-10-30T04:00:00.000Z",
    });
    vi.spyOn(api, "loadStaffDashboard").mockResolvedValue(staffDashboard);
    renderApp();

    expect(await screen.findByRole("heading", { name: "Dashboard" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "User Management" })).toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: "Urgent Work" })).toBeInTheDocument();
  });

  it("keeps zero counts visible and distinguishes empty work lists", async () => {
    vi.spyOn(api, "currentUser").mockResolvedValue({
      user: { id: 7, name: "Support One", email: "support@example.test", role: "IT_STAFF", isActive: true, mustChangePassword: false },
      expiresAt: "2026-10-30T04:00:00.000Z",
    });
    vi.spyOn(api, "loadStaffDashboard").mockResolvedValue({
      ...staffDashboard,
      counts: { ...staffDashboard.counts, unassignedOpen: { count: 0, href: "/staff/tickets?statusGroup=open&ownership=unassigned" } },
      recentlyUpdated: [], urgentTickets: [], myActionsTaken: { count: 0, recent: [] },
    });
    renderApp();

    expect(await screen.findByRole("link", { name: /Unassigned Open Tickets: 0/ })).toBeInTheDocument();
    expect(screen.getByText("No recently updated open tickets. View the Ticket Queue for current work.")).toBeInTheDocument();
    expect(screen.getByText("No HIGH or URGENT open tickets. View the Ticket Queue for all work.")).toBeInTheDocument();
    expect(screen.getByText("You have not recorded any Actions Taken yet.")).toBeInTheDocument();
  });

  it("shows a retryable generic failure without stale rows", async () => {
    vi.spyOn(api, "currentUser").mockResolvedValue({
      user: { id: 7, name: "Support One", email: "support@example.test", role: "IT_STAFF", isActive: true, mustChangePassword: false },
      expiresAt: "2026-10-30T04:00:00.000Z",
    });
    vi.spyOn(api, "loadStaffDashboard").mockRejectedValueOnce(new Error("database connection string leaked")).mockResolvedValueOnce(staffDashboard);
    const user = userEvent.setup();
    renderApp();

    expect(await screen.findByRole("alert")).toHaveTextContent("Unable to load dashboard.");
    expect(screen.queryByText("database connection string leaked")).not.toBeInTheDocument();
    expect(screen.queryByText("Campus VPN unavailable")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByRole("link", { name: /Unassigned Open Tickets: 3/ })).toBeInTheDocument();
  });

  it("shows a safe forbidden response without dashboard data", async () => {
    vi.spyOn(api, "currentUser").mockResolvedValue({
      user: { id: 7, name: "Support One", email: "support@example.test", role: "IT_STAFF", isActive: true, mustChangePassword: false },
      expiresAt: "2026-10-30T04:00:00.000Z",
    });
    vi.spyOn(api, "loadStaffDashboard").mockRejectedValue(new api.ApiError("Forbidden", 403, "FORBIDDEN"));
    renderApp();

    expect(await screen.findByRole("alert")).toHaveTextContent("You do not have permission to view this dashboard.");
    expect(screen.queryByText("Campus VPN unavailable")).not.toBeInTheDocument();
  });
});
