import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import StaffTicketDetail from "../../src/StaffTicketDetail.js";
import TicketStatusHistory from "../../src/TicketStatusHistory.js";
import * as api from "../../src/api.js";
import type { StaffTicketDetail as StaffTicketDetailData, TicketStatusEvent } from "../../src/api.js";

const ticket: StaffTicketDetailData = {
  id: 4, ticketNumber: "TKT-2026-WF123456", requesterId: 1, requester: { id: 1, name: "Requester One" },
  categoryId: 2, category: { id: 2, name: "Hardware" }, relatedSystemId: 3, relatedSystem: { id: 3, name: "VPN" },
  summary: "VPN cannot connect", description: "The VPN disconnects after sign-in.", requestedPriority: "MEDIUM", itPriority: "HIGH",
  status: "OPEN", ownerId: 7, owner: { id: 7, name: "Support One", role: "IT_STAFF" }, workflowVersion: 4,
  resolutionIndicatedAt: null, createdAt: "2026-10-29T08:00:00.000Z", updatedAt: "2026-10-29T09:00:00.000Z", attachments: [],
  ownerOptions: [{ id: 7, name: "Support One", role: "IT_STAFF" }],
};
const history: TicketStatusEvent[] = [
  { id: 1, ticketId: 4, fromStatus: "OPEN", toStatus: "IN_PROGRESS", actor: { id: 7, name: "Support One", role: "IT_STAFF" }, changedAt: "2026-10-29T09:00:00.000Z" },
  { id: 2, ticketId: 4, fromStatus: "IN_PROGRESS", toStatus: "WAITING_FOR_REQUESTER", actor: { id: 7, name: "Support One", role: "IT_STAFF" }, changedAt: "2026-10-29T10:00:00.000Z" },
];

afterEach(() => vi.restoreAllMocks());

describe("Ticket status workflow", () => {
  it("renders ordered, read-only history with actor and timestamp", async () => {
    vi.spyOn(api, "loadTicketStatusEvents").mockResolvedValue(history);
    render(<TicketStatusHistory ticketId={4} />);

    const entries = await screen.findAllByRole("listitem");
    expect(entries[0]).toHaveTextContent("Open → In Progress");
    expect(entries[0]).toHaveTextContent("Support One (IT Staff)");
    expect(entries[1]).toHaveTextContent("In Progress → Waiting for Requester");
    expect(screen.queryByRole("button", { name: /edit|delete/i })).not.toBeInTheDocument();
  });

  it("explains an empty history and retries a safe read failure", async () => {
    vi.spyOn(api, "loadTicketStatusEvents")
      .mockRejectedValueOnce(new api.ApiError("Unable to load Ticket status history.", 500))
      .mockResolvedValueOnce([]);
    const user = userEvent.setup();
    render(<TicketStatusHistory ticketId={4} />);

    expect(await screen.findByRole("alert")).toHaveTextContent("Unable to load Ticket status history.");
    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByText(/History begins with Lab 4 transitions/)).toBeInTheDocument();
  });

  it("sends the current workflow version and keeps a rejected target selected with focused gate feedback", async () => {
    vi.spyOn(api, "loadStaffTicket").mockResolvedValue(ticket);
    vi.spyOn(api, "loadPublicComments").mockResolvedValue([]);
    vi.spyOn(api, "loadInternalNotes").mockResolvedValue([]);
    vi.spyOn(api, "loadTicketStatusEvents").mockResolvedValue([]);
    const update = vi.spyOn(api, "updateStaffTicketStatus").mockRejectedValue(new api.ApiError(
      "Before resolving, complete or cancel 1 active Action and clear 1 required follow-up.", 409, "RESOLUTION_BLOCKED",
    ));
    const user = userEvent.setup();
    render(<MemoryRouter initialEntries={["/staff/tickets/4"]}><StaffTicketDetail ticketId={4} /></MemoryRouter>);

    await user.selectOptions(await screen.findByLabelText("Next status"), "RESOLVED");
    await user.click(screen.getByRole("button", { name: "Update Status" }));
    await user.click(screen.getByRole("button", { name: "Confirm status change" }));

    const feedback = await screen.findByRole("alert");
    expect(feedback).toHaveTextContent("complete or cancel 1 active Action");
    expect(feedback).toHaveFocus();
    expect(screen.getByRole("link", { name: "Review Actions Taken" })).toHaveAttribute("href", "#actions-taken-heading-4");
    expect(screen.getByLabelText("Next status")).toHaveValue("RESOLVED");
    expect(update).toHaveBeenCalledWith(4, "RESOLVED", ticket.workflowVersion);
    await waitFor(() => expect(api.loadStaffTicket).toHaveBeenCalledTimes(2));
  });
});
