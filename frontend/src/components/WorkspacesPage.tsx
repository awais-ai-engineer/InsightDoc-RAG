"use client";

/* eslint-disable react-hooks/set-state-in-effect */
import Link from "next/link";
import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { api, Workspace } from "@/lib/api";
import { useAuth } from "./AuthProvider";
import { UiIcon } from "./UiIcon";

type WorkspaceList = { items: Workspace[]; total: number };

async function loadWorkspaces(token: string): Promise<Workspace[]> {
  const first = await api<WorkspaceList>("/workspaces?limit=100", {}, token);
  const offsets = Array.from(
    { length: Math.max(0, Math.ceil(first.total / 100) - 1) },
    (_, index) => (index + 1) * 100,
  );
  const rest = await Promise.all(
    offsets.map((offset) =>
      api<WorkspaceList>(`/workspaces?limit=100&offset=${offset}`, {}, token),
    ),
  );
  return [first, ...rest].flatMap((page) => page.items);
}

export function WorkspacesPage() {
  const { token } = useAuth();
  const createDialog = useRef<HTMLDialogElement>(null);
  const deleteDialog = useRef<HTMLDialogElement>(null);
  const [items, setItems] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const [createBusy, setCreateBusy] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [createError, setCreateError] = useState("");
  const [deleting, setDeleting] = useState<Workspace | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setLoadError("");
    try {
      setItems(await loadWorkspaces(token));
    } catch (cause) {
      setLoadError(
        cause instanceof Error
          ? cause.message
          : "Workspaces are unavailable right now.",
      );
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);
  useEffect(() => {
    const dialog = createDialog.current;
    if (creating && dialog && !dialog.open) dialog.showModal();
    return () => {
      if (dialog?.open) dialog.close();
    };
  }, [creating]);
  useEffect(() => {
    const dialog = deleteDialog.current;
    if (deleting && dialog && !dialog.open) dialog.showModal();
    return () => {
      if (dialog?.open) dialog.close();
    };
  }, [deleting]);

  function openCreate() {
    setName("");
    setDescription("");
    setCreateError("");
    setCreating(true);
  }

  async function create(event: FormEvent) {
    event.preventDefault();
    if (!token || createBusy) return;
    const cleanName = name.trim();
    if (!cleanName) {
      setCreateError("Enter a workspace name.");
      return;
    }
    setCreateBusy(true);
    setCreateError("");
    try {
      await api(
        "/workspaces",
        {
          method: "POST",
          body: JSON.stringify({
            name: cleanName,
            description: description.trim() || null,
          }),
        },
        token,
      );
      await load();
      setCreating(false);
    } catch (cause) {
      setCreateError(
        cause instanceof Error
          ? cause.message
          : "Workspace could not be created.",
      );
    } finally {
      setCreateBusy(false);
    }
  }

  async function remove() {
    if (!token || !deleting || deleteBusy) return;
    setDeleteBusy(true);
    setDeleteError("");
    try {
      await api(`/workspaces/${deleting.id}`, { method: "DELETE" }, token);
      await load();
      setDeleting(null);
    } catch (cause) {
      setDeleteError(
        cause instanceof Error
          ? cause.message
          : "Workspace could not be deleted.",
      );
    } finally {
      setDeleteBusy(false);
    }
  }

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return query
      ? items.filter((workspace) =>
          `${workspace.name} ${workspace.description ?? ""}`
            .toLowerCase()
            .includes(query),
        )
      : items;
  }, [items, search]);

  return (
    <div className="workspaces-page">
      <header className="workspaces-header">
        <div>
          <span className="eyebrow">ORGANIZE YOUR KNOWLEDGE</span>
          <h1>Workspaces</h1>
          <p>
            Organize documents and conversations into focused knowledge spaces.
          </p>
        </div>
        <button
          className="workspaces-create-button shine-link"
          type="button"
          onClick={openCreate}
        >
          <UiIcon name="plus" /> Create Workspace <UiIcon name="arrow" />
        </button>
      </header>
      <div className="workspaces-intro">
        <span>
          <UiIcon name="workspace" />
        </span>
        <div>
          <b>A place for every project</b>
          <p>
            Group related documents in workspaces, then manage their assignments
            from My Documents.
          </p>
        </div>
        <Link href="/documents">
          Manage documents <UiIcon name="arrow" />
        </Link>
      </div>
      <section className="workspaces-library" aria-label="Your workspaces">
        <div className="workspaces-library-head">
          <div>
            <span className="eyebrow">YOUR SPACES</span>
            <h2>
              All workspaces <span>{loading ? "" : items.length}</span>
            </h2>
          </div>
          <label className="workspaces-search">
            <UiIcon name="search" />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search workspaces"
              aria-label="Search workspaces"
            />
          </label>
        </div>
        {loading ? (
          <div className="workspaces-state">Loading your workspaces…</div>
        ) : loadError ? (
          <div className="workspaces-state workspaces-unavailable">
            <span>
              <UiIcon name="workspace" />
            </span>
            <h3>Workspaces are unavailable</h3>
            <p>{loadError}</p>
            <button type="button" onClick={load}>
              Try again
            </button>
          </div>
        ) : items.length === 0 ? (
          <div className="workspaces-state workspaces-empty">
            <span>
              <UiIcon name="workspace" />
            </span>
            <h3>No workspaces yet</h3>
            <p>
              Create a workspace to organize related documents and
              conversations.
            </p>
            <button type="button" onClick={openCreate}>
              Create Workspace <UiIcon name="arrow" />
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="workspaces-state workspaces-no-match">
            <span>
              <UiIcon name="search" />
            </span>
            <h3>No matching workspaces</h3>
            <p>Try another name or description.</p>
            <button type="button" onClick={() => setSearch("")}>
              Clear search
            </button>
          </div>
        ) : (
          <>
            <p className="workspaces-result-count">
              {search.trim()
                ? `${filtered.length} of ${items.length} workspaces`
                : `${items.length} workspace${items.length === 1 ? "" : "s"}`}
            </p>
            <div className="workspaces-grid">
              {filtered.map((workspace, index) => (
                <article
                  className={`workspaces-card workspaces-tone-${index % 3}`}
                  key={workspace.id}
                >
                  <div className="workspaces-card-top">
                    <span className="workspaces-card-icon">
                      <UiIcon name="workspace" />
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setDeleteError("");
                        setDeleting(workspace);
                      }}
                      aria-label={`Delete ${workspace.name}`}
                      title="Delete workspace"
                    >
                      <UiIcon name="trash" />
                    </button>
                  </div>
                  <h3 title={workspace.name}>{workspace.name}</h3>
                  <p className="workspaces-card-description">
                    {workspace.description || "No description added."}
                  </p>
                  <div className="workspaces-card-meta">
                    <span>
                      <UiIcon name="document" /> {workspace.document_count}{" "}
                      document{workspace.document_count === 1 ? "" : "s"}
                    </span>
                    <span>
                      Created{" "}
                      {new Date(workspace.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <Link href="/documents">
                    Manage documents <UiIcon name="arrow" />
                  </Link>
                </article>
              ))}
            </div>
          </>
        )}
      </section>

      {creating && (
        <dialog
          ref={createDialog}
          className="workspaces-dialog"
          aria-labelledby="workspace-create-title"
          onClose={() => setCreating(false)}
          onCancel={(event) => {
            if (createBusy) event.preventDefault();
          }}
        >
          <form onSubmit={create}>
            <div className="workspaces-dialog-heading">
              <span>
                <UiIcon name="workspace" />
              </span>
              <button
                type="button"
                onClick={() => setCreating(false)}
                disabled={createBusy}
                aria-label="Close dialog"
              >
                <UiIcon name="close" />
              </button>
            </div>
            <h2 id="workspace-create-title">Create a workspace</h2>
            <p>
              Give related documents a place to live. You can assign documents
              from My Documents.
            </p>
            <label>
              Workspace name
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                maxLength={120}
                required
                placeholder="e.g. Research project"
              />
            </label>
            <label>
              Description <small>Optional</small>
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                maxLength={2000}
                rows={3}
                placeholder="What belongs in this workspace?"
              />
            </label>
            {createError && (
              <div className="workspaces-dialog-error" role="alert">
                {createError}
              </div>
            )}
            <div className="workspaces-dialog-actions">
              <button
                type="button"
                onClick={() => setCreating(false)}
                disabled={createBusy}
              >
                Cancel
              </button>
              <button
                className="workspaces-submit shine-link"
                type="submit"
                disabled={createBusy}
              >
                {createBusy ? "Creating…" : "Create Workspace"}
              </button>
            </div>
          </form>
        </dialog>
      )}
      {deleting && (
        <dialog
          ref={deleteDialog}
          className="workspaces-dialog workspaces-delete-dialog"
          aria-labelledby="workspace-delete-title"
          onClose={() => setDeleting(null)}
          onCancel={(event) => {
            if (deleteBusy) event.preventDefault();
          }}
        >
          <div className="workspaces-dialog-heading">
            <span>
              <UiIcon name="trash" />
            </span>
            <button
              type="button"
              onClick={() => setDeleting(null)}
              disabled={deleteBusy}
              aria-label="Close dialog"
            >
              <UiIcon name="close" />
            </button>
          </div>
          <h2 id="workspace-delete-title">Delete workspace?</h2>
          <p>
            <strong>{deleting.name}</strong> will be removed. Its documents
            remain safely in your library and become unassigned.
          </p>
          {deleteError && (
            <div className="workspaces-dialog-error" role="alert">
              {deleteError}
            </div>
          )}
          <div className="workspaces-dialog-actions">
            <button
              type="button"
              onClick={() => setDeleting(null)}
              disabled={deleteBusy}
            >
              Cancel
            </button>
            <button
              className="workspaces-delete-confirm"
              type="button"
              onClick={remove}
              disabled={deleteBusy}
            >
              {deleteBusy ? "Deleting…" : "Delete Workspace"}
            </button>
          </div>
        </dialog>
      )}
    </div>
  );
}
