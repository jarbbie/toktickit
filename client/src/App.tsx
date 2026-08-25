import { useEffect, useState } from "react";
import { type ReferenceData, loadReferenceData } from "./api.js";

type LoadState = "loading" | "ready" | "error";
const requesterStorageKey = "toktickit.requesterId";

function savedRequesterId() {
  const id = Number(sessionStorage.getItem(requesterStorageKey));
  return Number.isInteger(id) && id > 0 ? id : null;
}

export default function App() {
  const [state, setState] = useState<LoadState>("loading");
  const [referenceData, setReferenceData] = useState<ReferenceData | null>(null);
  const [requesterId, setRequesterId] = useState<number | null>(savedRequesterId);
  const [pendingRequesterId, setPendingRequesterId] = useState<number | null>(null);

  async function load() {
    setState("loading");
    try {
      const data = await loadReferenceData();
      setReferenceData(data);
      setRequesterId((id) => data.requesters.some((requester) => requester.id === id) ? id : null);
      setState("ready");
    } catch {
      setState("error");
    }
  }

  useEffect(() => { void load(); }, []);

  const requester = referenceData?.requesters.find((item) => item.id === requesterId);

  function continueWithRequester() {
    if (!pendingRequesterId) return;
    setRequesterId(pendingRequesterId);
    sessionStorage.setItem(requesterStorageKey, String(pendingRequesterId));
  }

  function changeRequester() {
    sessionStorage.removeItem(requesterStorageKey);
    setRequesterId(null);
    setPendingRequesterId(null);
  }

  return (
    <main className="container py-5" style={{ maxWidth: 640 }}>
      <header className="mb-4">
        <h1 className="h3 mb-1" style={{ color: "#006B3C" }}>TokTickIT</h1>
        <p className="text-secondary mb-0">IT Service Desk</p>
      </header>

      {state === "loading" && <p role="status">Loading Development Requesters…</p>}

      {state === "error" && (
        <div className="alert alert-danger" role="alert">
          <p className="mb-3">Unable to load requester and reference data.</p>
          <button className="btn btn-danger" onClick={load}>Retry</button>
        </div>
      )}

      {state === "ready" && !requester && referenceData?.requesters.length === 0 && (
        <div className="alert alert-warning" role="status">No active Development Requesters are available.</div>
      )}

      {state === "ready" && !requester && referenceData && referenceData.requesters.length > 0 && (
        <section className="card shadow-sm">
          <div className="card-body">
            <h2 className="h4">Select Development Requester</h2>
            <p>This selector is for Lab 2 testing only. It is not a login screen.</p>
            <label className="form-label fw-semibold" htmlFor="requester">Development Requester</label>
            <select className="form-select mb-3" id="requester" value={pendingRequesterId ?? ""} onChange={(event) => setPendingRequesterId(Number(event.target.value) || null)}>
              <option value="">Choose a requester</option>
              {referenceData.requesters.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
            <button className="btn text-white" style={{ backgroundColor: "#006B3C" }} disabled={!pendingRequesterId} onClick={continueWithRequester}>Continue</button>
          </div>
        </section>
      )}

      {state === "ready" && requester && referenceData && (
        <section className="card shadow-sm" style={{ borderColor: "#EAF6EF" }}>
          <div className="card-body">
            <p className="fw-semibold mb-2">Current requester: {requester.name}</p>
            <p>Reference data ready: {referenceData.categories.length} {referenceData.categories.length === 1 ? "category" : "categories"} and {referenceData.relatedSystems.length} {referenceData.relatedSystems.length === 1 ? "related system" : "related systems"}.</p>
            <button className="btn btn-outline-success" onClick={changeRequester}>Change Requester</button>
          </div>
        </section>
      )}
    </main>
  );
}
