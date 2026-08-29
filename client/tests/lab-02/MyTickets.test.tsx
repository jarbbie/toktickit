import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import App from "../../src/App.js";
import * as api from "../../src/api.js";

const referenceData = {
  requesters: [{ id: 1, name: "Nicha Somchai", email: "nicha@example.test" }],
  categories: [{ id: 2, name: "Hardware" }],
  relatedSystems: [{ id: 3, name: "VPN" }],
};

function renderMyTickets() {
  sessionStorage.setItem("toktickit.requesterId", "1");
  return render(<MemoryRouter initialEntries={["/tickets"]}><App /></MemoryRouter>);
}

afterEach(() => {
  sessionStorage.clear();
  vi.restoreAllMocks();
});

describe("My Tickets", () => {
  it("shows the requester’s ticket and sends filter changes to the API", async () => {
    vi.spyOn(api, "loadReferenceData").mockResolvedValue(referenceData);
    const loadTickets = vi.spyOn(api, "loadTickets").mockImplementation(async (_requesterId, query) => ({ items: [{ id: 1, ticketNumber: "TKT-2026-A1B2C3D4", summary: "VPN cannot connect", requestedPriority: "HIGH", status: "NEW", category: { id: 2, name: "Hardware" }, updatedAt: "2026-08-25T00:00:00.000Z" }], page: query.page ?? 1, pageSize: 10, totalItems: 11, totalPages: 2 }));
    const user = userEvent.setup();
    renderMyTickets();

    expect(await screen.findByText("TKT-2026-A1B2C3D4")).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText("Category"), "2");

    expect(await screen.findByText("TKT-2026-A1B2C3D4")).toBeInTheDocument();
    expect(loadTickets).toHaveBeenLastCalledWith(1, expect.objectContaining({ categoryId: "2" }));

    await user.click(screen.getByRole("button", { name: "Next" }));
    await waitFor(() => expect(loadTickets).toHaveBeenLastCalledWith(1, expect.objectContaining({ categoryId: "2", page: 2 })));
  });

  it("distinguishes an empty requester from no filter matches", async () => {
    vi.spyOn(api, "loadReferenceData").mockResolvedValue(referenceData);
    vi.spyOn(api, "loadTickets").mockResolvedValue({ items: [], page: 1, pageSize: 10, totalItems: 0, totalPages: 0 });
    const user = userEvent.setup();
    renderMyTickets();

    expect(await screen.findByText("No tickets yet.")).toBeInTheDocument();
    await user.type(screen.getByLabelText("Search tickets"), "VPN");

    expect(await screen.findByText("No tickets match your filters.")).toBeInTheDocument();
  });

  it("shows a retryable safe failure", async () => {
    vi.spyOn(api, "loadReferenceData").mockResolvedValue(referenceData);
    vi.spyOn(api, "loadTickets").mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce({ items: [], page: 1, pageSize: 10, totalItems: 0, totalPages: 0 });
    const user = userEvent.setup();
    renderMyTickets();

    expect(await screen.findByRole("alert")).toHaveTextContent("Unable to load tickets.");
    await user.click(screen.getByRole("button", { name: "Retry" }));

    expect(await screen.findByText("No tickets yet.")).toBeInTheDocument();
  });
});
