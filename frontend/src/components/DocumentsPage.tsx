"use client";

/* eslint-disable react-hooks/exhaustive-deps, react-hooks/set-state-in-effect */
import Link from "next/link";
import {
  ChangeEvent,
  DragEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { api, ApiError, Document, Workspace } from "@/lib/api";
import { useAuth } from "./AuthProvider";
import { UiIcon } from "./UiIcon";

type ListResponse<T> = { items: T[]; total: number };

async function loadAll<T>(path: string, token: string): Promise<T[]> {
  const first = await api<ListResponse<T>>(
    `${path}${path.includes("?") ? "&" : "?"}limit=100`,
    {},
    token,
  );
  const offsets = Array.from(
    { length: Math.max(0, Math.ceil(first.total / 100) - 1) },
    (_, index) => (index + 1) * 100,
  );
  const rest = await Promise.all(
    offsets.map((offset) =>
      api<ListResponse<T>>(
        `${path}${path.includes("?") ? "&" : "?"}limit=100&offset=${offset}`,
        {},
        token,
      ),
    ),
  );
  return [first, ...rest].flatMap((page) => page.items);
}

function fileType(document: Document): string {
  const extension = document.filename.split(".").pop()?.toUpperCase();
  return extension === "PDF" || extension === "TXT" || extension === "DOCX"
    ? extension
    : "FILE";
}

function fileSize(bytes: number | null): string | null {
  if (bytes == null) return null;
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

export function DocumentsPage({ favorites = false }: { favorites?: boolean }) {
  return favorites ? <FavoritesPage /> : <MyDocumentsPage />;
}

function MyDocumentsPage() {
  const { token } = useAuth();
  const [docs, setDocs] = useState<Document[]>([]);
  const [spaces, setSpaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [uploadLabel, setUploadLabel] = useState("");
  const [dragging, setDragging] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [actionError, setActionError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setLoadError("");
    try {
      const [documents, workspaces] = await Promise.all([
        loadAll<Document>("/documents", token),
        loadAll<Workspace>("/workspaces", token),
      ]);
      setDocs(documents);
      setSpaces(workspaces);
    } catch (cause) {
      setLoadError(
        cause instanceof Error
          ? cause.message
          : "Documents are unavailable right now.",
      );
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  async function uploadFiles(files: File[]) {
    if (!token || !files.length || busy) return;
    setBusy(true);
    setActionError("");
    const failures: string[] = [];
    for (const [index, file] of files.entries()) {
      setUploadLabel(`Processing ${index + 1} of ${files.length}…`);
      const body = new FormData();
      body.append("file", file);
      try {
        await api("/documents/upload", { method: "POST", body }, token);
      } catch (cause) {
        failures.push(
          `${file.name}: ${cause instanceof ApiError ? cause.message : "Upload failed"}`,
        );
      }
    }
    await load();
    if (failures.length) setActionError(failures.join(" "));
    setBusy(false);
    setUploadLabel("");
  }

  function onFilesChosen(event: ChangeEvent<HTMLInputElement>) {
    void uploadFiles(Array.from(event.target.files ?? []));
    event.target.value = "";
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    void uploadFiles(Array.from(event.dataTransfer.files));
  }

  async function remove(document: Document) {
    if (
      !token ||
      !confirm(`Delete ${document.filename} and its indexed content?`)
    )
      return;
    setActionError("");
    try {
      await api(`/documents/${document.id}`, { method: "DELETE" }, token);
      await load();
    } catch (cause) {
      setActionError(
        cause instanceof Error
          ? cause.message
          : "Document could not be deleted.",
      );
    }
  }

  async function move(document: Document, workspaceId: string) {
    if (!token) return;
    setActionError("");
    try {
      await api(
        `/documents/${document.id}/workspace`,
        {
          method: "PATCH",
          body: JSON.stringify({ workspace_id: workspaceId || null }),
        },
        token,
      );
      await load();
    } catch (cause) {
      setActionError(
        cause instanceof Error
          ? cause.message
          : "Workspace could not be changed.",
      );
    }
  }

  async function favorite(document: Document) {
    if (!token) return;
    setActionError("");
    try {
      await api(
        `/documents/${document.id}/favorite`,
        {
          method: "PATCH",
          body: JSON.stringify({ is_favorite: !document.is_favorite }),
        },
        token,
      );
      await load();
    } catch (cause) {
      setActionError(
        cause instanceof Error
          ? cause.message
          : "Favorite could not be changed.",
      );
    }
  }

  const filtered = useMemo(
    () =>
      docs.filter(
        (document) =>
          document.filename
            .toLowerCase()
            .includes(search.trim().toLowerCase()) &&
          (statusFilter === "all" || document.status === statusFilter) &&
          (typeFilter === "all" || fileType(document) === typeFilter),
      ),
    [docs, search, statusFilter, typeFilter],
  );
  const filtersActive = Boolean(
    search.trim() || statusFilter !== "all" || typeFilter !== "all",
  );

  return (
    <div className="documents-page">
      <header className="documents-header">
        <div>
          <span className="eyebrow">KNOWLEDGE BASE</span>
          <h1>My Documents</h1>
          <p>
            Upload, organize, and manage the documents powering your insights.
          </p>
        </div>
        <label
          className={`documents-upload-button shine-link${busy ? " is-busy" : ""}`}
          htmlFor="document-upload"
        >
          <UiIcon name="upload" />
          {busy ? uploadLabel : "Upload Document"}
          <UiIcon name="arrow" />
        </label>
      </header>
      <input
        id="document-upload"
        className="documents-file-input"
        type="file"
        accept=".pdf,.txt,.docx"
        multiple
        onChange={onFilesChosen}
        disabled={busy}
      />
      <div
        className={`documents-dropzone${dragging ? " is-dragging" : ""}`}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
      >
        <span className="documents-drop-icon">
          <UiIcon name="upload" />
        </span>
        <div>
          <b>
            Drop files here or <label htmlFor="document-upload">browse</label>
          </b>
          <p>
            PDF, TXT, and DOCX files · Up to 50 MB per file · Automatically
            processed
          </p>
        </div>
      </div>
      {actionError && (
        <div className="documents-alert" role="alert">
          <UiIcon name="close" />
          <span>{actionError}</span>
          <button
            type="button"
            onClick={() => setActionError("")}
            aria-label="Dismiss error"
          >
            <UiIcon name="close" />
          </button>
        </div>
      )}
      <section className="documents-library" aria-label="Document library">
        <div className="documents-library-head">
          <div>
            <span className="eyebrow">YOUR LIBRARY</span>
            <h2>
              All documents <span>{loading ? "" : docs.length}</span>
            </h2>
          </div>
          <p>Search and manage your knowledge in one place.</p>
        </div>
        <div className="documents-controls">
          <label className="documents-search">
            <UiIcon name="search" />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search documents"
              aria-label="Search documents by filename"
            />
          </label>
          <label className="documents-filter">
            <span>Status</span>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              aria-label="Filter by status"
            >
              <option value="all">All statuses</option>
              <option value="ready">Ready</option>
              <option value="processing">Processing</option>
              <option value="pending">Pending</option>
              <option value="uploaded">Uploaded</option>
              <option value="failed">Failed</option>
            </select>
          </label>
          <label className="documents-filter">
            <span>Type</span>
            <select
              value={typeFilter}
              onChange={(event) => setTypeFilter(event.target.value)}
              aria-label="Filter by file type"
            >
              <option value="all">All types</option>
              <option value="PDF">PDF</option>
              <option value="TXT">TXT</option>
              <option value="DOCX">DOCX</option>
            </select>
          </label>
        </div>
        {loading ? (
          <div className="documents-state">Loading your documents…</div>
        ) : loadError ? (
          <div className="documents-state documents-unavailable">
            <span>
              <UiIcon name="document" />
            </span>
            <h3>Documents are unavailable</h3>
            <p>{loadError}</p>
            <button type="button" onClick={load}>
              Try again
            </button>
          </div>
        ) : docs.length === 0 ? (
          <div className="documents-state documents-empty">
            <span>
              <UiIcon name="document" />
            </span>
            <h3>No documents yet</h3>
            <p>
              Upload your first document to start asking grounded questions.
            </p>
            <label htmlFor="document-upload">
              Upload Document <UiIcon name="arrow" />
            </label>
          </div>
        ) : filtered.length === 0 ? (
          <div className="documents-state documents-no-match">
            <span>
              <UiIcon name="search" />
            </span>
            <h3>No matching documents</h3>
            <p>Try a different filename, status, or file type.</p>
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setStatusFilter("all");
                setTypeFilter("all");
              }}
            >
              Clear filters
            </button>
          </div>
        ) : (
          <>
            <p className="documents-result-count">
              {filtersActive
                ? `${filtered.length} of ${docs.length} documents`
                : `${docs.length} document${docs.length === 1 ? "" : "s"}`}
            </p>
            <div className="documents-grid">
              {filtered.map((document) => (
                <DocumentCard
                  key={document.id}
                  document={document}
                  spaces={spaces}
                  onMove={move}
                  onFavorite={favorite}
                  onRemove={remove}
                />
              ))}
            </div>
          </>
        )}
      </section>
    </div>
  );
}

function DocumentCard({
  document,
  spaces,
  onMove,
  onFavorite,
  onRemove,
}: {
  document: Document;
  spaces: Workspace[];
  onMove: (document: Document, workspaceId: string) => void;
  onFavorite: (document: Document) => void;
  onRemove: (document: Document) => void;
}) {
  const kind = fileType(document);
  const size = fileSize(document.size_bytes);
  return (
    <article className={`documents-card documents-type-${kind.toLowerCase()}`}>
      <div className="documents-card-top">
        <span className="documents-card-icon">
          <UiIcon name="document" />
          <small>{kind}</small>
        </span>
        <span
          className={`documents-status documents-status-${document.status.toLowerCase()}`}
        >
          {document.status.replace(/_/g, " ")}
        </span>
      </div>
      <h3 title={document.filename}>{document.filename}</h3>
      <p className="documents-card-meta">
        {size && <span>{size}</span>}
        {size && <i />}
        <span>{new Date(document.created_at).toLocaleDateString()}</span>
      </p>
      <label className="documents-workspace">
        <UiIcon name="workspace" />
        <select
          aria-label={`Workspace for ${document.filename}`}
          value={document.workspace_id ?? ""}
          onChange={(event) => onMove(document, event.target.value)}
        >
          <option value="">No workspace</option>
          {spaces.map((space) => (
            <option key={space.id} value={space.id}>
              {space.name}
            </option>
          ))}
        </select>
      </label>
      <div className="documents-card-actions">
        <Link
          href={`/chat?document=${document.id}`}
          title={`Chat with ${document.filename}`}
        >
          <UiIcon name="chat" /> Chat
        </Link>
        <button
          type="button"
          onClick={() => onFavorite(document)}
          aria-label={`${document.is_favorite ? "Remove" : "Add"} ${document.filename} ${document.is_favorite ? "from" : "to"} favorites`}
          aria-pressed={document.is_favorite}
          title={document.is_favorite ? "Remove favorite" : "Add favorite"}
        >
          <UiIcon name="favorite" />
        </button>
        <button
          className="documents-delete"
          type="button"
          onClick={() => onRemove(document)}
          aria-label={`Delete ${document.filename}`}
          title="Delete document"
        >
          <UiIcon name="trash" />
        </button>
      </div>
    </article>
  );
}

function FavoritesPage() {
  const { token } = useAuth();
  const [docs, setDocs] = useState<Document[]>([]);
  const [spaces, setSpaces] = useState<Workspace[]>([]);
  const [error, setError] = useState("");
  const load = () =>
    token &&
    Promise.all([
      api<{ items: Document[] }>("/documents?favorite=true", {}, token),
      api<{ items: Workspace[] }>("/workspaces?limit=100", {}, token),
    ])
      .then(([documents, workspaces]) => {
        setDocs(documents.items);
        setSpaces(workspaces.items);
      })
      .catch((cause) => setError(cause.message));
  useEffect(() => {
    load();
  }, [token]);
  async function remove(id: string) {
    if (token && confirm("Delete this document and its indexed content?")) {
      await api(`/documents/${id}`, { method: "DELETE" }, token);
      load();
    }
  }
  async function move(id: string, workspaceId: string) {
    if (token) {
      await api(
        `/documents/${id}/workspace`,
        {
          method: "PATCH",
          body: JSON.stringify({ workspace_id: workspaceId || null }),
        },
        token,
      );
      load();
    }
  }
  async function favorite(document: Document) {
    if (token) {
      await api(
        `/documents/${document.id}/favorite`,
        {
          method: "PATCH",
          body: JSON.stringify({ is_favorite: !document.is_favorite }),
        },
        token,
      );
      load();
    }
  }
  return (
    <>
      <header className="page-head">
        <div>
          <span className="eyebrow">KNOWLEDGE BASE</span>
          <h1>Favorite documents</h1>
          <p>Your saved documents in one place.</p>
        </div>
      </header>
      {error && <div className="form-error">{error}</div>}
      <div className="panel table-panel">
        <div className="panel-head">
          <h2>
            {docs.length} document{docs.length !== 1 && "s"}
          </h2>
        </div>
        {docs.length ? (
          docs.map((document) => (
            <div className="document-row" key={document.id}>
              <span className="file-icon">
                {document.filename.endsWith(".pdf") ? "PDF" : "TXT"}
              </span>
              <div>
                <b>{document.filename}</b>
                <small>
                  {document.size_bytes
                    ? `${(document.size_bytes / 1024).toFixed(1)} KB`
                    : "—"}{" "}
                  · {new Date(document.created_at).toLocaleDateString()}
                </small>
              </div>
              <span className={`status ${document.status}`}>
                {document.status}
              </span>
              <select
                aria-label="Workspace"
                value={document.workspace_id ?? ""}
                onChange={(event) => move(document.id, event.target.value)}
              >
                <option value="">No workspace</option>
                {spaces.map((space) => (
                  <option value={space.id} key={space.id}>
                    {space.name}
                  </option>
                ))}
              </select>
              <button
                className="icon-btn"
                onClick={() => favorite(document)}
                aria-label="Toggle favorite"
              >
                {document.is_favorite ? "★" : "☆"}
              </button>
              <Link className="icon-btn" href={`/chat?document=${document.id}`}>
                ✦
              </Link>
              <button
                className="icon-btn danger"
                onClick={() => remove(document.id)}
              >
                ×
              </button>
            </div>
          ))
        ) : (
          <div className="empty large">No documents here yet.</div>
        )}
      </div>
    </>
  );
}
