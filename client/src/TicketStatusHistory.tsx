import { useEffect, useState } from "react";
import { ApiError, loadTicketStatusEvents, type TicketStatusEvent, type UserRole } from "./api.js";

function statusLabel(value: string) {
  if (value === "WAITING_FOR_REQUESTER") return "Waiting for Requester";
  return value.split("_").map((part) => part[0] + part.slice(1).toLowerCase()).join(" ");
}

function roleLabel(role: UserRole) {
  return role === "IT_STAFF" ? "IT Staff" : role === "ADMINISTRATOR" ? "Administrator" : "Requester";
}

export default function TicketStatusHistory({ ticketId, refreshToken = 0 }: { ticketId: number; refreshToken?: number }) {
  const [events, setEvents] = useState<TicketStatusEvent[] | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setEvents(null);
    setFailure(null);
    void loadTicketStatusEvents(ticketId).then((result) => {
      if (!cancelled) setEvents(result);
    }).catch((error: unknown) => {
      if (!cancelled) setFailure(error instanceof ApiError || error instanceof Error ? error.message : "Unable to load Ticket status history.");
    });
    return () => { cancelled = true; };
  }, [retry, refreshToken, ticketId]);

  return <section className="card shadow-sm mb-3 ticket-status-history-card" aria-labelledby={`ticket-status-history-heading-${ticketId}`}>
    <div className="card-body">
      <h2 className="h5" id={`ticket-status-history-heading-${ticketId}`}>Ticket Status History</h2>
      {events === null && !failure && <p className="mb-0" role="status">Loading Ticket status history…</p>}
      {failure && <div className="alert alert-danger mb-0" role="alert">{failure} <button className="btn btn-sm btn-danger ms-2" onClick={() => setRetry((value) => value + 1)} type="button">Retry</button></div>}
      {events?.length === 0 && <p className="text-secondary mb-0">No status changes have been recorded yet. History begins with Lab 4 transitions.</p>}
      {events && events.length > 0 && <ol className="list-group ticket-status-history-list">
        {events.map((event) => <li className="list-group-item" key={event.id}>
          <div className="d-flex flex-wrap align-items-baseline justify-content-between gap-2">
            <strong>{statusLabel(event.fromStatus)} <span aria-label="to">→</span> {statusLabel(event.toStatus)}</strong>
            <time dateTime={event.changedAt}>{new Date(event.changedAt).toLocaleString()}</time>
          </div>
          <span className="text-secondary">Changed by {event.actor.name} ({roleLabel(event.actor.role)})</span>
        </li>)}
      </ol>}
    </div>
  </section>;
}
