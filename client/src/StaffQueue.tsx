import { useEffect, useMemo, useState } from "react";
import { NavLink, useLocation, useSearchParams } from "react-router-dom";
import { ApiError, type ReferenceData, type StaffQueueItem, type StaffQueueQuery, type StaffQueueResponse, loadReferenceData, loadStaffTickets } from "./api.js";

const priorities = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;
const statuses = ["NEW", "OPEN", "IN_PROGRESS", "WAITING_FOR_REQUESTER", "RESOLVED", "CLOSED", "REOPENED", "CANCELLED"] as const;
const pageSizes = [10, 20, 50] as const;

const initialFilters: StaffQueueQuery = {
  search: "", categoryId: "", requestedPriority: "", itPriority: "", status: "", ownership: "all",
  sortBy: "updatedAt", direction: "desc", page: 1, pageSize: 10,
};

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

function readFilters(params: URLSearchParams): StaffQueueQuery {
  const page = Number(params.get("page"));
  const pageSize = Number(params.get("pageSize"));
  const statusGroupValue = params.get("statusGroup");
  const statusGroup = statusGroupValue === "open" ? "open" : undefined;
  const statusValue = params.get("status");
  const status = statuses.includes(statusValue as typeof statuses[number]) ? statusValue as StaffQueueQuery["status"] : "";
  const itPriorityValue = params.get("itPriority");
  const itPriority = priorities.includes(itPriorityValue as typeof priorities[number]) ? itPriorityValue as StaffQueueQuery["itPriority"] : "";
  const itPriorityGroupValue = params.get("itPriorityGroup");
  const itPriorityGroup = statusGroup === "open" && itPriorityGroupValue === "high_or_urgent" ? "high_or_urgent" : undefined;
  const sortValue = params.get("sortBy");
  const sortOptions: NonNullable<StaffQueueQuery["sortBy"]>[] = ["updatedAt", "createdAt", "ticketNumber", "requestedPriority", "itPriority", "status", "urgentWork"];
  const sortBy = sortOptions.includes(sortValue as NonNullable<StaffQueueQuery["sortBy"]>) ? sortValue as StaffQueueQuery["sortBy"] : initialFilters.sortBy;
  return {
    search: params.get("search") ?? initialFilters.search,
    categoryId: params.get("categoryId") ?? initialFilters.categoryId,
    requestedPriority: (params.get("requestedPriority") as StaffQueueQuery["requestedPriority"]) ?? initialFilters.requestedPriority,
    itPriority: itPriorityGroup ? "" : itPriority,
    status: statusGroup ? "" : status,
    statusGroup,
    updatedAfter: params.get("updatedAfter") ?? undefined,
    itPriorityGroup,
    ownership: (params.get("ownership") as StaffQueueQuery["ownership"]) ?? initialFilters.ownership,
    sortBy: sortBy === "urgentWork" && !(statusGroup === "open" && itPriorityGroup === "high_or_urgent") ? initialFilters.sortBy : sortBy,
    direction: (params.get("direction") as StaffQueueQuery["direction"]) ?? initialFilters.direction,
    page: Number.isInteger(page) && page > 0 ? page : 1,
    pageSize: pageSizes.includes(pageSize as typeof pageSizes[number]) ? pageSize : 10,
  };
}

function queueParams(filters: StaffQueueQuery) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== "" && !(filters.sortBy === "urgentWork" && key === "direction")) params.set(key, String(value));
  }
  return params;
}

function queueRequest(filters: StaffQueueQuery): StaffQueueQuery {
  if (filters.sortBy !== "urgentWork") return filters;
  const query = { ...filters };
  delete query.direction;
  return query;
}

function dateLabel(value: string) {
  return new Date(value).toLocaleString();
}

function queueFilterLabels(filters: StaffQueueQuery) {
  const labels: string[] = [];
  if (filters.statusGroup === "open") labels.push("Open Tickets");
  if (filters.ownership === "unassigned") labels.push("Unassigned");
  if (filters.ownership === "mine") labels.push("My Tickets");
  if (filters.status && !filters.statusGroup) labels.push(enumLabel(filters.status));
  if (filters.itPriorityGroup === "high_or_urgent") labels.push("HIGH or URGENT IT Priority");
  if (filters.itPriority && !filters.itPriorityGroup) labels.push(`${enumLabel(filters.itPriority)} IT Priority`);
  if (filters.updatedAfter) labels.push(`Updated since ${new Date(filters.updatedAfter).toLocaleDateString()}`);
  return labels;
}

function ownerLabel(ticket: StaffQueueItem) {
  return ticket.owner?.name ?? "Unassigned";
}

export default function StaffQueue() {
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const searchKey = searchParams.toString();
  const filters = useMemo(() => readFilters(new URLSearchParams(searchKey)), [searchKey]);
  const [references, setReferences] = useState<ReferenceData | null>(null);
  const [referenceFailure, setReferenceFailure] = useState(false);
  const [referenceRetry, setReferenceRetry] = useState(0);
  const [result, setResult] = useState<StaffQueueResponse | null>(null);
  const [failure, setFailure] = useState<ApiError | Error | null>(null);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setReferenceFailure(false);
    void loadReferenceData().then((data) => {
      if (!cancelled) setReferences(data);
    }).catch(() => {
      if (!cancelled) setReferenceFailure(true);
    });
    return () => { cancelled = true; };
  }, [referenceRetry]);

  useEffect(() => {
    let cancelled = false;
    setResult(null);
    setFailure(null);
    void loadStaffTickets(queueRequest(filters)).then((data) => {
      if (!cancelled) setResult(data);
    }).catch((error) => {
      if (!cancelled) setFailure(error instanceof Error ? error : new Error("Unable to load staff tickets."));
    });
    return () => { cancelled = true; };
  }, [filters, retry]);

  function update<K extends keyof StaffQueueQuery>(key: K, value: StaffQueueQuery[K]) {
    const next: StaffQueueQuery = { ...filters, [key]: value, page: 1 };
    if (key === "statusGroup" && value) next.status = "";
    if (key === "status") {
      next.statusGroup = undefined;
      next.itPriorityGroup = undefined;
    }
    if (key === "itPriorityGroup" && value) next.itPriority = "";
    if (key === "itPriority") next.itPriorityGroup = undefined;
    if (key === "sortBy" && value !== "urgentWork" && next.itPriorityGroup === "high_or_urgent" && next.statusGroup === "open") {
      // Keep the group filter while allowing a different queue sort.
    } else if (key !== "sortBy" && next.sortBy === "urgentWork" && !(next.statusGroup === "open" && next.itPriorityGroup === "high_or_urgent")) {
      next.sortBy = "updatedAt";
    }
    setSearchParams(queueParams(next));
  }

  function clearFilters() {
    setSearchParams(queueParams(initialFilters));
  }

  function changePage(page: number) {
    setSearchParams(queueParams({ ...filters, page }));
  }

  const hasFilters = Boolean(filters.search || filters.categoryId || filters.requestedPriority || filters.itPriority || filters.itPriorityGroup || filters.status || filters.statusGroup || filters.updatedAfter || filters.ownership !== "all");
  const activeFilterLabels = queueFilterLabels(filters);
  const outOfRange = Boolean(result && result.totalPages > 0 && result.page > result.totalPages);
  const firstItem = result && result.items.length > 0 ? (result.page - 1) * result.pageSize + 1 : 0;
  const lastItem = result ? Math.min(result.page * result.pageSize, result.totalItems) : 0;
  const visiblePages = result ? Array.from({ length: result.totalPages }, (_, index) => index + 1).filter((page) => result.totalPages <= 7 || page === 1 || page === result.totalPages || result.page <= 3 && page <= 5 || result.page >= result.totalPages - 2 && page >= result.totalPages - 4 || Math.abs(page - result.page) <= 1) : [];
  const queueError = failure instanceof ApiError && failure.status === 403
    ? "You do not have permission to view the staff ticket queue."
    : "Unable to load staff ticket queue.";

  return <section className="staff-queue-page">
    <header className="ticket-list-heading d-flex flex-wrap justify-content-between align-items-end gap-3 mb-4">
      <div><h1 className="h3 mb-1">Ticket Queue</h1><p className="text-secondary mb-0">Review and triage support requests across the organization.</p></div>
      <button className="btn btn-outline-secondary" onClick={clearFilters}><span aria-hidden="true">↻</span> Clear Filters</button>
    </header>
    {activeFilterLabels.length > 0 && <p className="dashboard-active-filter" role="status">Active queue filters: {activeFilterLabels.join(" · ")}</p>}
    {referenceFailure && <div className="alert alert-danger" role="alert">Unable to load queue reference data. <button className="btn btn-sm btn-danger ms-2" onClick={() => { setReferences(null); setReferenceFailure(false); setReferenceRetry((value) => value + 1); }}>Retry</button></div>}
    <div className="card staff-queue-filter-card mb-4"><div className="card-body staff-queue-filter-grid">
      <div className="staff-queue-filter-search"><label className="form-label" htmlFor="staff-ticket-search">Search tickets</label><input className="form-control" id="staff-ticket-search" value={filters.search} onChange={(event) => update("search", event.target.value)} placeholder="Ticket number, summary, or Requester" /></div>
      <div><label className="form-label" htmlFor="staff-ticket-category">Category</label><select className="form-select" id="staff-ticket-category" value={filters.categoryId} onChange={(event) => update("categoryId", event.target.value)}><option value="">All categories</option>{references?.categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></div>
      <div><label className="form-label" htmlFor="staff-requested-priority">Requested Priority</label><select className="form-select" id="staff-requested-priority" value={filters.requestedPriority} onChange={(event) => update("requestedPriority", event.target.value as StaffQueueQuery["requestedPriority"])}><option value="">All priorities</option>{priorities.map((priority) => <option key={priority} value={priority}>{enumLabel(priority)}</option>)}</select></div>
      <div><label className="form-label" htmlFor="staff-it-priority">IT Priority</label><select className="form-select" id="staff-it-priority" value={filters.itPriority} onChange={(event) => update("itPriority", event.target.value as StaffQueueQuery["itPriority"])}><option value="">All priorities</option>{priorities.map((priority) => <option key={priority} value={priority}>{enumLabel(priority)}</option>)}</select></div>
      <div><label className="form-label" htmlFor="staff-status">Current Status</label><select className="form-select" id="staff-status" value={filters.status} onChange={(event) => update("status", event.target.value as StaffQueueQuery["status"])}><option value="">All statuses</option>{statuses.map((status) => <option key={status} value={status}>{enumLabel(status)}</option>)}</select></div>
      <div><label className="form-label" htmlFor="staff-ownership">Ownership</label><select className="form-select" id="staff-ownership" value={filters.ownership} onChange={(event) => update("ownership", event.target.value as StaffQueueQuery["ownership"])}><option value="all">All</option><option value="mine">Mine</option><option value="assigned">Assigned</option><option value="unassigned">Unassigned</option></select></div>
      <div><label className="form-label" htmlFor="staff-sort">Sort by</label><select className="form-select" id="staff-sort" value={filters.sortBy} onChange={(event) => update("sortBy", event.target.value as StaffQueueQuery["sortBy"])}><option value="updatedAt">Last Updated</option><option value="createdAt">Created Date</option><option value="ticketNumber">Ticket Number</option><option value="requestedPriority">Requested Priority</option><option value="itPriority">IT Priority</option><option value="status">Current Status</option><option disabled={!(filters.statusGroup === "open" && filters.itPriorityGroup === "high_or_urgent")} value="urgentWork">Urgent Work priority then age</option></select></div>
      <div>
        <label className="form-label" htmlFor="staff-direction">Direction</label>
        <select aria-describedby={filters.sortBy === "urgentWork" ? "staff-direction-help" : undefined} className="form-select" disabled={filters.sortBy === "urgentWork"} id="staff-direction" value={filters.sortBy === "urgentWork" ? "fixed" : filters.direction} onChange={(event) => update("direction", event.target.value as StaffQueueQuery["direction"])}>
          {filters.sortBy === "urgentWork" && <option disabled value="fixed">Fixed urgent-work order</option>}
          <option value="desc">Newest / highest first</option>
          <option value="asc">Oldest / lowest first</option>
        </select>
        {filters.sortBy === "urgentWork" && <small className="form-text" id="staff-direction-help">URGENT tickets come first, then HIGH; tickets with older updates come first within each priority.</small>}
      </div>
      <div><label className="form-label" htmlFor="staff-page-size">Rows per page</label><select className="form-select" id="staff-page-size" value={filters.pageSize} onChange={(event) => update("pageSize", Number(event.target.value))}><option value="10">10</option><option value="20">20</option><option value="50">50</option></select></div>
    </div></div>
    {!result && !failure && <p role="status">Loading ticket queue…</p>}
    {failure && <div className="alert alert-danger" role="alert">{queueError} <button className="btn btn-sm btn-danger ms-2" onClick={() => setRetry((value) => value + 1)}>Retry</button></div>}
    {result && result.items.length === 0 && <div className="alert alert-info" role="status">{outOfRange ? "This page is beyond the end of the queue." : hasFilters ? "No tickets match your filters." : "No tickets are currently in the queue."}{hasFilters && !outOfRange && <button className="btn btn-sm btn-outline-success ms-2" onClick={clearFilters}>Clear Filters</button>}{outOfRange && <button className="btn btn-sm btn-outline-success ms-2" onClick={() => changePage(Math.max(1, result.totalPages))}>Go to last page</button>}</div>}
    {result && result.items.length > 0 && <>
      <div className="card ticket-table-card staff-queue-desktop"><div className="table-responsive staff-queue-table-wrap"><table className="table table-hover mb-0"><thead><tr><th>Ticket Number</th><th>Summary / Requester</th><th>Category</th><th>Requested Priority</th><th>IT Priority</th><th>Current Status</th><th>Ticket Owner</th><th>Last Updated</th></tr></thead><tbody>{result.items.map((ticket) => <tr key={ticket.id}><td><NavLink className="ticket-number-link" to={`/staff/tickets/${ticket.id}${location.search}`}>{ticket.ticketNumber}</NavLink></td><td><strong>{ticket.summary}</strong><small className="d-block text-secondary">{ticket.requester.name}</small></td><td>{ticket.category.name}</td><td>{priorityBadge(ticket.requestedPriority)}</td><td>{priorityBadge(ticket.itPriority)}</td><td>{statusBadge(ticket.status)}</td><td>{ownerLabel(ticket)}</td><td>{dateLabel(ticket.updatedAt)}</td></tr>)}</tbody></table></div></div>
      <div className="staff-queue-mobile">{result.items.map((ticket) => <article className="card staff-queue-card" key={ticket.id}><div className="card-body"><div className="d-flex justify-content-between align-items-start gap-2"><NavLink className="ticket-number-link" to={`/staff/tickets/${ticket.id}${location.search}`}>{ticket.ticketNumber}</NavLink>{statusBadge(ticket.status)}</div><h2 className="h5 mt-2 mb-1">{ticket.summary}</h2><p className="text-secondary mb-3">Requester: {ticket.requester.name}</p><dl className="row staff-queue-card-details mb-0"><dt className="col-6">Category</dt><dd className="col-6">{ticket.category.name}</dd><dt className="col-6">Requested Priority</dt><dd className="col-6">{priorityBadge(ticket.requestedPriority)}</dd><dt className="col-6">IT Priority</dt><dd className="col-6">{priorityBadge(ticket.itPriority)}</dd><dt className="col-6">Ticket Owner</dt><dd className="col-6">{ownerLabel(ticket)}</dd><dt className="col-6">Last Updated</dt><dd className="col-6">{dateLabel(ticket.updatedAt)}</dd></dl></div></article>)}</div>
      <footer className="ticket-table-footer staff-queue-footer"><span>Showing {firstItem} to {lastItem} of {result.totalItems} tickets</span>{result.totalPages > 1 && <nav className="ticket-pagination" aria-label="Ticket queue pagination"><button className="btn btn-sm btn-outline-secondary" disabled={result.page === 1} onClick={() => changePage(result.page - 1)}>‹ Previous</button>{visiblePages.map((page, index) => <span key={page}>{index > 0 && page - visiblePages[index - 1] > 1 && <span aria-hidden="true" className="page-ellipsis">…</span>}<button aria-current={page === result.page ? "page" : undefined} aria-label={`Page ${page}`} className={`btn btn-sm page-number${page === result.page ? " current-page" : " btn-outline-secondary"}`} onClick={() => changePage(page)}>{page}</button></span>)}<button className="btn btn-sm btn-outline-secondary" disabled={result.page === result.totalPages} onClick={() => changePage(result.page + 1)}>Next ›</button></nav>}</footer>
    </>}
  </section>;
}
