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

  it("uses labelled required fields, invalid styles, and distinct read-only fields", async () => {
    vi.spyOn(api, "loadReferenceData").mockResolvedValue(referenceData);
    const user = userEvent.setup();
    renderCreateTicket();

    const requester = await screen.findByLabelText("Requester");
    expect(requester).toHaveAttribute("readonly");
    expect(requester).toHaveClass("readonly-field");
    expect(document.querySelector(".app-header")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "My Tickets" })).toHaveClass("app-nav-link");
    expect(document.querySelector('label[for="category"] .text-danger')).toHaveTextContent("*");
    await user.click(screen.getByRole("button", { name: "Submit Ticket" }));
    expect(screen.getByLabelText(/Category/)).toHaveClass("is-invalid");
    expect(screen.getByText("Category is required.")).toHaveClass("invalid-feedback");
  });

  it("shows a busy disabled submit button and prevents duplicate submission", async () => {
    vi.spyOn(api, "loadReferenceData").mockResolvedValue(referenceData);
    const createTicket = vi.spyOn(api, "createTicket").mockReturnValue(new Promise(() => {}));
    const user = userEvent.setup();
    renderCreateTicket();

    await fillValidForm(user);
    await user.click(screen.getByRole("button", { name: "Submit Ticket" }));

    const submit = screen.getByRole("button", { name: "Submitting…" });
    expect(submit).toBeDisabled();
    await user.click(submit);
    expect(createTicket).toHaveBeenCalledTimes(1);
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

  it("uploads a valid optional attachment after creating the ticket", async () => {
    vi.spyOn(api, "loadReferenceData").mockResolvedValue(referenceData);
    vi.spyOn(api, "createTicket").mockResolvedValue({ id: 1, ticketNumber: "TKT-2026-A1B2C3D4", status: "NEW" });
    const uploadAttachment = vi.spyOn(api, "uploadAttachment").mockResolvedValue({ id: 4, originalName: "evidence.pdf", mimeType: "application/pdf", sizeBytes: 9, createdAt: "2026-09-05T00:00:00.000Z", removedAt: null, removalReason: null });
    const user = userEvent.setup();
    renderCreateTicket();

    await fillValidForm(user);
    const file = new File(["%PDF-1.4"], "evidence.pdf", { type: "application/pdf" });
    await user.upload(screen.getByLabelText(/Attachment/), file);
    await user.click(screen.getByRole("button", { name: "Submit Ticket" }));

    expect(await screen.findByText("Ticket created: TKT-2026-A1B2C3D4")).toBeInTheDocument();
    expect(uploadAttachment).toHaveBeenCalledWith(1, 1, file);
  });

  it("rejects an invalid attachment before creating a ticket", async () => {
    vi.spyOn(api, "loadReferenceData").mockResolvedValue(referenceData);
    const createTicket = vi.spyOn(api, "createTicket");
    const user = userEvent.setup({ applyAccept: false });
    renderCreateTicket();

    await fillValidForm(user);
    await user.upload(screen.getByLabelText(/Attachment/), new File(["plain text"], "notes.txt", { type: "text/plain" }));
    await user.click(screen.getByRole("button", { name: "Submit Ticket" }));

    expect(screen.getByText("Choose a JPG, PNG, WEBP, or PDF file.")).toBeInTheDocument();
    expect(createTicket).not.toHaveBeenCalled();
  });

  it("keeps a created ticket when its attachment upload fails", async () => {
    vi.spyOn(api, "loadReferenceData").mockResolvedValue(referenceData);
    vi.spyOn(api, "createTicket").mockResolvedValue({ id: 1, ticketNumber: "TKT-2026-A1B2C3D4", status: "NEW" });
    vi.spyOn(api, "uploadAttachment").mockRejectedValue(new Error("Unable to upload attachment."));
    const user = userEvent.setup();
    renderCreateTicket();

    await fillValidForm(user);
    await user.upload(screen.getByLabelText(/Attachment/), new File(["%PDF-1.4"], "evidence.pdf", { type: "application/pdf" }));
    await user.click(screen.getByRole("button", { name: "Submit Ticket" }));

    expect(await screen.findByText("Ticket created: TKT-2026-A1B2C3D4")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("Ticket created, but the attachment could not be uploaded");
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
