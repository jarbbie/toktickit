import { afterEach, describe, expect, it, vi } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import App from "../../src/App.js";
import * as api from "../../src/api.js";
import type { RequesterDashboard, TicketDetail } from "../../src/api.js";

const dashboard: RequesterDashboard = {
  asOf: "2026-10-30T03:00:00.000Z",
  windowStart: "2026-10-24T17:00:00.000Z",
  counts: {
    openTickets: { count: 2, href: "/tickets?statusGroup=open" },
    waitingForRequester: { count: 1, href: "/tickets?status=WAITING_FOR_REQUESTER" },
    recentlyResolved: { count: 1, href: "/tickets?statusGroup=resolved&resolvedAfter=2026-10-24T17%3A00%3A00.000Z&sortBy=resolvedAt&direction=desc" },
  },
  recentlyUpdated: [{ id: 12, ticketNumber: "TKT-2026-ABC12345", summary: "VPN disconnects after login", status: "OPEN", itPriority: "HIGH", updatedAt: "2026-10-30T02:00:00.000Z", href: "/tickets/12" }],
  recentlyResolvedTickets: [{ id: 14, ticketNumber: "TKT-2026-DEF12345", summary: "Printer access restored", status: "RESOLVED", itPriority: "MEDIUM", updatedAt: "2026-10-29T02:00:00.000Z", resolvedAt: "2026-10-29T02:00:00.000Z", href: "/tickets/14" }],
};

const referenceData = { categories: [{ id: 2, name: "Hardware" }], relatedSystems: [{ id: 3, name: "VPN" }] };

function renderApp(path = "/dashboard") {
  return render(<MemoryRouter initialEntries={[path]}><App /></MemoryRouter>);
}

afterEach(() => vi.restoreAllMocks());

describe("Requester Dashboard", () => {
  it("shows requester metrics, owned Ticket links, active navigation, and keyboard focus", async () => {
    vi.spyOn(api, "loadReferenceData").mockResolvedValue(referenceData);
    vi.spyOn(api, "loadRequesterDashboard").mockResolvedValue(dashboard);
    const user = userEvent.setup();
    renderApp();

    const heading = await screen.findByRole("heading", { name: "Dashboard" });
    expect(heading).toHaveFocus();
    expect(screen.getByRole("link", { name: "Dashboard" })).toHaveAttribute("aria-current", "page");
    expect(await screen.findByRole("link", { name: /Open Tickets: 2/ })).toHaveAttribute("href", "/tickets?statusGroup=open");
    expect(screen.getByRole("link", { name: /Waiting for Requester: 1/ })).toHaveAttribute("href", "/tickets?status=WAITING_FOR_REQUESTER");
    expect(screen.getByRole("link", { name: /Recently Resolved: 1/ })).toHaveAttribute("href", dashboard.counts.recentlyResolved.href);
    expect(screen.getByRole("link", { name: /TKT-2026-ABC12345/ })).toHaveAttribute("href", "/tickets/12");
    expect(screen.getByRole("link", { name: /TKT-2026-DEF12345/ })).toHaveTextContent("Resolved");
    expect(screen.queryByText(/requesterId/i)).not.toBeInTheDocument();

    await user.tab();
    expect(screen.getByRole("link", { name: /Open Tickets: 2/ })).toHaveFocus();
  });

  it("focuses the Ticket Detail heading after a dashboard link loads asynchronously", async () => {
    vi.spyOn(api, "loadReferenceData").mockResolvedValue(referenceData);
    vi.spyOn(api, "loadRequesterDashboard").mockResolvedValue(dashboard);
    vi.spyOn(api, "loadPublicComments").mockResolvedValue([]);
    let resolveTicket!: (value: TicketDetail) => void;
    const pendingTicket = new Promise<TicketDetail>((resolve) => { resolveTicket = resolve; });
    const loadTicket = vi.spyOn(api, "loadTicket").mockReturnValue(pendingTicket);
    const user = userEvent.setup();
    renderApp();

    const dashboardTicketLink = await screen.findByRole("link", { name: /TKT-2026-ABC12345/ });
    await user.click(dashboardTicketLink);
    expect(await screen.findByText("Loading ticket…")).toBeInTheDocument();
    expect(loadTicket).toHaveBeenCalledWith(12);

    await act(async () => {
      resolveTicket({
        id: 12,
        ticketNumber: "TKT-2026-ABC12345",
        summary: "VPN disconnects after login",
        requestedPriority: "MEDIUM",
        itPriority: "HIGH",
        status: "OPEN",
        category: { id: 2, name: "Hardware" },
        createdAt: "2026-10-29T00:00:00.000Z",
        updatedAt: "2026-10-30T02:00:00.000Z",
        requesterId: 1,
        requester: { id: 1, name: "Nicha Somchai" },
        description: "VPN disconnects after login.",
        categoryId: 2,
        relatedSystemId: 3,
        relatedSystem: { id: 3, name: "VPN" },
        ownerId: null,
        owner: null,
        workflowVersion: 1,
        resolutionIndicatedAt: null,
        attachments: [],
      });
    });

    const ticketHeading = await screen.findByRole("heading", { name: "Ticket Details" });
    await waitFor(() => expect(ticketHeading).toHaveFocus());
  });

  it("renders visible zero counts and helpful empty list actions", async () => {
    vi.spyOn(api, "loadReferenceData").mockResolvedValue(referenceData);
    vi.spyOn(api, "loadRequesterDashboard").mockResolvedValue({
      ...dashboard,
      counts: {
        openTickets: { count: 0, href: "/tickets?statusGroup=open" },
        waitingForRequester: { count: 0, href: "/tickets?status=WAITING_FOR_REQUESTER" },
        recentlyResolved: { count: 0, href: "/tickets?statusGroup=resolved" },
      },
      recentlyUpdated: [],
      recentlyResolvedTickets: [],
    });
    renderApp();

    expect(await screen.findByRole("link", { name: /Open Tickets: 0/ })).toBeInTheDocument();
    expect(screen.getByText("No recently updated tickets. Create a ticket when you need support.")).toBeInTheDocument();
    expect(screen.getByText("No tickets have been resolved in this period. Your tickets remain available in My Tickets.")).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Create Ticket" })).toHaveLength(3);
  });

  it("shows a safe forbidden state without dashboard rows", async () => {
    vi.spyOn(api, "loadReferenceData").mockResolvedValue(referenceData);
    vi.spyOn(api, "loadRequesterDashboard").mockRejectedValue(new api.ApiError("Forbidden", 403, "FORBIDDEN"));
    renderApp();

    expect(await screen.findByRole("alert")).toHaveTextContent("You do not have permission to view this dashboard.");
    expect(screen.queryByText("VPN disconnects after login")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Open Tickets/ })).not.toBeInTheDocument();
  });
});
