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

describe("Attachment Section", () => {
  it("shows the active owned download action", async () => {
    vi.spyOn(api, "loadReferenceData").mockResolvedValue(referenceData);
    vi.spyOn(api, "loadTicket").mockResolvedValue(ticket);
    renderDetail();

    expect(await screen.findByRole("link", { name: "Download" })).toHaveAttribute("href", expect.stringContaining("/api/attachments/4/download?requesterId=1"));
  });

  it("keeps the selected file after an upload error", async () => {
    vi.spyOn(api, "loadReferenceData").mockResolvedValue(referenceData);
    vi.spyOn(api, "loadTicket").mockResolvedValue(ticket);
    vi.spyOn(api, "uploadAttachment").mockRejectedValue(new Error("Unable to upload attachment."));
    const user = userEvent.setup();
    renderDetail();

    const input = await screen.findByLabelText("Add attachment");
    await user.upload(input, new File(["%PDF-1.4"], "vpn.pdf", { type: "application/pdf" }));
    await user.click(screen.getByRole("button", { name: "Upload attachment" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Unable to upload attachment.");
    expect(input).toHaveValue("C:\\fakepath\\vpn.pdf");
  });
});
