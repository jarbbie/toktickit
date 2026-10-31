import { useEffect, useState, type ReactNode } from "react";
import { NavLink } from "react-router-dom";
import { ApiError, type AuthUser, type RequesterDashboard as RequesterDashboardData, type RequesterDashboardTicket, type StaffDashboard as StaffDashboardData, type StaffDashboardAction, type StaffDashboardTicket, loadRequesterDashboard, loadStaffDashboard } from "./api.js";

type DashboardState<T> =
  | { key: string; status: "loading" }
  | { key: string; status: "ready"; data: T }
  | { key: string; status: "failure"; forbidden: boolean };

function useDashboardData<T>(userId: number, loader: () => Promise<T>) {
  const [attempt, setAttempt] = useState(0);
  const key = `${userId}:${attempt}`;
  const [state, setState] = useState<DashboardState<T>>({ key, status: "loading" });

  useEffect(() => {
    let cancelled = false;
    setState({ key, status: "loading" });
    void loader().then((data) => {
      if (!cancelled) setState({ key, status: "ready", data });
    }).catch((error: unknown) => {
      if (!cancelled) setState({ key, status: "failure", forbidden: error instanceof ApiError && error.status === 403 });
    });
    return () => { cancelled = true; };
  }, [key, loader]);

  return {
    state: state.key === key ? state : { key, status: "loading" as const },
    retry: () => setAttempt((value) => value + 1),
  };
}

function dateLabel(value: string) {
  return new Date(value).toLocaleString();
}

function enumLabel(value: string) {
  if (value === "WAITING_FOR_REQUESTER") return "Waiting for Requester";
  return value.split("_").map((part) => part[0] + part.slice(1).toLowerCase()).join(" ");
}

function StatusBadge({ status }: { status: string }) {
  return <span className={`badge zen-badge zen-status-${status.toLowerCase().replaceAll("_", "-")}`}>{enumLabel(status)}</span>;
}

function PriorityBadge({ priority }: { priority: string }) {
  return <span className={`badge zen-badge zen-priority-${priority.toLowerCase()}`}>{enumLabel(priority)}</span>;
}

function MetricCard({ label, count, href }: { label: string; count: number; href: string }) {
  return <NavLink className="card dashboard-metric" to={href} aria-label={`${label}: ${count}. View matching tickets`}>
    <span className="dashboard-metric-label">{label}</span>
    <strong className="dashboard-metric-count">{count}</strong>
    <span className="dashboard-metric-action">View tickets <span aria-hidden="true">→</span></span>
  </NavLink>;
}

function DashboardLoadState({ state, retry }: { state: DashboardState<unknown>; retry: () => void }) {
  if (state.status === "loading") return <p className="dashboard-state" role="status">Loading dashboard…</p>;
  if (state.status === "failure") return <div className="alert alert-danger dashboard-state" role="alert">
    {state.forbidden ? "You do not have permission to view this dashboard." : "Unable to load dashboard."}
    {!state.forbidden && <button className="btn btn-sm btn-danger ms-2" onClick={retry}>Retry</button>}
  </div>;
  return null;
}

function DashboardSection({ title, description, href, hrefLabel, children }: { title: string; description?: string; href: string; hrefLabel: string; children: ReactNode }) {
  return <section className="card dashboard-list-section">
    <div className="dashboard-section-heading">
      <div><h2 className="h5 mb-1">{title}</h2>{description && <p className="text-secondary mb-0">{description}</p>}</div>
      <NavLink className="btn btn-sm btn-outline-success" to={href}>{hrefLabel}</NavLink>
    </div>
    {children}
  </section>;
}

function RequesterTicketList({ tickets, emptyMessage }: { tickets: RequesterDashboardTicket[]; emptyMessage: string }) {
  if (tickets.length === 0) return <div className="dashboard-empty"><p>{emptyMessage}</p><NavLink className="btn btn-sm btn-zen-primary" to="/tickets/new">Create Ticket</NavLink><NavLink className="btn btn-sm btn-outline-success" to="/tickets">My Tickets</NavLink></div>;
  return <ul className="dashboard-ticket-list">{tickets.map((ticket) => <li key={ticket.id}>
    <NavLink className="dashboard-ticket-link" to={ticket.href}>
      <span className="dashboard-ticket-main"><strong>{ticket.ticketNumber}</strong><span>{ticket.summary}</span></span>
      <span className="dashboard-ticket-state"><StatusBadge status={ticket.status} /><PriorityBadge priority={ticket.itPriority} /></span>
      <span className="dashboard-ticket-date">{ticket.resolvedAt ? `Resolved ${dateLabel(ticket.resolvedAt)}` : `Updated ${dateLabel(ticket.updatedAt)}`}</span>
    </NavLink>
  </li>)}</ul>;
}

function StaffTicketList({ tickets, emptyMessage }: { tickets: StaffDashboardTicket[]; emptyMessage: string }) {
  if (tickets.length === 0) return <div className="dashboard-empty"><p>{emptyMessage}</p><NavLink className="btn btn-sm btn-outline-success" to="/staff/tickets">Ticket Queue</NavLink></div>;
  return <ul className="dashboard-ticket-list">{tickets.map((ticket) => <li key={ticket.id}>
    <NavLink className="dashboard-ticket-link dashboard-staff-ticket-link" to={ticket.href}>
      <span className="dashboard-ticket-main"><strong>{ticket.ticketNumber}</strong><span>{ticket.summary}</span><small>Requester: {ticket.requester.name}</small></span>
      <span className="dashboard-ticket-state"><StatusBadge status={ticket.status} /><PriorityBadge priority={ticket.itPriority} /></span>
      <span className="dashboard-ticket-owner">Owner: {ticket.owner?.name ?? "Unassigned"}</span>
      <span className="dashboard-ticket-date">Updated {dateLabel(ticket.updatedAt)}</span>
    </NavLink>
  </li>)}</ul>;
}

function StaffActionList({ actions, emptyMessage }: { actions: StaffDashboardAction[]; emptyMessage: string }) {
  if (actions.length === 0) return <div className="dashboard-empty"><p>{emptyMessage}</p></div>;
  return <ul className="dashboard-action-list">{actions.map((action) => <li key={action.id}>
    <NavLink className="dashboard-action-link" to={action.href}>
      <span className="dashboard-action-main"><strong>{action.ticketNumber}</strong><span>{action.summary}</span><small>{action.description}</small></span>
      <StatusBadge status={action.status} />
      <time className="dashboard-action-date" dateTime={action.actionAt}>{dateLabel(action.actionAt)}</time>
    </NavLink>
  </li>)}</ul>;
}

function requesterUpdatedHref(windowStart: string) {
  const params = new URLSearchParams({ updatedAfter: windowStart, sortBy: "updatedAt", direction: "desc" });
  return `/tickets?${params}`;
}

function staffUpdatedHref(windowStart: string) {
  const params = new URLSearchParams({ statusGroup: "open", updatedAfter: windowStart, sortBy: "updatedAt", direction: "desc" });
  return `/staff/tickets?${params}`;
}

function staffUrgentHref() {
  return "/staff/tickets?statusGroup=open&itPriorityGroup=high_or_urgent&sortBy=urgentWork";
}

function RequesterDashboard({ user }: { user: AuthUser }) {
  const { state, retry } = useDashboardData<RequesterDashboardData>(user.id, loadRequesterDashboard);
  return <section className="dashboard-page requester-dashboard-page">
    <header className="dashboard-heading"><div><h1 className="h3 mb-1" tabIndex={-1}>Dashboard</h1><p className="text-secondary mb-0">A quick view of your support requests.</p></div></header>
    {state.status !== "ready" && <DashboardLoadState state={state} retry={retry} />}
    {state.status === "ready" && <>
      <div className="dashboard-metrics">
        <MetricCard label="Open Tickets" count={state.data.counts.openTickets.count} href={state.data.counts.openTickets.href} />
        <MetricCard label="Waiting for Requester" count={state.data.counts.waitingForRequester.count} href={state.data.counts.waitingForRequester.href} />
        <MetricCard label="Recently Resolved" count={state.data.counts.recentlyResolved.count} href={state.data.counts.recentlyResolved.href} />
      </div>
      <div className="dashboard-list-grid">
        <DashboardSection title="Recently Updated" description="Your latest ticket activity." href={requesterUpdatedHref(state.data.windowStart)} hrefLabel="View recent tickets">
          <RequesterTicketList tickets={state.data.recentlyUpdated} emptyMessage="No recently updated tickets. Create a ticket when you need support." />
        </DashboardSection>
        <DashboardSection title="Recently Resolved" description="Tickets resolved during the recent activity window." href={state.data.counts.recentlyResolved.href} hrefLabel="View resolved tickets">
          <RequesterTicketList tickets={state.data.recentlyResolvedTickets} emptyMessage="No tickets have been resolved in this period. Your tickets remain available in My Tickets." />
        </DashboardSection>
      </div>
    </>}
  </section>;
}

function StaffDashboard({ user }: { user: AuthUser }) {
  const { state, retry } = useDashboardData<StaffDashboardData>(user.id, loadStaffDashboard);
  return <section className="dashboard-page staff-dashboard-page">
    <header className="dashboard-heading"><div><h1 className="h3 mb-1" tabIndex={-1}>Dashboard</h1><p className="text-secondary mb-0">Current support workload and items needing attention.</p></div></header>
    {state.status !== "ready" && <DashboardLoadState state={state} retry={retry} />}
    {state.status === "ready" && <>
      <div className="dashboard-metrics">
        <MetricCard label="Unassigned Open Tickets" count={state.data.counts.unassignedOpen.count} href={state.data.counts.unassignedOpen.href} />
        <MetricCard label="My Open Tickets" count={state.data.counts.ownedByMeOpen.count} href={state.data.counts.ownedByMeOpen.href} />
      </div>
      <div className="dashboard-count-groups">
        <section className="card dashboard-count-section"><div className="dashboard-section-heading"><div><h2 className="h5 mb-1">Tickets by Status</h2><p className="text-secondary mb-0">All ticket statuses</p></div></div>
          <ul className="dashboard-count-list">{state.data.counts.byStatus.map(({ status, count, href }) => <li key={status}><NavLink to={href}><span>{enumLabel(status)}</span><strong>{count}</strong></NavLink></li>)}</ul>
        </section>
        <section className="card dashboard-count-section"><div className="dashboard-section-heading"><div><h2 className="h5 mb-1">Open Tickets by IT Priority</h2><p className="text-secondary mb-0">Open tickets only</p></div></div>
          <ul className="dashboard-count-list">{state.data.counts.byITPriority.map(({ itPriority, count, href }) => <li key={itPriority}><NavLink to={href}><span><PriorityBadge priority={itPriority} /></span><strong>{count}</strong></NavLink></li>)}</ul>
        </section>
      </div>
      <div className="dashboard-list-grid">
        <DashboardSection title="Recently Updated" description="Open tickets changed during the recent activity window." href={staffUpdatedHref(state.data.windowStart)} hrefLabel="View recent tickets">
          <StaffTicketList tickets={state.data.recentlyUpdated} emptyMessage="No recently updated open tickets. View the Ticket Queue for current work." />
        </DashboardSection>
        <DashboardSection title="Urgent Work" description="Open HIGH and URGENT tickets, ordered by priority and age." href={staffUrgentHref()} hrefLabel="View urgent work">
          <StaffTicketList tickets={state.data.urgentTickets} emptyMessage="No HIGH or URGENT open tickets. View the Ticket Queue for all work." />
        </DashboardSection>
      </div>
      <section className="card dashboard-list-section dashboard-my-actions" aria-labelledby="dashboard-my-actions-title">
        <div className="dashboard-section-heading">
          <div><h2 className="h5 mb-1" id="dashboard-my-actions-title">My Actions Taken</h2><p className="text-secondary mb-0">Actions recorded by you, with the five most recent shown.</p></div>
          <strong className="dashboard-action-count" aria-label={`${state.data.myActionsTaken.count} Actions Taken`}>{state.data.myActionsTaken.count}</strong>
        </div>
        <StaffActionList actions={state.data.myActionsTaken.recent} emptyMessage="You have not recorded any Actions Taken yet." />
      </section>
    </>}
  </section>;
}

export default function Dashboard({ user }: { user: AuthUser }) {
  return user.role === "REQUESTER" ? <RequesterDashboard user={user} /> : <StaffDashboard user={user} />;
}
