import { type FormEvent, useEffect, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  ApiError,
  type InternalNote,
  type PublicComment,
  type StaffTicketDetail as StaffTicketDetailData,
  type TicketStatus,
  addInternalNote,
  addPublicComment,
  attachmentDownloadUrl,
  assignStaffTicket,
  claimStaffTicket,
  loadInternalNotes,
  loadPublicComments,
  loadStaffTicket,
  updateStaffItPriority,
  updateStaffTicketStatus,
} from "./api.js";

const priorities = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;
type Priority = typeof priorities[number];

const statusTransitions: Record<TicketStatus, readonly TicketStatus[]> = {
  NEW: ["OPEN", "IN_PROGRESS", "CANCELLED"],
  OPEN: ["IN_PROGRESS", "WAITING_FOR_REQUESTER", "RESOLVED", "CANCELLED"],
  IN_PROGRESS: ["WAITING_FOR_REQUESTER", "RESOLVED", "CANCELLED"],
  WAITING_FOR_REQUESTER: ["IN_PROGRESS", "RESOLVED", "CANCELLED"],
  RESOLVED: ["CLOSED", "REOPENED"],
  CLOSED: ["REOPENED"],
  REOPENED: ["IN_PROGRESS", "WAITING_FOR_REQUESTER", "RESOLVED", "CANCELLED"],
  CANCELLED: [],
};

const terminalStatuses = new Set<TicketStatus>(["RESOLVED", "CLOSED", "CANCELLED"]);

type BusyOperation = "claim" | "owner" | "priority" | "status" | "comment" | "note" | null;

function enumLabel(value: string) {
  if (value === "WAITING_FOR_REQUESTER") return "Waiting for Requester";
  return value.split("_").map((part) => part[0] + part.slice(1).toLowerCase()).join(" ");
}

function priorityBadge(priority: string) {
  return <span className={`badge zen-badge zen-priority-${priority.toLowerCase()}`}>{enumLabel(priority)}</span>;
}

function statusBadge(status: string) {
  return <span className={`badge zen-badge zen-status-${status.toLowerCase().replaceAll("_", "-")}`}>{enumLabel(status)}</span>;
}

function dateLabel(value: string) {
  return new Date(value).toLocaleString();
}

function errorLabel(error: unknown, fallback: string) {
  if (error instanceof ApiError && error.status === 403) return "You do not have permission to operate this ticket.";
  if (error instanceof ApiError && error.status === 404) return "This ticket is no longer available.";
  return error instanceof Error ? error.message : fallback;
}

function ownerLabel(ticket: StaffTicketDetailData) {
  return ticket.owner?.name ?? "Unassigned";
}

function ownerOptionLabel(owner: StaffTicketDetailData["ownerOptions"][number]) {
  return `${owner.name} (${owner.role === "IT_STAFF" ? "IT Staff" : "Administrator"})`;
}

function ReadonlyField({ label, value, wide = false, multiline = false }: { label: string; value: string; wide?: boolean; multiline?: boolean }) {
  return <div className={wide ? "staff-detail-field staff-detail-field-wide" : "staff-detail-field"}>
    <div className="form-label">{label}</div>
    {multiline ? <div aria-label={`${label} (read-only)`} className="readonly-field ticket-detail-value staff-detail-readonly">{value}</div> : <input aria-label={`${label} (read-only)`} className="form-control readonly-field" readOnly value={value} />}
  </div>;
}

function CommentList({ comments }: { comments: PublicComment[] }) {
  if (comments.length === 0) return <p className="text-secondary">No public comments yet.</p>;
  return <ul className="list-group staff-entry-list">{comments.map((comment) => <li className="list-group-item" key={comment.id}>
    <div className="d-flex justify-content-between gap-2"><strong>{comment.author.name}</strong><small className="text-secondary">{dateLabel(comment.createdAt)}</small></div>
    <p className="mb-0 text-break" style={{ whiteSpace: "pre-wrap" }}>{comment.body}</p>
  </li>)}</ul>;
}

function NoteList({ notes }: { notes: InternalNote[] }) {
  if (notes.length === 0) return <p className="text-secondary">No internal notes yet.</p>;
  return <ul className="list-group staff-entry-list">{notes.map((note) => <li className="list-group-item" key={note.id}>
    <div className="d-flex justify-content-between gap-2"><strong>{note.author.name}</strong><small className="text-secondary">{dateLabel(note.createdAt)}</small></div>
    <p className="mb-0 text-break" style={{ whiteSpace: "pre-wrap" }}>{note.body}</p>
  </li>)}</ul>;
}

export default function StaffTicketDetail({ ticketId }: { ticketId: number }) {
  const location = useLocation();
  const [ticket, setTicket] = useState<StaffTicketDetailData | null>(null);
  const [comments, setComments] = useState<PublicComment[] | null>(null);
  const [notes, setNotes] = useState<InternalNote[] | null>(null);
  const [failure, setFailure] = useState<ApiError | Error | null>(null);
  const [commentsFailure, setCommentsFailure] = useState<ApiError | Error | null>(null);
  const [notesFailure, setNotesFailure] = useState<ApiError | Error | null>(null);
  const [retry, setRetry] = useState(0);
  const [busy, setBusy] = useState<BusyOperation>(null);
  const [operationError, setOperationError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [ownerSelection, setOwnerSelection] = useState("");
  const [prioritySelection, setPrioritySelection] = useState<Priority | "">("");
  const [statusSelection, setStatusSelection] = useState<TicketStatus | "">("");
  const [pendingOwner, setPendingOwner] = useState<number | null | undefined>(undefined);
  const [pendingStatus, setPendingStatus] = useState<TicketStatus | null>(null);
  const [commentBody, setCommentBody] = useState("");
  const [commentError, setCommentError] = useState("");
  const [noteBody, setNoteBody] = useState("");
  const [noteError, setNoteError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setTicket(null);
    setFailure(null);
    setComments(null);
    setCommentsFailure(null);
    setNotes(null);
    setNotesFailure(null);
    void loadStaffTicket(ticketId).then((data) => {
      if (cancelled) return;
      setTicket(data);
      setOwnerSelection(data.ownerId === null ? "" : String(data.ownerId));
      setPrioritySelection(data.itPriority);
      setStatusSelection("");
    }).catch((error) => { if (!cancelled) setFailure(error instanceof Error ? error : new Error("Unable to load staff ticket.")); });
    void loadPublicComments(ticketId).then((data) => { if (!cancelled) setComments(data); }).catch((error) => { if (!cancelled) setCommentsFailure(error instanceof Error ? error : new Error("Unable to load public comments.")); });
    void loadInternalNotes(ticketId).then((data) => { if (!cancelled) setNotes(data); }).catch((error) => { if (!cancelled) setNotesFailure(error instanceof Error ? error : new Error("Unable to load internal notes.")); });
    return () => { cancelled = true; };
  }, [retry, ticketId]);

  useEffect(() => {
    if (pendingOwner === undefined && pendingStatus === null) return;
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      if (pendingOwner !== undefined && ticket) {
        setPendingOwner(undefined);
        setOwnerSelection(ticket.ownerId === null ? "" : String(ticket.ownerId));
      }
      if (pendingStatus !== null) {
        setPendingStatus(null);
        setStatusSelection("");
      }
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [pendingOwner, pendingStatus, ticket]);

  function clearOperationFeedback() {
    setOperationError("");
    setSuccessMessage("");
  }

  function operationFailed(error: unknown, fallback: string, reloadOnConflict = true) {
    setOperationError(errorLabel(error, fallback));
    if (reloadOnConflict && error instanceof ApiError && (error.status === 404 || error.status === 409)) setRetry((value) => value + 1);
  }

  function applyTicket(data: StaffTicketDetailData) {
    setTicket(data);
    setOwnerSelection(data.ownerId === null ? "" : String(data.ownerId));
    setPrioritySelection(data.itPriority);
    setStatusSelection("");
  }

  async function claim() {
    if (!ticket || busy) return;
    clearOperationFeedback();
    setBusy("claim");
    try {
      applyTicket(await claimStaffTicket(ticket.id));
      setSuccessMessage("Ticket claimed successfully.");
    } catch (error) {
      operationFailed(error, "Unable to claim ticket.");
    } finally { setBusy(null); }
  }

  async function saveOwner(nextOwnerId: number | null) {
    if (!ticket || busy) return;
    clearOperationFeedback();
    setBusy("owner");
    try {
      applyTicket(await assignStaffTicket(ticket.id, nextOwnerId));
      setPendingOwner(undefined);
      setSuccessMessage("Ticket owner updated.");
    } catch (error) {
      operationFailed(error, "Unable to update ticket owner.");
    } finally { setBusy(null); }
  }

  function chooseOwner(value: string) {
    if (!ticket) return;
    const nextOwnerId = value === "" ? null : Number(value);
    setOwnerSelection(value);
    if (ticket.ownerId === nextOwnerId) {
      setPendingOwner(undefined);
      return;
    }
    if (ticket.ownerId === null) void saveOwner(nextOwnerId);
    else setPendingOwner(nextOwnerId);
  }

  async function savePriority() {
    if (!ticket || !prioritySelection || prioritySelection === ticket.itPriority || busy) return;
    clearOperationFeedback();
    setBusy("priority");
    try {
      applyTicket(await updateStaffItPriority(ticket.id, prioritySelection));
      setSuccessMessage("IT Priority updated.");
    } catch (error) {
      operationFailed(error, "Unable to update IT Priority.");
    } finally { setBusy(null); }
  }

  async function saveStatus(nextStatus: TicketStatus) {
    if (!ticket || busy) return;
    clearOperationFeedback();
    setBusy("status");
    try {
      applyTicket(await updateStaffTicketStatus(ticket.id, nextStatus));
      setSuccessMessage(`Status changed to ${enumLabel(nextStatus)}.`);
      setPendingStatus(null);
    } catch (error) {
      operationFailed(error, "Unable to update ticket status.");
    } finally { setBusy(null); }
  }

  function chooseStatus(value: TicketStatus | "") {
    setStatusSelection(value);
    if (value && terminalStatuses.has(value)) setPendingStatus(value);
    else setPendingStatus(null);
  }

  function requestStatusUpdate() {
    if (!statusSelection) return;
    if (terminalStatuses.has(statusSelection)) setPendingStatus(statusSelection);
    else void saveStatus(statusSelection);
  }

  async function submitComment(event: FormEvent) {
    event.preventDefault();
    const body = commentBody.trim();
    if (body.length < 1 || body.length > 2_000 || busy === "comment") {
      setCommentError("Comment must be between 1 and 2000 characters.");
      return;
    }
    if (!ticket) return;
    setCommentError("");
    clearOperationFeedback();
    setBusy("comment");
    try {
      const created = await addPublicComment(ticket.id, body);
      setComments((current) => [...(current ?? []), created]);
      setCommentBody("");
      setSuccessMessage("Public comment posted.");
    } catch (error) {
      setCommentError(errorLabel(error, "Unable to add public comment."));
    } finally { setBusy(null); }
  }

  async function submitNote(event: FormEvent) {
    event.preventDefault();
    const body = noteBody.trim();
    if (body.length < 1 || body.length > 4_000 || busy === "note") {
      setNoteError("Internal Note must be between 1 and 4000 characters.");
      return;
    }
    if (!ticket) return;
    setNoteError("");
    clearOperationFeedback();
    setBusy("note");
    try {
      const created = await addInternalNote(ticket.id, body);
      setNotes((current) => [...(current ?? []), created]);
      setNoteBody("");
      setSuccessMessage("Internal Note saved.");
    } catch (error) {
      setNoteError(errorLabel(error, "Unable to add Internal Note."));
    } finally { setBusy(null); }
  }

  if (!ticket && !failure) return <p role="status">Loading staff ticket…</p>;
  if (failure) {
    const forbidden = failure instanceof ApiError && failure.status === 403;
    return <section className="staff-detail-page"><div className="alert alert-danger" role="alert">{forbidden ? "You do not have permission to view staff ticket details." : errorLabel(failure, "Unable to load staff ticket.")} {!forbidden && <button className="btn btn-sm btn-danger ms-2" onClick={() => setRetry((value) => value + 1)}>Retry</button>}</div><NavLink className="btn btn-outline-success" to={`/staff/tickets${location.search}`}>← Back to Ticket Queue</NavLink></section>;
  }
  if (!ticket) return null;

  const availableStatuses = statusTransitions[ticket.status];
  const currentOwnerOption = ticket.owner && ticket.ownerId !== null && !ticket.ownerOptions.some((option) => option.id === ticket.ownerId)
    ? [{ id: ticket.ownerId, name: ticket.owner.name, role: ticket.owner.role as "IT_STAFF" | "ADMINISTRATOR" }]
    : [];
  const ownerOptions = [...currentOwnerOption, ...ticket.ownerOptions];
  const pendingOwnerLabel = pendingOwner === null ? "Unassigned" : ownerOptions.find((option) => option.id === pendingOwner)?.name ?? "the selected owner";

  return <section className="staff-detail-page">
    <div className="ticket-breadcrumb d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
      <nav aria-label="Breadcrumb"><NavLink to={`/staff/tickets${location.search}`}>Ticket Queue</NavLink><span aria-hidden="true">›</span><span>Ticket Details</span></nav>
      <NavLink className="btn btn-sm btn-outline-success back-link" to={`/staff/tickets${location.search}`}><span aria-hidden="true">←</span> Back to Ticket Queue</NavLink>
    </div>

    <header className="staff-detail-heading mb-3"><div><h1 className="h3 mb-1">Ticket {ticket.ticketNumber}</h1><p className="text-secondary mb-0">Staff Ticket Detail</p></div>{statusBadge(ticket.status)}</header>

    <section className="card shadow-sm mb-3" aria-labelledby="staff-ticket-information-heading"><div className="card-body ticket-detail-card"><h2 className="h5 mb-3" id="staff-ticket-information-heading">Ticket Information</h2><div className="staff-detail-fields">
      <ReadonlyField label="Ticket Number" value={ticket.ticketNumber} />
      <ReadonlyField label="Ticket Date" value={dateLabel(ticket.createdAt)} />
      <ReadonlyField label="Requester" value={ticket.requester.name} />
      <ReadonlyField label="Category" value={ticket.category.name} />
      <ReadonlyField label="Related System" value={ticket.relatedSystem.name} />
      <ReadonlyField label="Requested Priority" value={enumLabel(ticket.requestedPriority)} />
      <ReadonlyField label="IT Priority" value={enumLabel(ticket.itPriority)} />
      <ReadonlyField label="Current Status" value={enumLabel(ticket.status)} />
      <ReadonlyField label="Ticket Owner" value={ownerLabel(ticket)} />
      <ReadonlyField label="Last Updated" value={dateLabel(ticket.updatedAt)} />
      <ReadonlyField label="Summary" value={ticket.summary} wide />
      <ReadonlyField label="Description" value={ticket.description} wide multiline />
    </div></div></section>

    <section className="card shadow-sm mb-3 staff-operations-card" aria-labelledby="staff-ticket-operations-heading"><div className="card-body"><div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3"><div><h2 className="h5 mb-1" id="staff-ticket-operations-heading">Ticket Operations</h2><p className="text-secondary mb-0">Operational controls are enforced by the server.</p></div>{busy && <span role="status" className="text-secondary">Saving…</span>}</div>
      {operationError && <div className="alert alert-danger" role="alert">{operationError}</div>}
      {successMessage && <div className="alert alert-success" role="status">{successMessage}</div>}
      <div className="staff-operation-grid">
        <div className="staff-operation-control"><label className="form-label" htmlFor="staff-owner">Ticket Owner</label><select className="form-select" id="staff-owner" value={ownerSelection} disabled={busy !== null} onChange={(event) => chooseOwner(event.target.value)}><option value="">Unassigned</option>{ownerOptions.map((owner) => <option key={owner.id} value={owner.id}>{ownerOptionLabel(owner)}</option>)}</select><div className="form-text">Current owner: {ownerLabel(ticket)}</div>{ticket.ownerId === null && <button className="btn btn-zen-primary mt-2" disabled={busy !== null} onClick={() => void claim()} type="button">{busy === "claim" ? "Claiming…" : "Claim Ticket"}</button>}</div>
        <div className="staff-operation-control"><label className="form-label" htmlFor="staff-it-priority">IT Priority</label><select className="form-select" id="staff-it-priority" value={prioritySelection} disabled={busy !== null} onChange={(event) => setPrioritySelection(event.target.value as Priority)}>{priorities.map((priority) => <option key={priority} value={priority}>{enumLabel(priority)}</option>)}</select><button className="btn btn-outline-success mt-2" disabled={busy !== null || prioritySelection === ticket.itPriority} onClick={() => void savePriority()} type="button">{busy === "priority" ? "Saving…" : "Save IT Priority"}</button></div>
        <div className="staff-operation-control"><div className="staff-current-status-label"><span className="form-label">Current Status</span> {statusBadge(ticket.status)}</div><label className="form-label" htmlFor="staff-status">Next status</label><select className="form-select" id="staff-status" value={statusSelection} disabled={busy !== null || availableStatuses.length === 0} onChange={(event) => chooseStatus(event.target.value as TicketStatus | "")}><option value="">Choose next status</option>{availableStatuses.map((status) => <option key={status} value={status}>{enumLabel(status)}</option>)}</select>{availableStatuses.length === 0 ? <div className="form-text">No further status transitions are available.</div> : <><div className="form-text">Choose only a permitted next status.</div><button className="btn btn-outline-success mt-2" disabled={busy !== null || !statusSelection || pendingStatus !== null} onClick={requestStatusUpdate} type="button">{busy === "status" ? "Saving…" : "Update Status"}</button></>}</div>
      </div>
      {pendingOwner !== undefined && <div className="staff-confirmation" role="dialog" aria-modal="true" aria-labelledby="owner-confirmation-heading"><h3 className="h6" id="owner-confirmation-heading">Confirm owner change</h3><p>Change the owner of {ticket.ticketNumber} from <strong>{ownerLabel(ticket)}</strong> to <strong>{pendingOwnerLabel}</strong>?</p><button autoFocus className="btn btn-zen-primary btn-sm me-2" disabled={busy !== null} onClick={() => void saveOwner(pendingOwner)} type="button">Confirm owner change</button><button className="btn btn-outline-secondary btn-sm" disabled={busy !== null} onClick={() => { setPendingOwner(undefined); setOwnerSelection(ticket.ownerId === null ? "" : String(ticket.ownerId)); }} type="button">Cancel</button></div>}
      {pendingStatus && <div className="staff-confirmation staff-confirmation-warning" role="dialog" aria-modal="true" aria-labelledby="status-confirmation-heading"><h3 className="h6" id="status-confirmation-heading">Confirm status change</h3><p>Change {ticket.ticketNumber} from <strong>{enumLabel(ticket.status)}</strong> to <strong>{enumLabel(pendingStatus)}</strong>? This transition may be difficult to reverse.</p><button autoFocus className="btn btn-zen-primary btn-sm me-2" disabled={busy !== null} onClick={() => void saveStatus(pendingStatus)} type="button">Confirm status change</button><button className="btn btn-outline-secondary btn-sm" disabled={busy !== null} onClick={() => { setPendingStatus(null); setStatusSelection(""); }} type="button">Cancel</button></div>}
      {ticket.resolutionIndicatedAt ? <p className="staff-resolution-indication mb-0">Requester indicated that this problem appears resolved on <strong>{dateLabel(ticket.resolutionIndicatedAt)}</strong>. This is separate from the formal status.</p> : <p className="text-secondary mb-0">No requester resolution indication has been recorded.</p>}
    </div></section>

    <div className="staff-entry-grid">
      <section className="card shadow-sm staff-public-comments" aria-labelledby="staff-public-comments-heading"><div className="card-body"><h2 className="h5" id="staff-public-comments-heading">Public Comments <span className="badge zen-badge zen-badge-count">{comments?.length ?? 0}</span></h2><p className="staff-section-description">Visible to the Requester and support team.</p>{!comments && !commentsFailure && <p role="status">Loading public comments…</p>}{commentsFailure && <div className="alert alert-danger" role="alert">Unable to load public comments. <button className="btn btn-sm btn-danger ms-2" onClick={() => setRetry((value) => value + 1)}>Retry</button></div>}{comments && <CommentList comments={comments} />}<form className="staff-entry-form" onSubmit={(event) => void submitComment(event)}><label className="form-label" htmlFor="staff-public-comment">Add public comment</label><textarea aria-describedby="staff-public-comment-help" className="form-control" id="staff-public-comment" maxLength={2_000} rows={4} value={commentBody} onChange={(event) => setCommentBody(event.target.value)} /><div className="form-text" id="staff-public-comment-help">1–2000 characters. The Requester can read this message.</div>{commentError && <div className="text-danger mt-1" role="alert">{commentError}</div>}<button className="btn btn-zen-primary mt-2" disabled={busy !== null} type="submit">{busy === "comment" ? "Posting…" : "Post public comment"}</button></form></div></section>
      <section className="card shadow-sm staff-internal-notes" aria-labelledby="staff-internal-notes-heading"><div className="card-body"><h2 className="h5" id="staff-internal-notes-heading">Internal Notes <span className="badge zen-badge zen-badge-count">{notes?.length ?? 0}</span></h2><p className="staff-section-description"><strong>Internal — visible only to IT Staff and Administrators.</strong></p>{!notes && !notesFailure && <p role="status">Loading internal notes…</p>}{notesFailure && <div className="alert alert-danger" role="alert">Unable to load internal notes. <button className="btn btn-sm btn-danger ms-2" onClick={() => setRetry((value) => value + 1)}>Retry</button></div>}{notes && <NoteList notes={notes} />}<form className="staff-entry-form" onSubmit={(event) => void submitNote(event)}><label className="form-label" htmlFor="staff-internal-note">Add internal note</label><textarea aria-describedby="staff-internal-note-help" className="form-control" id="staff-internal-note" maxLength={4_000} rows={4} value={noteBody} onChange={(event) => setNoteBody(event.target.value)} /><div className="form-text" id="staff-internal-note-help">1–4000 characters. This note is private to support staff.</div>{noteError && <div className="text-danger mt-1" role="alert">{noteError}</div>}<button className="btn btn-outline-secondary mt-2" disabled={busy !== null} type="submit">{busy === "note" ? "Saving…" : "Save internal note"}</button></form></div></section>
    </div>

    <section className="card shadow-sm staff-attachments" aria-labelledby="staff-attachments-heading"><div className="card-body"><div className="d-flex justify-content-between align-items-center gap-2"><h2 className="h5 mb-0" id="staff-attachments-heading">Attachments <span className="badge zen-badge zen-badge-count">{ticket.attachments.length}</span></h2><span className="text-secondary small">Staff read-only access</span></div><p className="staff-section-description">Active attachments can be downloaded. Removed files retain metadata but cannot be downloaded.</p>{ticket.attachments.length === 0 ? <p className="text-secondary mb-0">No attachments on this ticket.</p> : <ul className="list-group staff-attachment-list">{ticket.attachments.map((attachment) => <li className="list-group-item" key={attachment.id}><div className="d-flex flex-wrap align-items-center gap-2"><div className="me-auto text-break"><strong>{attachment.originalName}</strong><small className="d-block text-secondary">{attachment.mimeType} · {Math.ceil(attachment.sizeBytes / 1024)} KB · {dateLabel(attachment.createdAt)}</small></div>{attachment.removedAt ? <span className="badge zen-badge zen-badge-removed">Removed</span> : <a className="btn btn-sm btn-outline-success" download href={attachmentDownloadUrl(attachment.id)}>Download</a>}</div>{attachment.removedAt && <small className="text-secondary d-block mt-2">Removed on {dateLabel(attachment.removedAt)}. Reason: {attachment.removalReason ?? "No reason recorded."}</small>}</li>)}</ul>}</div></section>
  </section>;
}
