"use client";

/* eslint-disable react-hooks/exhaustive-deps, react-hooks/set-state-in-effect */
import Link from "next/link";
import { FormEvent, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { api, ApiError, Chat, Citation, Document, Message } from "@/lib/api";
import { useAuth } from "./AuthProvider";
import { IconName, UiIcon } from "./UiIcon";

const suggestions: { text: string; icon: IconName; tone: string }[] = [
  { text: "Summarize this document", icon: "document", tone: "blue" },
  { text: "What are the key findings?", icon: "spark", tone: "violet" },
  { text: "Extract important dates", icon: "history", tone: "cyan" },
  { text: "What is the main argument?", icon: "chat", tone: "pink" },
];

export function ChatPage() {
  const { token } = useAuth();
  const params = useSearchParams();
  const textarea = useRef<HTMLTextAreaElement>(null);
  const [chats, setChats] = useState<Chat[]>([]);
  const [active, setActive] = useState<Chat | null>(null);
  const [docs, setDocs] = useState<Document[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [selectorOpen, setSelectorOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{
    provider: boolean;
    message: string;
  } | null>(null);

  const load = () =>
    token &&
    Promise.all([
      api<{ items: Chat[] }>("/chats?limit=100", {}, token),
      api<{ items: Document[] }>("/documents?limit=100", {}, token),
    ])
      .then(([conversations, documents]) => {
        setChats(conversations.items);
        setDocs(documents.items.filter((item) => item.status === "ready"));
      })
      .catch(() =>
        setError({
          provider: false,
          message: "Conversations or documents could not be loaded.",
        }),
      );

  useEffect(() => {
    const documentId = params.get("document");
    if (documentId) setSelected([documentId]);
    const chatId = params.get("chat");
    if (chatId && token)
      api<Chat>(`/chats/${chatId}`, {}, token)
        .then(setActive)
        .catch(() =>
          setError({
            provider: false,
            message: "Conversation could not be opened.",
          }),
        );
  }, [params, token]);
  useEffect(() => {
    load();
  }, [token]);

  async function open(id: string) {
    if (!token) return;
    try {
      setActive(await api<Chat>(`/chats/${id}`, {}, token));
      setError(null);
    } catch {
      setError({
        provider: false,
        message: "Conversation could not be opened.",
      });
    }
  }

  async function fresh() {
    if (!token) return;
    try {
      const chat = await api<Chat>(
        "/chats",
        { method: "POST", body: JSON.stringify({ title: "New conversation" }) },
        token,
      );
      setActive({ ...chat, messages: [] });
      setError(null);
      load();
    } catch {
      setError({
        provider: false,
        message: "A new conversation could not be created.",
      });
    }
  }

  function toggleDocument(id: string) {
    setSelected((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id],
    );
  }

  function chooseSuggestion(text: string) {
    setQuestion(text);
    textarea.current?.focus();
  }

  async function send(event: FormEvent) {
    event.preventDefault();
    const prompt = question.trim();
    if (!token || !prompt || busy) return;
    setBusy(true);
    setSelectorOpen(false);
    setError(null);
    try {
      let chat = active;
      if (!chat) {
        chat = await api<Chat>(
          "/chats",
          {
            method: "POST",
            body: JSON.stringify({ title: prompt.slice(0, 60) }),
          },
          token,
        );
        setActive({ ...chat, messages: [] });
        load();
      }
      const result = await api<{
        user_message: Message;
        assistant_message: Message;
      }>(
        `/chats/${chat.id}/messages`,
        {
          method: "POST",
          body: JSON.stringify({
            question: prompt,
            document_ids: selected.length ? selected : null,
            top_k: 5,
          }),
        },
        token,
      );
      setActive((previous) =>
        previous
          ? {
              ...previous,
              messages: [
                ...(previous.messages || []),
                result.user_message,
                result.assistant_message,
              ],
            }
          : previous,
      );
      setQuestion("");
      load();
    } catch (cause) {
      setError(
        cause instanceof ApiError && cause.status === 503
          ? {
              provider: true,
              message:
                "Your documents and chat history are safe. Please try again later.",
            }
          : {
              provider: false,
              message:
                cause instanceof Error
                  ? cause.message
                  : "Unable to send message.",
            },
      );
    } finally {
      setBusy(false);
    }
  }

  const selectedDocs = docs.filter((doc) => selected.includes(doc.id));
  const hasMessages = Boolean(active?.messages?.length);
  return (
    <div className="chat-page">
      <div className="chat-layout">
        <aside className="chat-list" aria-label="Conversations">
          <div className="chat-list-head">
            <span>YOUR CONVERSATIONS</span>
            <button
              className="new-chat"
              type="button"
              onClick={fresh}
              aria-label="New chat"
            >
              <UiIcon name="plus" />
            </button>
          </div>
          <button className="primary full" type="button" onClick={fresh}>
            <UiIcon name="plus" /> New chat
          </button>
          <div className="chat-session-list">
            {chats.map((chat) => (
              <button
                key={chat.id}
                type="button"
                className={active?.id === chat.id ? "active" : ""}
                onClick={() => open(chat.id)}
              >
                <span>
                  <UiIcon name="chat" />
                </span>
                <div>
                  <b>{chat.title}</b>
                  <small>
                    {new Date(chat.updated_at).toLocaleDateString()}
                  </small>
                </div>
              </button>
            ))}
          </div>
          {!chats.length && (
            <p className="chat-list-empty">
              Your conversations will appear here.
            </p>
          )}
        </aside>

        <section className="conversation" aria-label="Chat with Documents">
          <header className="chat-topbar">
            <div className="chat-heading">
              <span className="eyebrow">GROUNDED INTELLIGENCE</span>
              <h1>Chat with Documents</h1>
              <p>
                Ask questions, compare sources, and get grounded answers from
                your documents.
              </p>
              {active && (
                <small className="chat-current-title">{active.title}</small>
              )}
            </div>
            <div className="context-control">
              <button
                className="context-trigger shine-link"
                type="button"
                onClick={() => setSelectorOpen(!selectorOpen)}
                aria-expanded={selectorOpen}
                aria-label="Add or select documents"
              >
                <UiIcon name="plus" />
                <span>Add documents</span>
                <small>{selected.length ? selected.length : ""}</small>
              </button>
              {selectorOpen && (
                <div className="context-menu">
                  <strong>Ready documents</strong>
                  {docs.map((doc) => (
                    <label key={doc.id}>
                      <input
                        type="checkbox"
                        checked={selected.includes(doc.id)}
                        onChange={() => toggleDocument(doc.id)}
                      />
                      <span className="context-file-icon">
                        <UiIcon name="document" />
                      </span>
                      <b title={doc.filename}>{doc.filename}</b>
                    </label>
                  ))}
                  {!docs.length && (
                    <p>
                      No ready documents yet.{" "}
                      <Link href="/documents">Upload a document</Link> to begin.
                    </p>
                  )}
                </div>
              )}
            </div>
          </header>

          {selectedDocs.length > 0 && (
            <div className="selected-docs" aria-label="Selected documents">
              {selectedDocs.map((doc) => (
                <button
                  key={doc.id}
                  type="button"
                  onClick={() => toggleDocument(doc.id)}
                  aria-label={`Remove ${doc.filename}`}
                >
                  <UiIcon name="document" />
                  <span title={doc.filename}>{doc.filename}</span>
                  <UiIcon name="close" />
                </button>
              ))}
            </div>
          )}

          <div className="messages" aria-live="polite">
            {hasMessages ? (
              <div className="message-stream">
                {active?.messages?.map((message) => (
                  <ChatMessage key={message.id} message={message} />
                ))}
              </div>
            ) : (
              <div className="chat-empty">
                <span className="chat-empty-mark">
                  <UiIcon name="spark" />
                </span>
                <span className="eyebrow">YOUR AI RESEARCH SPACE</span>
                <h2>Ask your documents anything</h2>
                <p>
                  {docs.length
                    ? "Select documents for focused, source-backed answers. With no selection, InsightDoc searches your ready documents."
                    : "Add a ready document to get grounded, source-backed answers."}
                </p>
                <div className="chat-suggestions">
                  {suggestions.map(({ text, icon, tone }) => (
                    <button
                      className={`chat-suggestion dashboard-tone-${tone} shine-link`}
                      type="button"
                      key={text}
                      onClick={() => chooseSuggestion(text)}
                    >
                      <span>
                        <UiIcon name={icon} />
                      </span>
                      <b>{text}</b>
                      <UiIcon name="arrow" />
                    </button>
                  ))}
                </div>
                {!docs.length && (
                  <Link className="chat-empty-upload" href="/documents">
                    <UiIcon name="upload" /> Upload your first document
                  </Link>
                )}
              </div>
            )}
            {busy && (
              <div className="chat-processing" role="status">
                <span className="chat-processing-orb">
                  <UiIcon name="spark" />
                </span>
                <div>
                  <b>Preparing a grounded answer</b>
                  <small>Searching relevant document context…</small>
                </div>
                <span className="chat-processing-dots" aria-hidden="true">
                  <i />
                  <i />
                  <i />
                </span>
              </div>
            )}
          </div>

          {error && (
            <div
              className={`provider-warning${error.provider ? "" : " provider-warning-general"}`}
              role="alert"
            >
              <span>
                <UiIcon name={error.provider ? "spark" : "close"} />
              </span>
              <div>
                <b>
                  {error.provider
                    ? "AI provider temporarily unavailable"
                    : "Chat request could not be completed"}
                </b>
                <p>{error.message}</p>
              </div>
              {error.provider && question.trim() && (
                <button
                  className="provider-retry"
                  type="submit"
                  form="chat-composer"
                  disabled={busy}
                >
                  Try again
                </button>
              )}
              <button
                className="provider-dismiss"
                type="button"
                onClick={() => setError(null)}
                aria-label="Dismiss message"
              >
                <UiIcon name="close" />
              </button>
            </div>
          )}
          <form id="chat-composer" className="composer" onSubmit={send}>
            <div className="composer-box">
              <textarea
                ref={textarea}
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                onKeyDown={(event) => {
                  if (
                    event.key === "Enter" &&
                    !event.shiftKey &&
                    !event.nativeEvent.isComposing
                  ) {
                    event.preventDefault();
                    event.currentTarget.form?.requestSubmit();
                  }
                }}
                placeholder="Ask a question about your documents..."
                maxLength={4000}
                disabled={busy}
                aria-label="Question"
              />
              <div className="composer-meta">
                <button
                  type="button"
                  onClick={() => setSelectorOpen(true)}
                  aria-label="Select documents"
                >
                  <UiIcon name="plus" />{" "}
                  {selected.length
                    ? `${selected.length} selected`
                    : "Add documents"}
                </button>
                <span>{question.length}/4000</span>
              </div>
            </div>
            <button
              className="send-button shine-link"
              type="submit"
              aria-label="Send message"
              disabled={busy || !question.trim()}
            >
              {busy ? <span className="send-loader" /> : <UiIcon name="send" />}
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}

function ChatMessage({ message }: { message: Message }) {
  const assistant = message.role === "assistant";
  return (
    <article className={`message ${message.role}`}>
      <div className="message-avatar">
        {assistant ? <UiIcon name="spark" /> : "You"}
      </div>
      <div className="message-body">
        {assistant && <strong className="message-author">InsightDoc</strong>}
        <p>{message.content}</p>
        {message.citations?.length ? (
          <footer>
            <strong>Sources</strong>
            <div>
              {message.citations.map((citation) => (
                <CitationChip key={citation.chunk_id} citation={citation} />
              ))}
            </div>
          </footer>
        ) : null}
      </div>
    </article>
  );
}

function CitationChip({ citation }: { citation: Citation }) {
  return (
    <span className="citation-chip" title={citation.filename}>
      <UiIcon name="document" />
      <b>{citation.filename}</b>
      {citation.page_number != null && (
        <small>Page {citation.page_number}</small>
      )}
    </span>
  );
}
