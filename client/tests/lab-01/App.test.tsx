import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import App from "../../src/App.js";
import * as api from "../../src/api.js";

afterEach(() => vi.restoreAllMocks());

describe("App", () => {
  it("renders the TokTickIT login screen when there is no session", async () => {
    vi.spyOn(api, "currentUser").mockRejectedValue(new api.ApiError("Authentication is required.", 401, "UNAUTHENTICATED"));
    render(<MemoryRouter initialEntries={["/login"]}><App /></MemoryRouter>);

    expect(await screen.findByRole("heading", { name: "Sign in" })).toBeInTheDocument();
  });
});
