import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import App from "../../src/App.js";
import * as api from "../../src/api.js";

const referenceData = { requesters: [{ id: 1, name: "Nicha Somchai", email: "nicha@example.test" }], categories: [{ id: 2, name: "Hardware" }], relatedSystems: [{ id: 3, name: "VPN" }] };
const ticket = { id: 1, requesterId: 1, ticketNumber: "TKT-2026-A1B2C3D4", summary: "VPN cannot connect", description: "The VPN fails after login.", requestedPriority: "MEDIUM" as const, status: "NEW" as const, category: { id: 2, name: "Hardware" }, relatedSystem: { id: 3, name: "VPN" }, createdAt: "2026-08-25T00:00:00.000Z", updatedAt: "2026-08-25T00:00:00.000Z", attachments: [{ id: 4, originalName: "vpn.pdf", mimeType: "application/pdf", sizeBytes: 3, createdAt: "2026-08-25T00:00:00.000Z", removedAt: null, removalReason: null }] };

function renderDetail() {
  sessionStorage.setItem("toktickit.requesterId", "1");
  return render(<MemoryRouter initialEntries={["/tickets/1"]}><App /></MemoryRouter>);
}

afterEach(() => {
  sessionStorage.clear();
  vi.restoreAllMocks();
});

describe("Requester Ticket Detail", () => {
  it("shows owned ticket data and preserves removed attachment metadata", async () => {
    vi.spyOn(api, "loadReferenceData").mockResolvedValue(referenceData);
    vi.spyOn(api, "loadTicket").mockResolvedValue(ticket);
    vi.spyOn(api, "removeAttachment").mockResolvedValue({ ...ticket.attachments[0], removedAt: "2026-08-26T00:00:00.000Z", removalReason: "Wrong file" });
    const user = userEvent.setup();
    renderDetail();

    expect(await screen.findByText("TKT-2026-A1B2C3D4")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Remove" }));
    await user.type(screen.getByLabelText("Removal reason"), "Wrong file");
    await user.click(screen.getByRole("button", { name: "Confirm removal" }));

    expect(await screen.findByText("Removed")).toBeInTheDocument();
    expect(screen.getByText("Reason: Wrong file")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Download" })).not.toBeInTheDocument();
  });

  it("keeps the selected file after an upload error", async () => {
    vi.spyOn(api, "loadReferenceData").mockResolvedValue(referenceData);
    vi.spyOn(api, "loadTicket").mockResolvedValue(ticket);
    vi.spyOn(api, "uploadAttachment").mockRejectedValue(new Error("Unable to upload attachment."));
    const user = userEvent.setup();
    renderDetail();

    const input = await screen.findByLabelText("Add attachment");
    await user.upload(input, new File(["pdf"], "vpn.pdf", { type: "application/pdf" }));
    await user.click(screen.getByRole("button", { name: "Upload attachment" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Unable to upload attachment.");
    expect(input).toHaveValue("C:\\fakepath\\vpn.pdf");
  });
});
