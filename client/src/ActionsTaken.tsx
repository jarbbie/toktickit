import { type FormEvent, useCallback, useEffect, useRef, useState } from "react";
import {
  ApiError,
  type ActionRecord,
  type ActionSnapshot,
  type ActionStatus,
  type ActionTransitionInput,
  type StaffOwnerOption,
  type TicketStatus,
  assignAction,
  createAction,
  editAction,
  loadActions,
  transitionAction,
} from "./api.js";

type FormMode = "create" | "edit" | "assign" | null;
type ActionForm = {
  actionAt: string;
  description: string;
  result: string;
  assigneeId: string;
  followUpRequired: boolean;
  followUpNote: string;
  attachmentNotes: string;
};
type FieldErrors = Partial<Record<keyof ActionForm, string>>;
type PendingTransition = { actionId: number; status: "COMPLETED" | "CANCELLED" };

const mutableTicketStatuses: readonly TicketStatus[] = ["NEW", "OPEN", "IN_PROGRESS", "WAITING_FOR_REQUESTER", "REOPENED"];
const actionTimeZone = "Asia/Bangkok";
const statuses: Record<ActionStatus, readonly Exclude<ActionStatus, "PLANNED">[]> = {
  PLANNED: ["IN_PROGRESS", "COMPLETED", "CANCELLED"],
  IN_PROGRESS: ["COMPLETED", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
};
const snapshotFields: (keyof ActionSnapshot)[] = ["actionAt", "description", "result", "performedBy", "assignee", "status", "followUpRequired", "followUpNote", "attachmentNotes", "version"];
const snapshotLabels: Record<keyof ActionSnapshot, string> = {
  actionAt: "Action date/time", description: "Description", result: "Result", performedBy: "Performed by", assignee: "Assignee",
  status: "Status", followUpRequired: "Follow-up required", followUpNote: "Follow-up note", attachmentNotes: "Attachment notes", version: "Version",
};

function enumLabel(value: string) {
  return value === "WAITING_FOR_REQUESTER" ? "Waiting for Requester" : value.split("_").map((part) => part[0] + part.slice(1).toLowerCase()).join(" ");
}

function dateLabel(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString(undefined, { timeZone: actionTimeZone });
}

function localDateTimeValue(value = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", {
    timeZone: actionTimeZone, calendar: "gregory", numberingSystem: "latn",
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(value).map(({ type, value: part }) => [type, part]));
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

function bangkokDateTimeWithOffset(value: string): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const [year, month, day, hour, minute] = match.slice(1).map(Number);
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (year < 1 || month < 1 || month > 12 || day < 1 || day > daysInMonth[month - 1] || hour > 23 || minute > 59) return null;
  return `${value}:00+07:00`;
}

function emptyForm(): ActionForm {
  return { actionAt: localDateTimeValue(), description: "", result: "", assigneeId: "", followUpRequired: false, followUpNote: "", attachmentNotes: "" };
}

function personLabel(person: { name: string; role: string } | null) {
  if (!person) return "Unassigned";
  const role = person.role === "IT_STAFF" ? "IT Staff" : person.role === "ADMINISTRATOR" ? "Administrator" : "Requester";
  return `${person.name} (${role})`;
}

function snapshotValue(field: keyof ActionSnapshot, value: unknown) {
  if (value === null || value === undefined || value === "") return "None";
  if (field === "actionAt" && typeof value === "string") return dateLabel(value);
  if ((field === "performedBy" || field === "assignee") && typeof value === "object" && value !== null && "name" in value) {
    return personLabel(value as { name: string; role: string });
  }
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
}

function eventChanges(event: NonNullable<ActionRecord["events"]>[number]) {
  const before = event.before;
  const after = event.after;
  if (!after) return [];
  return snapshotFields.filter((field) => !before || JSON.stringify(before[field]) !== JSON.stringify(after[field])).map((field) => ({
    field,
    label: snapshotLabels[field],
    value: before ? `${snapshotValue(field, before[field])} → ${snapshotValue(field, after[field])}` : snapshotValue(field, after[field]),
  }));
}

function uuid() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (character) => {
    const value = Math.floor(Math.random() * 16);
    return (character === "x" ? value : (value & 0x3) | 0x8).toString(16);
  });
}

function errorText(error: unknown) {
  if (!(error instanceof ApiError)) return "Unable to process this Action. Your entries are kept; try again.";
  if (error.status === 403) return "You do not have permission to change this Action.";
  if (error.status === 404) return "This Ticket or Action is no longer available.";
  if (error.code === "ACTION_ASSIGNEE_UNAVAILABLE") return "That assignee is unavailable. The active support choices have been refreshed; choose another person or Unassigned.";
  if (error.code === "STALE_ACTION" || error.code === "STALE_TICKET_WORKFLOW") return "This Action or Ticket changed. Current data was refreshed; review it before resubmitting your entries.";
  if (error.code === "ACTION_TICKET_NOT_MUTABLE") return "This Ticket no longer accepts Action changes. Its current details were refreshed.";
  return error.message || "Unable to process this Action. Your entries are kept; try again.";
}

function fieldErrorAttributes(id: string, message?: string) {
  return message ? { "aria-invalid": true, "aria-describedby": `${id}-error` } : {};
}

function AssigneeOptions({ options, current, selectedValue }: { options: StaffOwnerOption[]; current?: ActionRecord["assignee"]; selectedValue?: string }) {
  const hasCurrent = current && options.some((option) => option.id === current.id);
  const selectedIsUnavailable = selectedValue && !options.some((option) => String(option.id) === selectedValue) && String(current?.id ?? "") !== selectedValue;
  return <>
    <option value="">Unassigned</option>
    {current && !hasCurrent && <option disabled value={current.id}>{current.name} (current assignment unavailable)</option>}
    {selectedIsUnavailable && <option disabled value={selectedValue}>Selected assignee is no longer available</option>}
    {options.map((option) => <option key={option.id} value={option.id}>{option.name} ({option.role === "IT_STAFF" ? "IT Staff" : "Administrator"})</option>)}
  </>;
}

export interface ActionsTakenProps {
  ticketId: number;
  ticketStatus: TicketStatus;
  workflowVersion: number;
  readOnly?: boolean;
  currentUserName?: string;
  assigneeOptions?: StaffOwnerOption[];
  refreshTicket?: () => Promise<number>;
}

export default function ActionsTaken({
  ticketId,
  ticketStatus,
  workflowVersion: ticketWorkflowVersion,
  readOnly = false,
  currentUserName = "Current user",
  assigneeOptions = [],
  refreshTicket,
}: ActionsTakenProps) {
  const [actions, setActions] = useState<ActionRecord[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState("");
  const [formMode, setFormMode] = useState<FormMode>(null);
  const [formActionId, setFormActionId] = useState<number | null>(null);
  const [form, setForm] = useState<ActionForm>(emptyForm);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState("");
  const [operationError, setOperationError] = useState("");
  const [success, setSuccess] = useState("");
  const [refreshWarning, setRefreshWarning] = useState("");
  const [saving, setSaving] = useState(false);
  const [pendingTransition, setPendingTransition] = useState<PendingTransition | null>(null);
  const [clearNotePending, setClearNotePending] = useState(false);
  const [completionDrafts, setCompletionDrafts] = useState<Record<number, string>>({});
  const [transitionError, setTransitionError] = useState("");
  const [transitionFieldError, setTransitionFieldError] = useState("");
  const workflowVersionRef = useRef(ticketWorkflowVersion);
  const createAttemptRef = useRef<{ signature: string; key: string } | null>(null);
  const originalActionAtInputRef = useRef<string | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const currentAction = formActionId === null ? null : actions?.find((action) => action.id === formActionId) ?? null;
  const canWrite = !readOnly && mutableTicketStatuses.includes(ticketStatus);

  useEffect(() => {
    workflowVersionRef.current = ticketWorkflowVersion;
    setFormMode(null); setFormActionId(null); setForm(emptyForm()); setPendingTransition(null); setClearNotePending(false);
    createAttemptRef.current = null;
    originalActionAtInputRef.current = null;
  }, [ticketId]);

  useEffect(() => {
    if (ticketWorkflowVersion > workflowVersionRef.current) workflowVersionRef.current = ticketWorkflowVersion;
  }, [ticketWorkflowVersion]);

  const refreshActionList = useCallback(async (showLoading = false) => {
    if (showLoading) setLoading(true);
    setListError("");
    try {
      setActions(await loadActions(ticketId));
      return true;
    } catch (error) {
      if (error instanceof ApiError && (error.status === 403 || error.status === 404)) setActions(null);
      setListError(error instanceof ApiError && error.status === 403
        ? "You do not have permission to view Actions for this Ticket."
        : error instanceof ApiError && error.status === 404
          ? "This Ticket is no longer available."
          : "Unable to load Actions Taken. Try again.");
      return false;
    } finally {
      if (showLoading) setLoading(false);
    }
  }, [ticketId]);

  useEffect(() => {
    setActions(null);
    void refreshActionList(true);
  }, [refreshActionList]);

  useEffect(() => {
    if (!pendingTransition && !clearNotePending) {
      returnFocusRef.current?.focus();
      return;
    }
    const first = dialogRef.current?.querySelector<HTMLElement>("button:not([disabled]), textarea:not([disabled])");
    first?.focus();
  }, [pendingTransition, clearNotePending]);

  function updateForm<K extends keyof ActionForm>(key: K, value: ActionForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    setFieldErrors((current) => ({ ...current, [key]: undefined }));
    setFormError(""); setOperationError("");
  }

  function openCreate() {
    originalActionAtInputRef.current = null;
    setFormMode("create"); setFormActionId(null); setForm(emptyForm()); setFieldErrors({}); setFormError(""); setOperationError(""); setSuccess(""); setRefreshWarning("");
  }

  function openEdit(action: ActionRecord) {
    const actionAtInput = localDateTimeValue(new Date(action.actionAt));
    originalActionAtInputRef.current = actionAtInput;
    setFormMode("edit"); setFormActionId(action.id); setFieldErrors({}); setFormError(""); setOperationError(""); setSuccess(""); setRefreshWarning("");
    setForm({ actionAt: actionAtInput, description: action.description, result: action.result ?? "", assigneeId: action.assignee ? String(action.assignee.id) : "", followUpRequired: action.followUpRequired, followUpNote: action.followUpNote ?? "", attachmentNotes: action.attachmentNotes ?? "" });
  }

  function openAssignment(action: ActionRecord) {
    originalActionAtInputRef.current = null;
    setFormMode("assign"); setFormActionId(action.id); setFieldErrors({}); setFormError(""); setOperationError(""); setSuccess(""); setRefreshWarning("");
    setForm({ ...emptyForm(), assigneeId: action.assignee ? String(action.assignee.id) : "" });
  }

  function closeForm() {
    if (saving) return;
    originalActionAtInputRef.current = null;
    setFormMode(null); setFormActionId(null); setFieldErrors({}); setFormError("");
  }

  async function refreshParentTicket() {
    if (!refreshTicket) return true;
    try {
      const latest = await refreshTicket();
      workflowVersionRef.current = latest;
      return true;
    } catch {
      return false;
    }
  }

  async function onMutationFailure(error: unknown, transition = false) {
    const text = errorText(error);
    if (transition) {
      setTransitionError(text);
      if (error instanceof ApiError && (error.code === "STALE_ACTION" || error.code === "STALE_TICKET_WORKFLOW")) { setOperationError(text); setPendingTransition(null); }
    } else {
      if (formMode) setFormError(text); else setOperationError(text);
      if (error instanceof ApiError && error.fieldErrors) setFieldErrors(error.fieldErrors as FieldErrors);
    }
    if (error instanceof ApiError && (error.code === "STALE_ACTION" || error.code === "STALE_TICKET_WORKFLOW" || error.code === "ACTION_TICKET_NOT_MUTABLE" || error.code === "ACTION_ASSIGNEE_UNAVAILABLE" || error.status === 404)) {
      const [actionsLoaded, ticketLoaded] = await Promise.all([refreshActionList(), refreshParentTicket()]);
      if (!actionsLoaded || !ticketLoaded) setRefreshWarning("Some current Ticket or Action details could not be refreshed. Use Retry before continuing.");
    }
  }

  async function refreshAfterWrite(message: string) {
    workflowVersionRef.current += 1;
    originalActionAtInputRef.current = null;
    setSuccess(message); setOperationError("");
    setFormMode(null); setFormActionId(null); setFieldErrors({}); setFormError("");
    const [actionsLoaded, ticketLoaded] = await Promise.all([refreshActionList(), refreshParentTicket()]);
    if (!actionsLoaded || !ticketLoaded) setRefreshWarning("The change was saved, but the latest Ticket or Action history could not be loaded. Use Retry to refresh.");
  }

  function validateForm(mode: Exclude<FormMode, null>): FieldErrors {
    const errors: FieldErrors = {};
    if (mode === "assign") return errors;
    if (!bangkokDateTimeWithOffset(form.actionAt)) errors.actionAt = "Enter a valid Action date and time.";
    if (form.description.trim().length < 1 || form.description.trim().length > 2_000) errors.description = "Description must be between 1 and 2000 characters.";
    if (form.attachmentNotes.trim().length > 1_000) errors.attachmentNotes = "Attachment Notes must be no longer than 1000 characters.";
    if (form.followUpRequired && (form.followUpNote.trim().length < 1 || form.followUpNote.trim().length > 1_000)) errors.followUpNote = "Follow-up Note is required and must be no longer than 1000 characters.";
    if (mode === "edit" && currentAction?.status === "COMPLETED" && (form.result.trim().length < 1 || form.result.trim().length > 2_000)) errors.result = "Result is required for a completed Action and must be no longer than 2000 characters.";
    return errors;
  }

  function focusFirstError(errors: FieldErrors) {
    const first = Object.keys(errors)[0];
    if (first) window.setTimeout(() => document.getElementById(`action-${first}`)?.focus(), 0);
  }

  async function submitForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!formMode || saving || !canWrite) return;
    const errors = validateForm(formMode);
    setFieldErrors(errors); setFormError(""); setSuccess("");
    if (Object.keys(errors).length) { focusFirstError(errors); return; }
    if (formMode !== "create" && !currentAction) { setFormError("This Action is no longer available. Refresh the list before continuing."); return; }

    setSaving(true);
    try {
      if (formMode === "create") {
        const actionAt = bangkokDateTimeWithOffset(form.actionAt);
        if (!actionAt) { setFormError("Enter a valid Action date and time."); return; }
        const input = {
          actionAt, description: form.description.trim(),
          assigneeId: form.assigneeId ? Number(form.assigneeId) : null, followUpRequired: form.followUpRequired,
          followUpNote: form.followUpRequired ? form.followUpNote.trim() : null,
          attachmentNotes: form.attachmentNotes.trim() || null, expectedWorkflowVersion: workflowVersionRef.current,
        };
        const signature = JSON.stringify(input);
        const attempt = createAttemptRef.current?.signature === signature ? createAttemptRef.current : { signature, key: uuid() };
        createAttemptRef.current = attempt;
        await createAction(ticketId, input, attempt.key);
        createAttemptRef.current = null;
        await refreshAfterWrite("Action created.");
      } else if (formMode === "assign") {
        const assigneeId = form.assigneeId ? Number(form.assigneeId) : null;
        if ((currentAction!.assignee?.id ?? null) === assigneeId) { closeForm(); return; }
        await assignAction(currentAction!.id, { expectedVersion: currentAction!.version, expectedWorkflowVersion: workflowVersionRef.current, assigneeId });
        await refreshAfterWrite("Action assignee updated.");
      } else {
        const changed: Parameters<typeof editAction>[1] = { expectedVersion: currentAction!.version, expectedWorkflowVersion: workflowVersionRef.current };
        if (form.actionAt !== originalActionAtInputRef.current) {
          const actionAt = bangkokDateTimeWithOffset(form.actionAt);
          if (!actionAt) { setFormError("Enter a valid Action date and time."); return; }
          changed.actionAt = actionAt;
        }
        if (form.description.trim() !== currentAction!.description) changed.description = form.description.trim();
        if ((form.result.trim() || null) !== currentAction!.result) changed.result = form.result.trim() || null;
        if (form.followUpRequired !== currentAction!.followUpRequired) changed.followUpRequired = form.followUpRequired;
        if ((form.followUpRequired ? form.followUpNote.trim() : null) !== currentAction!.followUpNote) changed.followUpNote = form.followUpRequired ? form.followUpNote.trim() : null;
        if ((form.attachmentNotes.trim() || null) !== currentAction!.attachmentNotes) changed.attachmentNotes = form.attachmentNotes.trim() || null;
        if (Object.keys(changed).length === 2) { setFormError("Change at least one field before saving."); return; }
        await editAction(currentAction!.id, changed);
        await refreshAfterWrite("Action updated.");
      }
    } catch (error) {
      await onMutationFailure(error);
    } finally {
      setSaving(false);
    }
  }

  function beginTransition(action: ActionRecord, status: PendingTransition["status"], trigger: HTMLElement) {
    returnFocusRef.current = trigger;
    setTransitionError(""); setTransitionFieldError("");
    setPendingTransition({ actionId: action.id, status });
    if (status === "COMPLETED") setCompletionDrafts((current) => ({ ...current, [action.id]: current[action.id] ?? action.result ?? "" }));
  }

  function closeTransition() {
    setPendingTransition(null); setTransitionError(""); setTransitionFieldError("");
  }

  function requestFollowUpClear(trigger: HTMLInputElement) {
    returnFocusRef.current = trigger;
    setClearNotePending(true);
  }

  function keepFollowUpNote() {
    setClearNotePending(false);
  }

  function confirmFollowUpClear() {
    setForm((current) => ({ ...current, followUpRequired: false, followUpNote: "" }));
    setFieldErrors((current) => ({ ...current, followUpRequired: undefined, followUpNote: undefined }));
    setClearNotePending(false);
  }

  async function startAction(action: ActionRecord) {
    if (saving || !canWrite) return;
    setSaving(true); setOperationError(""); setSuccess("");
    try {
      await transitionAction(action.id, { expectedVersion: action.version, expectedWorkflowVersion: workflowVersionRef.current, status: "IN_PROGRESS" });
      await refreshAfterWrite("Action started.");
    } catch (error) {
      await onMutationFailure(error);
    } finally {
      setSaving(false);
    }
  }

  function handleModalKeyDown(event: React.KeyboardEvent<HTMLDivElement>, close: () => void) {
    if (event.key === "Escape" && !saving) { event.preventDefault(); close(); return; }
    if (event.key !== "Tab") return;
    const focusable = dialogRef.current?.querySelectorAll<HTMLElement>("button:not([disabled]), textarea:not([disabled])");
    if (!focusable?.length) return;
    const first = focusable[0]; const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }

  async function confirmTransition() {
    if (!pendingTransition || saving) return;
    const action = actions?.find((item) => item.id === pendingTransition.actionId);
    if (!action) { setTransitionError("This Action is no longer available. Refresh the list before continuing."); return; }
    const result = completionDrafts[action.id] ?? action.result ?? "";
    if (pendingTransition.status === "COMPLETED" && (result.trim().length < 1 || result.trim().length > 2_000)) {
      setTransitionFieldError("A Result between 1 and 2000 characters is required before completion.");
      return;
    }
    setSaving(true); setTransitionError(""); setTransitionFieldError("");
    try {
      const body: ActionTransitionInput = {
        expectedVersion: action.version,
        expectedWorkflowVersion: workflowVersionRef.current,
        status: pendingTransition.status,
        ...(pendingTransition.status === "COMPLETED" ? { result: result.trim() } : {}),
      };
      await transitionAction(action.id, body);
      setPendingTransition(null);
      setCompletionDrafts((current) => { const next = { ...current }; delete next[action.id]; return next; });
      await refreshAfterWrite(pendingTransition.status === "COMPLETED" ? "Action completed." : "Action cancelled.");
    } catch (error) {
      await onMutationFailure(error, true);
    } finally {
      setSaving(false);
    }
  }

  const list = actions ?? [];
  return <section className="card shadow-sm mb-3 actions-taken-card" aria-labelledby={`actions-taken-heading-${ticketId}`}>
    <div className="card-body">
      <div className="actions-taken-heading">
        <div><h2 className="h5 mb-1" id={`actions-taken-heading-${ticketId}`}>Actions Taken</h2><p className="text-secondary mb-0">Recorded support work for this Ticket.</p></div>
        {canWrite && <button className="btn btn-zen-primary" disabled={saving} onClick={openCreate} type="button">Add Action</button>}
      </div>
      {!readOnly && !canWrite && <div className="alert alert-warning mt-3 mb-0" role="status">{ticketStatus === "CANCELLED" ? "This Ticket is cancelled. Actions remain readable but cannot be changed." : "Reopen this Ticket before creating or changing Actions."}</div>}
      {success && <div className="alert alert-success mt-3" role="status">{success}</div>}
      {operationError && <div className="alert alert-danger mt-3" role="alert">{operationError}</div>}
      {refreshWarning && <div className="alert alert-warning mt-3" role="alert">{refreshWarning}</div>}
      {listError && <div className="alert alert-danger mt-3" role="alert">{listError} <button className="btn btn-sm btn-danger ms-2" onClick={() => void refreshActionList(true)} type="button">Retry</button></div>}
      {loading && <p className="mt-3 mb-0" role="status">Loading Actions Taken…</p>}
      {!loading && !listError && actions?.length === 0 && <p className="text-secondary mt-3 mb-0" role="status">No Actions have been recorded for this Ticket yet.</p>}

      {formMode && <section className="actions-taken-editor mt-3" aria-labelledby="action-form-heading">
        <div className="actions-taken-editor-heading"><div><h3 className="h6 mb-1" id="action-form-heading">{formMode === "create" ? "Create Action" : formMode === "edit" ? "Edit Action" : "Change Action assignee"}</h3><p className="text-secondary small mb-0">Action assignee is separate from Ticket Owner.</p></div><button className="btn btn-sm btn-outline-secondary" disabled={saving} onClick={closeForm} type="button">Close form</button></div>
        {formError && <div className="alert alert-danger mt-3 mb-0" role="alert">{formError}</div>}
        {formMode === "create" && <p className="actions-performer-label"><strong>Performed by:</strong> {currentUserName} <span className="text-secondary">(set by the server)</span></p>}
        <form className="actions-taken-form mt-3" noValidate onSubmit={submitForm}>
          {formMode !== "assign" && <>
            <div className="actions-form-field"><label className="form-label" htmlFor="action-actionAt">Action Date/Time <span aria-hidden="true" className="text-danger">*</span></label><input aria-required="true" className={`form-control${fieldErrors.actionAt ? " is-invalid" : ""}`} disabled={saving} id="action-actionAt" type="datetime-local" value={form.actionAt} onChange={(event) => updateForm("actionAt", event.target.value)} {...fieldErrorAttributes("action-actionAt", fieldErrors.actionAt)} />{fieldErrors.actionAt && <div className="invalid-feedback" id="action-actionAt-error">{fieldErrors.actionAt}</div>}</div>
            <div className="actions-form-field"><label className="form-label" htmlFor="action-description">Action Description <span aria-hidden="true" className="text-danger">*</span></label><textarea aria-required="true" className={`form-control${fieldErrors.description ? " is-invalid" : ""}`} disabled={saving} id="action-description" maxLength={2_000} rows={3} value={form.description} onChange={(event) => updateForm("description", event.target.value)} {...fieldErrorAttributes("action-description", fieldErrors.description)} />{fieldErrors.description && <div className="invalid-feedback" id="action-description-error">{fieldErrors.description}</div>}</div>
            {formMode === "edit" && <div className="actions-form-field"><label className="form-label" htmlFor="action-result">Result</label><textarea className={`form-control${fieldErrors.result ? " is-invalid" : ""}`} disabled={saving} id="action-result" maxLength={2_000} rows={3} value={form.result} onChange={(event) => updateForm("result", event.target.value)} {...fieldErrorAttributes("action-result", fieldErrors.result)} />{fieldErrors.result && <div className="invalid-feedback" id="action-result-error">{fieldErrors.result}</div>}</div>}
            {formMode === "create" && <div className="actions-form-field"><label className="form-label" htmlFor="action-assignee">Assignee</label><select className="form-select" disabled={saving} id="action-assignee" value={form.assigneeId} onChange={(event) => updateForm("assigneeId", event.target.value)}><AssigneeOptions options={assigneeOptions} selectedValue={form.assigneeId} /></select></div>}
            <div className="actions-form-field actions-form-checkbox"><input checked={form.followUpRequired} className="form-check-input" disabled={saving} id="action-followUpRequired" type="checkbox" onChange={(event) => {
              if (!event.target.checked && form.followUpRequired && form.followUpNote.trim()) { requestFollowUpClear(event.currentTarget); return; }
              updateForm("followUpRequired", event.target.checked);
            }} /><label className="form-check-label" htmlFor="action-followUpRequired">Follow-Up Required</label></div>
            {form.followUpRequired && <div className="actions-form-field actions-form-wide"><label className="form-label" htmlFor="action-followUpNote">Follow-up Note <span aria-hidden="true" className="text-danger">*</span></label><textarea aria-required="true" className={`form-control${fieldErrors.followUpNote ? " is-invalid" : ""}`} disabled={saving} id="action-followUpNote" maxLength={1_000} rows={2} value={form.followUpNote} onChange={(event) => updateForm("followUpNote", event.target.value)} {...fieldErrorAttributes("action-followUpNote", fieldErrors.followUpNote)} />{fieldErrors.followUpNote && <div className="invalid-feedback" id="action-followUpNote-error">{fieldErrors.followUpNote}</div>}</div>}
            <div className="actions-form-field actions-form-wide"><label className="form-label" htmlFor="action-attachmentNotes">Attachment Notes</label><textarea className={`form-control${fieldErrors.attachmentNotes ? " is-invalid" : ""}`} disabled={saving} id="action-attachmentNotes" maxLength={1_000} rows={2} value={form.attachmentNotes} onChange={(event) => updateForm("attachmentNotes", event.target.value)} {...fieldErrorAttributes("action-attachmentNotes", fieldErrors.attachmentNotes)} /><div className="form-text">Describe an existing file to look for. File uploads are handled separately on the Ticket.</div>{fieldErrors.attachmentNotes && <div className="invalid-feedback" id="action-attachmentNotes-error">{fieldErrors.attachmentNotes}</div>}</div>
          </>}
          {formMode === "assign" && currentAction && <div className="actions-form-field actions-form-wide"><label className="form-label" htmlFor="action-assignee">Assignee</label><select className="form-select" disabled={saving} id="action-assignee" value={form.assigneeId} onChange={(event) => updateForm("assigneeId", event.target.value)}><AssigneeOptions options={assigneeOptions} current={currentAction.assignee} selectedValue={form.assigneeId} /></select><div className="form-text">Only active IT Staff and Administrators can be selected.</div></div>}
          <div className="actions-form-actions actions-form-wide"><button className="btn btn-zen-primary" disabled={saving || (formMode === "assign" && currentAction?.status !== "PLANNED" && currentAction?.status !== "IN_PROGRESS")} type="submit">{saving ? "Saving…" : formMode === "create" ? "Create Action" : formMode === "assign" ? "Save assignee" : "Save Action"}</button></div>
        </form>
      </section>}

      {!loading && !listError && list.length > 0 && <ol className="actions-taken-list mt-3">{list.map((action) => {
        const actionStatusOptions = statuses[action.status];
        const canAssign = canWrite && (action.status === "PLANNED" || action.status === "IN_PROGRESS");
        return <li className="actions-taken-item" key={action.id}>
          <article aria-labelledby={`action-heading-${action.id}`}>
            <header className="actions-taken-item-heading"><div><h3 className="h6 mb-1" id={`action-heading-${action.id}`}>{dateLabel(action.actionAt)}</h3><span className={`badge zen-badge zen-status-${action.status.toLowerCase().replaceAll("_", "-")}`}>{enumLabel(action.status)}</span></div><div className="actions-item-controls">
              {canWrite && <button className="btn btn-sm btn-outline-success" disabled={saving} onClick={() => openEdit(action)} type="button">Edit Action</button>}
              {canAssign && <button className="btn btn-sm btn-outline-success" disabled={saving} onClick={() => openAssignment(action)} type="button">{action.assignee ? "Change assignee" : "Assign"}</button>}
              {canWrite && actionStatusOptions.includes("IN_PROGRESS") && <button className="btn btn-sm btn-outline-success" disabled={saving} onClick={() => void startAction(action)} type="button">{saving ? "Saving…" : "Start"}</button>}
              {canWrite && actionStatusOptions.includes("COMPLETED") && <button className="btn btn-sm btn-outline-success" disabled={saving} onClick={(event) => beginTransition(action, "COMPLETED", event.currentTarget)} type="button">Complete</button>}
              {canWrite && actionStatusOptions.includes("CANCELLED") && <button className="btn btn-sm btn-outline-danger" disabled={saving} onClick={(event) => beginTransition(action, "CANCELLED", event.currentTarget)} type="button">Cancel Action</button>}
            </div></header>
            <dl className="actions-taken-fields"><div><dt>Description</dt><dd>{action.description}</dd></div><div><dt>Result</dt><dd>{action.result || "No result recorded."}</dd></div><div><dt>Performed by</dt><dd>{personLabel(action.performedBy)}</dd></div><div><dt>Assignee</dt><dd>{action.assignee?.name ?? "Unassigned"}</dd></div><div><dt>Follow-up</dt><dd>{action.followUpRequired ? `Required — ${action.followUpNote ?? "Note not provided"}` : "Not required"}</dd></div><div><dt>Attachment Notes</dt><dd>{action.attachmentNotes || "None"}</dd></div></dl>
            {!readOnly && Array.isArray(action.events) && <details className="actions-history"><summary>Action history ({action.events.length} {action.events.length === 1 ? "event" : "events"})</summary>{action.events.length === 0 ? <p className="text-secondary mb-0 mt-2">No history is available.</p> : <ol className="actions-history-list">{action.events.map((event) => <li key={event.id}><div className="actions-history-meta"><strong>{event.type.replaceAll("_", " ")}</strong><span>{dateLabel(event.createdAt)}</span></div><p className="mb-1">{personLabel(event.actor)}</p><dl className="actions-history-changes">{eventChanges(event).map((change) => <div key={change.field}><dt>{change.label}</dt><dd>{change.value}</dd></div>)}</dl></li>)}</ol>}</details>}
          </article>
        </li>;
      })}</ol>}
    </div>

    {clearNotePending && <div className="actions-modal-backdrop" onClick={(event) => { if (event.target === event.currentTarget) keepFollowUpNote(); }}>
      <div aria-describedby="clear-followup-description" aria-labelledby="clear-followup-title" aria-modal="true" className="actions-confirmation" onKeyDown={(event) => handleModalKeyDown(event, keepFollowUpNote)} ref={dialogRef} role="alertdialog" tabIndex={-1}>
        <h3 className="h5" id="clear-followup-title">Clear follow-up note?</h3>
        <p id="clear-followup-description">The current note will be removed from this Action. Its earlier value remains in support history.</p>
        <div className="d-flex flex-wrap justify-content-end gap-2"><button autoFocus className="btn btn-outline-secondary" onClick={keepFollowUpNote} type="button">Keep note</button><button className="btn btn-danger" onClick={confirmFollowUpClear} type="button">Clear note</button></div>
      </div>
    </div>}

    {pendingTransition && <div className="actions-modal-backdrop" onClick={(event) => { if (event.target === event.currentTarget) closeTransition(); }}>
      <div aria-describedby="action-transition-description" aria-labelledby="action-transition-title" aria-modal="true" className="actions-confirmation" onKeyDown={(event) => handleModalKeyDown(event, closeTransition)} ref={dialogRef} role="dialog" tabIndex={-1}>
        <h3 className="h5" id="action-transition-title">{pendingTransition.status === "COMPLETED" ? "Complete Action" : "Cancel Action"}</h3>
        <p id="action-transition-description">{pendingTransition.status === "COMPLETED" ? "Confirm the result before marking this Action complete." : "Cancel this Action? This status cannot be changed afterward."}</p>
        {pendingTransition.status === "COMPLETED" && <div className="mb-3"><label className="form-label" htmlFor="action-completion-result">Result <span aria-hidden="true" className="text-danger">*</span></label><textarea aria-describedby={transitionFieldError ? "action-completion-result-error" : undefined} aria-invalid={transitionFieldError ? true : undefined} aria-required="true" autoFocus className={`form-control${transitionFieldError ? " is-invalid" : ""}`} disabled={saving} id="action-completion-result" maxLength={2_000} rows={3} value={completionDrafts[pendingTransition.actionId] ?? ""} onChange={(event) => { setCompletionDrafts((current) => ({ ...current, [pendingTransition.actionId]: event.target.value })); setTransitionFieldError(""); }} />{transitionFieldError && <div className="invalid-feedback" id="action-completion-result-error">{transitionFieldError}</div>}</div>}
        {transitionError && <div className="alert alert-danger" role="alert">{transitionError}</div>}
        <div className="d-flex flex-wrap justify-content-end gap-2"><button className="btn btn-outline-secondary" disabled={saving} onClick={closeTransition} type="button">Cancel</button><button className={`btn ${pendingTransition.status === "CANCELLED" ? "btn-danger" : "btn-zen-primary"}`} disabled={saving} onClick={() => void confirmTransition()} type="button">{saving ? "Saving…" : pendingTransition.status === "COMPLETED" ? "Confirm completion" : "Confirm cancellation"}</button></div>
      </div>
    </div>}
  </section>;
}
