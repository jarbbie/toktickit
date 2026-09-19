import { type FormEvent, useCallback, useEffect, useState } from "react";
import {
  ApiError,
  type AdminUserRecord,
  type UserRole,
  createAdminUser,
  loadAdminUsers,
  resetAdminUserPassword,
  updateAdminUser,
} from "./api.js";

const roles: UserRole[] = ["REQUESTER", "IT_STAFF", "ADMINISTRATOR"];
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type FormMode = "create" | "edit" | "reset" | null;
type FormValues = {
  name: string;
  email: string;
  role: UserRole | "";
  isActive: boolean;
  initialPassword: string;
  confirmPassword: string;
};
type FormField = keyof FormValues | "confirmDeactivation";
type FormErrors = Partial<Record<FormField, string>>;

const emptyForm: FormValues = {
  name: "",
  email: "",
  role: "",
  isActive: true,
  initialPassword: "",
  confirmPassword: "",
};

function roleLabel(role: UserRole) {
  return role === "IT_STAFF" ? "IT Staff" : role === "ADMINISTRATOR" ? "Administrator" : "Requester";
}

function apiFailure(error: unknown, fallback: string) {
  return error instanceof ApiError && error.message ? error.message : fallback;
}

function fieldErrors(error: unknown): FormErrors {
  if (!(error instanceof ApiError) || !error.fieldErrors) return {};
  return error.fieldErrors as FormErrors;
}

function errorAttributes(id: string, message?: string) {
  return message ? { "aria-invalid": true, "aria-describedby": `${id}-error` } : {};
}

function UserActions({ user, currentUserId, onEdit, onReset }: { user: AdminUserRecord; currentUserId: number; onEdit: () => void; onReset: () => void }) {
  return <div className="admin-user-actions"><button className="btn btn-sm btn-outline-success" type="button" onClick={onEdit} aria-label={`Edit ${user.name}`}>Edit</button><button className="btn btn-sm btn-outline-secondary" type="button" onClick={onReset} aria-label={`Reset initial password for ${user.name}`}>Reset password</button>{user.id === currentUserId && <small className="text-secondary">You</small>}</div>;
}

function validatePassword(values: FormValues, errors: FormErrors) {
  if (values.initialPassword.length < 12 || values.initialPassword.length > 128) {
    errors.initialPassword = "Initial password must be between 12 and 128 characters.";
  }
  if (values.initialPassword !== values.confirmPassword) {
    errors.confirmPassword = "Passwords must match.";
  }
}

function UserForm({
  mode,
  values,
  errors,
  busy,
  target,
  currentUserId,
  deactivationConfirmed,
  onChange,
  onDeactivationConfirm,
  onSubmit,
  onCancel,
}: {
  mode: Exclude<FormMode, null>;
  values: FormValues;
  errors: FormErrors;
  busy: boolean;
  target: AdminUserRecord | null;
  currentUserId: number;
  deactivationConfirmed: boolean;
  onChange: <K extends keyof FormValues>(key: K, value: FormValues[K]) => void;
  onDeactivationConfirm: (value: boolean) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onCancel: () => void;
}) {
  const isReset = mode === "reset";
  const isCreate = mode === "create";
  const isDeactivation = mode === "edit" && target?.isActive === true && values.isActive === false;
  const isSelfAdministrator = mode === "edit" && target?.id === currentUserId && target.role === "ADMINISTRATOR";
  const roleChanged = mode === "edit" && target !== null && values.role !== target.role;
  const title = isCreate ? "Create user" : isReset ? "Reset initial password" : "Edit user";

  return <section className="card admin-user-editor" aria-labelledby="admin-user-editor-title">
    <div className="card-body">
      <div className="admin-user-editor-heading">
        <div>
          <h2 className="h5 mb-1" id="admin-user-editor-title">{title}</h2>
          <p className="text-secondary small mb-0">{isReset
            ? `Set a new initial password for ${target?.name ?? "this account"}. Existing sessions are revoked and the user must change it at next sign-in.`
            : isCreate
              ? "New accounts receive the selected role and must change this initial password at first sign-in."
              : "Update account details and activation status. Passwords are never displayed."}</p>
        </div>
        <button className="btn btn-sm btn-outline-secondary" type="button" onClick={onCancel} disabled={busy}>Cancel</button>
      </div>
      <form className="admin-user-form" noValidate onSubmit={onSubmit}>
        {!isReset && <>
          <div>
            <label className="form-label" htmlFor="admin-user-name">Display name <span className="text-danger" aria-hidden="true">*</span></label>
            <input aria-required="true" className={`form-control${errors.name ? " is-invalid" : ""}`} id="admin-user-name" value={values.name} onChange={(event) => onChange("name", event.target.value)} autoComplete="name" {...errorAttributes("admin-user-name", errors.name)} />
            {errors.name && <div className="invalid-feedback" id="admin-user-name-error">{errors.name}</div>}
          </div>
          <div>
            <label className="form-label" htmlFor="admin-user-email">Email <span className="text-danger" aria-hidden="true">*</span></label>
            <input aria-required="true" className={`form-control${errors.email ? " is-invalid" : ""}`} id="admin-user-email" type="email" value={values.email} onChange={(event) => onChange("email", event.target.value)} autoComplete="email" {...errorAttributes("admin-user-email", errors.email)} />
            {errors.email && <div className="invalid-feedback" id="admin-user-email-error">{errors.email}</div>}
          </div>
          <div>
            <label className="form-label" htmlFor="admin-user-role">Role <span className="text-danger" aria-hidden="true">*</span></label>
            <select aria-label="User role" aria-required="true" className={`form-select${errors.role ? " is-invalid" : ""}`} id="admin-user-role" value={values.role} onChange={(event) => onChange("role", event.target.value as UserRole | "")} {...errorAttributes("admin-user-role", errors.role)}>
              {isCreate && <option value="">Choose a role</option>}
              {roles.map((role) => <option key={role} value={role}>{roleLabel(role)}</option>)}
            </select>
            {errors.role && <div className="invalid-feedback" id="admin-user-role-error">{errors.role}</div>}
          </div>
          <div className="admin-user-active-field">
            <label className="form-check-label" htmlFor="admin-user-active">Account active</label>
            <input className="form-check-input" disabled={isSelfAdministrator} id="admin-user-active" type="checkbox" checked={values.isActive} onChange={(event) => onChange("isActive", event.target.checked)} />
            {errors.isActive && <div className="invalid-feedback d-block">{errors.isActive}</div>}
          </div>
          {isSelfAdministrator && <p className="admin-user-self-note text-secondary small">Your active Administrator account cannot be deactivated here.</p>}
          {roleChanged && <p className="admin-user-warning">Changing this role revokes the account’s existing sessions.</p>}
          {isDeactivation && <label className="admin-user-warning form-check">
            <input className="form-check-input" type="checkbox" checked={deactivationConfirmed} onChange={(event) => onDeactivationConfirm(event.target.checked)} />
            <span>I understand this deactivates the account and may revoke its sessions.</span>
          </label>}
        </>}
        <div>
          <label className="form-label" htmlFor="admin-user-password">{isReset ? "New initial password" : "Initial password"}{!isCreate && !isReset && <span className="text-secondary"> (leave unchanged)</span>}</label>
          {!isCreate && !isReset ? <p className="form-control-plaintext text-secondary small mb-0">Use “Reset password” from the user list to set a new initial password.</p> : <>
            <input aria-required="true" className={`form-control${errors.initialPassword ? " is-invalid" : ""}`} id="admin-user-password" type="password" value={values.initialPassword} onChange={(event) => onChange("initialPassword", event.target.value)} autoComplete="new-password" {...errorAttributes("admin-user-password", errors.initialPassword)} />
            {errors.initialPassword && <div className="invalid-feedback" id="admin-user-password-error">{errors.initialPassword}</div>}
            <label className="form-label mt-3" htmlFor="admin-user-password-confirm">Confirm password</label>
            <input className={`form-control${errors.confirmPassword ? " is-invalid" : ""}`} id="admin-user-password-confirm" type="password" value={values.confirmPassword} onChange={(event) => onChange("confirmPassword", event.target.value)} autoComplete="new-password" {...errorAttributes("admin-user-password-confirm", errors.confirmPassword)} />
            {errors.confirmPassword && <div className="invalid-feedback" id="admin-user-password-confirm-error">{errors.confirmPassword}</div>}
          </>}
        </div>
        <div className="admin-user-form-actions">
          <button className="btn btn-zen-primary" type="submit" disabled={busy || (isDeactivation && !deactivationConfirmed)}>{busy ? "Saving…" : isCreate ? "Create user" : isReset ? "Set initial password" : "Save changes"}</button>
          {isReset && <span className="text-secondary small">Password fields are cleared after a successful reset.</span>}
        </div>
      </form>
    </div>
  </section>;
}

export default function UserManagement({ currentUserId, onSelfReset }: { currentUserId: number; onSelfReset?: () => void }) {
  const [users, setUsers] = useState<AdminUserRecord[] | null>(null);
  const [search, setSearch] = useState("");
  const [role, setRole] = useState<UserRole | "">("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [retry, setRetry] = useState(0);
  const [mode, setMode] = useState<FormMode>(null);
  const [target, setTarget] = useState<AdminUserRecord | null>(null);
  const [values, setValues] = useState<FormValues>(emptyForm);
  const [errors, setErrors] = useState<FormErrors>({});
  const [deactivationConfirmed, setDeactivationConfirmed] = useState(false);
  const [operationError, setOperationError] = useState("");
  const [success, setSuccess] = useState("");
  const [busy, setBusy] = useState(false);

  const refreshUsers = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      setUsers(await loadAdminUsers(search, role));
    } catch (error) {
      setLoadError(apiFailure(error, "Unable to load users."));
    } finally {
      setLoading(false);
    }
  }, [role, search]);

  useEffect(() => { void refreshUsers(); }, [refreshUsers, retry]);

  function updateValue<K extends keyof FormValues>(key: K, value: FormValues[K]) {
    setValues((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined, ...(key === "initialPassword" || key === "confirmPassword" ? { confirmPassword: undefined } : {}) }));
  }

  function openCreate() {
    setMode("create"); setTarget(null); setValues(emptyForm); setErrors({}); setDeactivationConfirmed(false); setOperationError(""); setSuccess("");
  }

  function openEdit(user: AdminUserRecord) {
    setMode("edit"); setTarget(user); setValues({ ...emptyForm, name: user.name, email: user.email, role: user.role, isActive: user.isActive }); setErrors({}); setDeactivationConfirmed(false); setOperationError(""); setSuccess("");
  }

  function openReset(user: AdminUserRecord) {
    setMode("reset"); setTarget(user); setValues(emptyForm); setErrors({}); setDeactivationConfirmed(false); setOperationError(""); setSuccess("");
  }

  function closeForm() {
    if (busy) return;
    setMode(null); setTarget(null); setValues(emptyForm); setErrors({}); setDeactivationConfirmed(false); setOperationError("");
  }

  function validate() {
    const next: FormErrors = {};
    if (mode !== "reset") {
      const name = values.name.trim();
      if (name.length < 1 || name.length > 100) next.name = "Display name must be between 1 and 100 characters.";
      const email = values.email.trim();
      if (!emailPattern.test(email)) next.email = "Enter a valid email address.";
      if (!roles.includes(values.role as UserRole)) next.role = "Choose a valid role.";
      if (mode === "edit" && target?.isActive && !values.isActive && !deactivationConfirmed) next.confirmDeactivation = "Confirm account deactivation to continue.";
    }
    if (mode === "create" || mode === "reset") validatePassword(values, next);
    return next;
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!mode || busy) return;
    const nextErrors = validate();
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    setBusy(true); setOperationError(""); setSuccess("");
    try {
      if (mode === "create") {
        await createAdminUser({ name: values.name.trim(), email: values.email.trim(), role: values.role as UserRole, isActive: values.isActive, initialPassword: values.initialPassword });
        setSuccess("User created. The initial password is not shown again.");
      } else if (mode === "edit" && target) {
        await updateAdminUser(target.id, { name: values.name.trim(), email: values.email.trim(), role: values.role as UserRole, isActive: values.isActive });
        setSuccess("User changes saved.");
      } else if (mode === "reset" && target) {
        await resetAdminUserPassword(target.id, values.initialPassword);
        if (target.id === currentUserId) {
          onSelfReset?.();
          return;
        }
        setSuccess("Initial password reset. The user must change it at next sign-in.");
      }
      setValues(emptyForm); setErrors({}); setDeactivationConfirmed(false); setMode(null); setTarget(null);
      await refreshUsers();
    } catch (error) {
      setOperationError(apiFailure(error, mode === "create" ? "Unable to create user." : mode === "reset" ? "Unable to reset the initial password." : "Unable to save user changes."));
      setErrors(fieldErrors(error));
    } finally {
      setBusy(false);
    }
  }

  return <section className="admin-users-page" aria-labelledby="admin-users-title">
    <header className="admin-users-heading">
      <div><h1 className="h3 mb-1" id="admin-users-title">User Management</h1><p className="text-secondary mb-0">Manage requester, IT Staff, and Administrator accounts.</p></div>
      <button className="btn btn-zen-primary" type="button" onClick={openCreate}>+ Create user</button>
    </header>
    {success && <div className="alert alert-success" role="status">{success}</div>}
    {operationError && <div className="alert alert-danger" role="alert">{operationError}</div>}
    <section className="card admin-users-filter-card" aria-label="User filters"><div className="card-body admin-users-filter-grid">
      <div className="admin-users-search"><label className="form-label" htmlFor="admin-user-search">Search users</label><input className="form-control" id="admin-user-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Name or email" /></div>
      <div><label className="form-label" htmlFor="admin-user-role-filter">Role</label><select className="form-select" id="admin-user-role-filter" aria-label="Filter by role" value={role} onChange={(event) => setRole(event.target.value as UserRole | "")}><option value="">All roles</option>{roles.map((item) => <option key={item} value={item}>{roleLabel(item)}</option>)}</select></div>
      <button className="btn btn-outline-success admin-users-clear" type="button" onClick={() => { setSearch(""); setRole(""); }}>Clear filters</button>
    </div></section>
    {loading && <p role="status">{users ? "Updating users…" : "Loading users…"}</p>}
    {loadError && <div className="alert alert-danger" role="alert">{loadError} <button className="btn btn-sm btn-danger ms-2" type="button" onClick={() => setRetry((value) => value + 1)}>Retry</button></div>}
    {users && users.length === 0 && !loading && <div className="alert alert-info" role="status">No users match these filters.</div>}
    {users && users.length > 0 && <div className="card admin-users-table-card">
      <div className="table-responsive admin-users-table-wrap"><table className="table align-middle mb-0 admin-users-table"><caption className="visually-hidden">Administrator-managed user accounts</caption><thead><tr><th>Display name</th><th>Email</th><th>Role</th><th>Status</th><th className="text-end">Actions</th></tr></thead><tbody>{users.map((user) => <tr key={user.id}><td><strong>{user.name}</strong>{user.mustChangePassword && <small className="d-block text-secondary">Initial password change required</small>}</td><td>{user.email}</td><td><span className="badge zen-role-table-badge">{roleLabel(user.role)}</span></td><td><span className={`badge zen-account-status ${user.isActive ? "active" : "inactive"}`}>{user.isActive ? "Active" : "Inactive"}</span></td><td><UserActions user={user} currentUserId={currentUserId} onEdit={() => openEdit(user)} onReset={() => openReset(user)} /></td></tr>)}</tbody></table></div>
      <div className="admin-users-mobile-list" aria-label="User accounts on mobile">{users.map((user) => <article className="admin-user-mobile-card" key={user.id}><div className="admin-user-mobile-heading"><strong>{user.name}</strong><span className={`badge zen-account-status ${user.isActive ? "active" : "inactive"}`}>{user.isActive ? "Active" : "Inactive"}</span></div><dl className="admin-user-mobile-details"><dt>Email</dt><dd>{user.email}</dd><dt>Role</dt><dd><span className="badge zen-role-table-badge">{roleLabel(user.role)}</span></dd></dl>{user.mustChangePassword && <small className="d-block text-secondary mb-2">Initial password change required</small>}<UserActions user={user} currentUserId={currentUserId} onEdit={() => openEdit(user)} onReset={() => openReset(user)} /></article>)}</div>
    </div>}
    {mode && <UserForm mode={mode} values={values} errors={errors} busy={busy} target={target} currentUserId={currentUserId} deactivationConfirmed={deactivationConfirmed} onChange={updateValue} onDeactivationConfirm={setDeactivationConfirmed} onSubmit={submit} onCancel={closeForm} />}
  </section>;
}
