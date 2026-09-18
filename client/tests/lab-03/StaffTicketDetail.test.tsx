import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import StaffTicketDetail from "../../src/StaffTicketDetail.js";
import App from "../../src/App.js";
import * as api from "../../src/api.js";
import type { StaffTicketDetail as StaffTicketDetailData } from "../../src/api.js";

const staff = { id: 7, name: "Support One", email: "support.one@toktickit.test", role: "IT_STAFF" as const, isActive: true, mustChangePassword: false };
const requester = { id: 1, name: "Nicha Somchai", email: "nicha@toktickit.test", role: "REQUESTER" as const, isActive: true, mustChangePassword: false };
const owners = [{ id: 7, name: "Support One", role: "IT_STAFF" as const }, { id: 9, name: "Admin One", role: "ADMINISTRATOR" as const }];
const attachment = { id: 11, originalName: "vpn.pdf", mimeType: "application/pdf", sizeBytes: 8, createdAt: "2026-09-18T08:00:00.000Z", removedAt: null, removalReason: null };
const removedAttachment = { id: 12, originalName: "old.png", mimeType: "image/png", sizeBytes: 2048, createdAt: "2026-09-18T07:00:00.000Z", removedAt: "2026-09-18T09:00:00.000Z", removalReason: "Duplicate" };
const ticket: StaffTicketDetailData = {
  id: 4, ticketNumber: "TKT-2026-A1B2C3D4", requesterId: 1, requester: { id: 1, name: "Nicha Somchai" },
  categoryId: 2, category: { id: 2, name: "Hardware" }, relatedSystemId: 3, relatedSystem: { id: 3, name: "VPN" },
  summary: "VPN cannot connect", description: "The VPN disconnects immediately after sign-in.", requestedPriority: "MEDIUM" as const,
  itPriority: "HIGH" as const, status: "OPEN" as const, ownerId: 7, owner: owners[0], resolutionIndicatedAt: "2026-09-18T09:30:00.000Z",
  createdAt: "2026-09-18T08:00:00.000Z", updatedAt: "2026-09-18T10:00:00.000Z", attachments: [attachment, removedAttachment], ownerOptions: owners,
};

function renderDetail(data = ticket) {
  return render(<MemoryRouter initialEntries={["/staff/tickets/4?status=OPEN&page=2"]}><StaffTicketDetail ticketId={data.id} /></MemoryRouter>);
}

function mockLoads(data = ticket) {
  vi.spyOn(api, "loadStaffTicket").mockResolvedValue(data);
  vi.spyOn(api, "loadPublicComments").mockResolvedValue([{ id: 1, ticketId: data.id, body: "We are investigating this.", author: { id: 7, name: "Support One" }, createdAt: "2026-09-18T10:30:00.000Z" }]);
  vi.spyOn(api, "loadInternalNotes").mockResolvedValue([{ id: 2, ticketId: data.id, body: "Checked the VPN logs.", author: { id: 7, name: "Support One" }, createdAt: "2026-09-18T10:40:00.000Z" }]);
}

afterEach(() => vi.restoreAllMocks());

describe("Staff Ticket Detail", () => {
  it("renders read-only ticket data, distinct public/private sections, and attachment access", async () => {
    mockLoads();
    renderDetail();

    expect(await screen.findByRole("heading", { name: "Ticket TKT-2026-A1B2C3D4" })).toBeInTheDocument();
    expect(screen.getByLabelText("Requester (read-only)")).toHaveValue("Nicha Somchai");
    expect(screen.getByLabelText("Requested Priority (read-only)")).toHaveValue("Medium");
    expect(screen.getByLabelText("IT Priority (read-only)")).toHaveValue("High");
    expect(screen.getByText("We are investigating this.")).toBeInTheDocument();
    expect(screen.getByText("Checked the VPN logs.")).toBeInTheDocument();
    expect(screen.getByText("Internal — visible only to IT Staff and Administrators.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Download" })).toHaveAttribute("href", expect.stringContaining("/api/attachments/11/download"));
    expect(screen.getByText("Removed")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Upload attachment" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Remove" })).not.toBeInTheDocument();
    expect(document.querySelector(".staff-public-comments")).toBeInTheDocument();
    expect(document.querySelector(".staff-internal-notes")).toBeInTheDocument();
  });

  it("claims an unassigned ticket and confirms replacement or removal of an existing owner", async () => {
    const unassigned = { ...ticket, ownerId: null, owner: null, resolutionIndicatedAt: null };
    mockLoads(unassigned);
    const claim = vi.spyOn(api, "claimStaffTicket").mockResolvedValue(ticket);
    const user = userEvent.setup();
    const firstRender = renderDetail(unassigned);

    await user.click(await screen.findByRole("button", { name: "Claim Ticket" }));
    expect(claim).toHaveBeenCalledWith(4);
    expect(await screen.findByRole("status")).toHaveTextContent("Ticket claimed successfully.");

    firstRender.unmount();
    mockLoads();
    const assign = vi.spyOn(api, "assignStaffTicket").mockResolvedValue({ ...ticket, ownerId: 9, owner: owners[1] });
    renderDetail();
    await user.selectOptions(await screen.findByLabelText("Ticket Owner"), "9");
    expect(await screen.findByRole("dialog")).toHaveTextContent("Support One");
    expect(screen.getByRole("dialog")).toHaveTextContent("Admin One");
    await user.click(screen.getByRole("button", { name: "Confirm owner change" }));
    expect(assign).toHaveBeenCalledWith(4, 9);
  });

  it("saves IT Priority and only permitted status transitions, confirming terminal changes", async () => {
    mockLoads();
    const updatePriority = vi.spyOn(api, "updateStaffItPriority").mockResolvedValue({ ...ticket, itPriority: "URGENT" });
    const updateStatus = vi.spyOn(api, "updateStaffTicketStatus").mockResolvedValue({ ...ticket, status: "IN_PROGRESS" });
    const user = userEvent.setup();
    renderDetail();

    await user.selectOptions(await screen.findByLabelText("IT Priority"), "URGENT");
    await user.click(screen.getByRole("button", { name: "Save IT Priority" }));
    expect(updatePriority).toHaveBeenCalledWith(4, "URGENT");

    await user.selectOptions(screen.getByLabelText("Next status"), "IN_PROGRESS");
    await user.click(screen.getByRole("button", { name: "Update Status" }));
    expect(updateStatus).toHaveBeenCalledWith(4, "IN_PROGRESS");

    await user.selectOptions(screen.getByLabelText("Next status"), "RESOLVED");
    expect(await screen.findByRole("dialog")).toHaveTextContent("Resolved");
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(updateStatus).toHaveBeenCalledTimes(1);
  });

  it("preserves failed public and internal drafts and clears them after success", async () => {
    mockLoads();
    vi.spyOn(api, "addPublicComment").mockRejectedValue(new api.ApiError("Unable to add public comment.", 500));
    const addNote = vi.spyOn(api, "addInternalNote").mockResolvedValue({ id: 3, ticketId: 4, body: "New note", author: { id: 7, name: "Support One" }, createdAt: "2026-09-18T11:00:00.000Z" });
    const user = userEvent.setup();
    renderDetail();

    const comment = await screen.findByLabelText("Add public comment");
    await user.type(comment, "Keep this draft");
    await user.click(screen.getByRole("button", { name: "Post public comment" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Unable to add public comment.");
    expect(comment).toHaveValue("Keep this draft");

    const note = screen.getByLabelText("Add internal note");
    await user.type(note, "New note");
    await user.click(screen.getByRole("button", { name: "Save internal note" }));
    expect(addNote).toHaveBeenCalledWith(4, "New note");
    await waitFor(() => expect(note).toHaveValue(""));
  });

  it("shows a safe forbidden state without rendering stale ticket data", async () => {
    vi.spyOn(api, "loadStaffTicket").mockRejectedValue(new api.ApiError("Access denied.", 403, "FORBIDDEN"));
    vi.spyOn(api, "loadPublicComments").mockResolvedValue([]);
    vi.spyOn(api, "loadInternalNotes").mockResolvedValue([]);
    renderDetail();

    expect(await screen.findByRole("alert")).toHaveTextContent("You do not have permission to view staff ticket details.");
    expect(screen.queryByText("TKT-2026-A1B2C3D4")).not.toBeInTheDocument();
  });

  it("blocks Requesters from the staff detail route", async () => {
    vi.spyOn(api, "currentUser").mockResolvedValue({ user: requester, expiresAt: "2026-09-19T00:00:00.000Z" });
    render(<MemoryRouter initialEntries={["/staff/tickets/4"]}><App /></MemoryRouter>);

    expect(await screen.findByRole("heading", { name: "Access denied" })).toBeInTheDocument();
    expect(screen.queryByText("Ticket Operations")).not.toBeInTheDocument();
  });
});
