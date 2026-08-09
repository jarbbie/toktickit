import { useState } from "react";
import { checkSystem } from "./api.js";

// UI states you must handle for Issue 4: idle, loading, success, error.
type UiState = "idle" | "loading" | "success" | "error";

export default function App() {
  const [state, setState] = useState<UiState>("idle");

  async function handleCheck() {
    setState("loading");
    try {
      await checkSystem();
      setState("success");
    } catch {
      setState("error");
    }
  }

  return (
    <div className="container py-5" style={{ maxWidth: 640 }}>
      <h1 className="h3 mb-4">
        TokTickIT <span className="text-success">IT Service Desk</span>
      </h1>

      <button className="btn btn-success" onClick={handleCheck} disabled={state === "loading"}>
        {state === "loading" ? "Loading…" : "Check System"}
      </button>

      {state === "success" && <p className="text-success mt-3">Online</p>}
      {state === "error" && (
        <p className="text-danger mt-3">Offline — Unable to reach the API. Please try again.</p>
      )}
    </div>
  );
}
