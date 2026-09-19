import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import App from "../../src/App.js";
import * as api from "../../src/api.js";

const referenceData = { categories: [{ id: 2, name: "Hardware" }], relatedSystems: [{ id: 3, name: "VPN" }] };
const ticket = {
  id: 1, requesterId: 1, requester: { id: 1, name: "Nicha Somchai" }, categoryId: 2, relatedSystemId: 3,
  ownerId: null, owner: null, itPriority: "MEDIUM" as const, resolutionIndicatedAt: null,
  ticketNumber: "TKT-2026-A1B2C3D4", summary: "VPN cannot connect", description: "The VPN fails after login.",
  requestedPriority: "MEDIUM" as const, status: "IN_PROGRESS" as const, category: { id: 2, name: "Hardware" },
  relatedSystem: { id: 3, name: "VPN" }, createdAt: "2026-08-25T00:00:00.000Z", updatedAt: "2026-08-25T00:00:00.000Z", attachments: [],
};

afterEach(() => vi.restoreAllMocks());

describe("Authenticated requester interactions", () => {
  it("loads and posts Public Comments, then records a resolution indication", async () => {
    vi.spyOn(api, "loadReferenceData").mockResolvedValue(referenceData);
    vi.spyOn(api, "loadTicket").mockResolvedValue(ticket);
    vi.spyOn(api, "loadPublicComments").mockResolvedValue([{ id: 2, ticketId: 1, body: "We are investigating this.", author: { id: 7, name: "Support One" }, createdAt: "2026-08-25T01:00:00.000Z" }]);
    const addComment = vi.spyOn(api, "addPublicComment").mockResolvedValue({ id: 3, ticketId: 1, body: "It works now.", author: { id: 1, name: "Nicha Somchai" }, createdAt: "2026-08-25T02:00:00.000Z" });
    const indicate = vi.spyOn(api, "indicateResolution").mockResolvedValue({ ticketId: 1, resolutionIndicatedAt: "2026-08-25T03:00:00.000Z", status: "IN_PROGRESS", updatedAt: "2026-08-25T03:00:00.000Z" });
    const user = userEvent.setup();
    render(<MemoryRouter initialEntries={["/tickets/1"]}><App /></MemoryRouter>);

    expect(await screen.findByText("We are investigating this.")).toBeInTheDocument();
    await user.type(screen.getByLabelText("Add public comment"), "  It works now.  ");
    await user.click(screen.getByRole("button", { name: "Post Comment" }));
    expect(addComment).toHaveBeenCalledWith(1, "It works now.");
    expect(await screen.findByText("It works now.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Problem appears resolved" }));
    expect(indicate).toHaveBeenCalledWith(1);
    expect(await screen.findByText(/Indicated on/)).toHaveTextContent("Current status remains In Progress");
  });

  it("rejects an empty public comment before making a request", async () => {
    vi.spyOn(api, "loadReferenceData").mockResolvedValue(referenceData);
    vi.spyOn(api, "loadTicket").mockResolvedValue(ticket);
    vi.spyOn(api, "loadPublicComments").mockResolvedValue([]);
    const addComment = vi.spyOn(api, "addPublicComment");
    const user = userEvent.setup();
    render(<MemoryRouter initialEntries={["/tickets/1"]}><App /></MemoryRouter>);

    await screen.findByRole("heading", { name: "Public Comments" });
    await user.click(screen.getByRole("button", { name: "Post Comment" }));
    expect(addComment).not.toHaveBeenCalled();
    expect(await screen.findByRole("alert")).toHaveTextContent("Comment must be between 1 and 2000 characters.");
  });
});
