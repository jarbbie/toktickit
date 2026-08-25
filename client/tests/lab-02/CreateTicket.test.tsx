import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import App from "../../src/App.js";
import * as api from "../../src/api.js";

const referenceData = {
  requesters: [{ id: 1, name: "Nicha Somchai", email: "nicha@example.test" }],
  categories: [{ id: 2, name: "Hardware" }],
  relatedSystems: [{ id: 3, name: "VPN" }],
};

function renderCreateTicket() {
  sessionStorage.setItem("toktickit.requesterId", "1");
  return render(<MemoryRouter initialEntries={["/tickets/new"]}><App /></MemoryRouter>);
}

async function fillValidForm(user: ReturnType<typeof userEvent.setup>) {
  await user.selectOptions(await screen.findByLabelText(/Category/), "2");
  await user.selectOptions(screen.getByLabelText(/Related System/), "3");
  await user.type(screen.getByLabelText(/Ticket Summary/), "VPN cannot connect");
  await user.type(screen.getByLabelText(/Description/), "The VPN fails after entering my university credentials.");
}

afterEach(() => {
  sessionStorage.clear();
  vi.restoreAllMocks();
});

describe("Create Ticket", () => {
  it("shows field validation without calling the API", async () => {
    vi.spyOn(api, "loadReferenceData").mockResolvedValue(referenceData);
    const createTicket = vi.spyOn(api, "createTicket");
    const user = userEvent.setup();
    renderCreateTicket();

    await user.click(await screen.findByRole("button", { name: "Submit Ticket" }));

    expect(await screen.findByText("Category is required.")).toBeInTheDocument();
    expect(createTicket).not.toHaveBeenCalled();
  });

  it("shows a busy disabled submit button while saving", async () => {
    vi.spyOn(api, "loadReferenceData").mockResolvedValue(referenceData);
    vi.spyOn(api, "createTicket").mockReturnValue(new Promise(() => {}));
    const user = userEvent.setup();
    renderCreateTicket();

    await fillValidForm(user);
    await user.click(screen.getByRole("button", { name: "Submit Ticket" }));

    expect(screen.getByRole("button", { name: "Submitting…" })).toBeDisabled();
  });

  it("shows the generated ticket number after a successful submission", async () => {
    vi.spyOn(api, "loadReferenceData").mockResolvedValue(referenceData);
    vi.spyOn(api, "createTicket").mockResolvedValue({ id: 1, ticketNumber: "TKT-2026-A1B2C3D4", status: "NEW" });
    const user = userEvent.setup();
    renderCreateTicket();

    await fillValidForm(user);
    await user.click(screen.getByRole("button", { name: "Submit Ticket" }));

    expect(await screen.findByText("Ticket created: TKT-2026-A1B2C3D4")).toBeInTheDocument();
  });

  it("keeps entered values after a safe API failure", async () => {
    vi.spyOn(api, "loadReferenceData").mockResolvedValue(referenceData);
    vi.spyOn(api, "createTicket").mockRejectedValue(new Error("Unable to create ticket."));
    const user = userEvent.setup();
    renderCreateTicket();

    await fillValidForm(user);
    await user.click(screen.getByRole("button", { name: "Submit Ticket" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Unable to create ticket.");
    expect(screen.getByLabelText(/Ticket Summary/)).toHaveValue("VPN cannot connect");
  });
});
