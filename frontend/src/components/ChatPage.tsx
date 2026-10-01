"use client";
/* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */
import { FormEvent, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { api, ApiError, Chat, Document, Message } from "@/lib/api";
import { useAuth } from "./AuthProvider";

const examples = ["Summarize this document", "What are the key findings?", "Extract important dates", "Compare the main arguments"];

export function ChatPage() {
  const { token } = useAuth();
  const params = useSearchParams();
  const [chats, setChats] = useState<Chat[]>([]);
  const [active, setActive] = useState<Chat | null>(null);
  const [docs, setDocs] = useState<Document[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [selectorOpen, setSelectorOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = () => token && Promise.all([
    api<{items: Chat[]}>("/chats?limit=100", {}, token),
    api<{items: Document[]}>("/documents?limit=100", {}, token),
  ]).then(([c, d]) => { setChats(c.items); setDocs(d.items.filter(item => item.status === "ready")); });

  useEffect(() => {
    const documentId = params.get("document");
    if (documentId) setSelected([documentId]);
    const chatId = params.get("chat");
    if (chatId && token) api<Chat>(`/chats/${chatId}`, {}, token).then(setActive).catch(() => setError("Conversation could not be opened."));
  }, [params, token]);
  useEffect(() => { load(); }, [token]);

  async function open(id: string) { if (token) setActive(await api<Chat>(`/chats/${id}`, {}, token)); }
  async function fresh() { if (!token) return; const chat = await api<Chat>("/chats", { method: "POST", body: JSON.stringify({ title: "New conversation" }) }, token); setActive({ ...chat, messages: [] }); load(); }
  function toggleDocument(id: string) { setSelected(current => current.includes(id) ? current.filter(item => item !== id) : [...current, id]); }

  async function send(e: FormEvent) {
    e.preventDefault();
    if (!token || !question.trim()) return;
    let chat = active;
    if (!chat) { chat = await api<Chat>("/chats", { method: "POST", body: JSON.stringify({ title: question.slice(0, 60) }) }, token); setActive({ ...chat, messages: [] }); }
    setBusy(true); setError("");
    try {
      const result = await api<{user_message: Message; assistant_message: Message}>(`/chats/${chat.id}/messages`, { method: "POST", body: JSON.stringify({ question, document_ids: selected.length ? selected : null, top_k: 5 }) }, token);
      setActive(previous => previous ? { ...previous, messages: [...(previous.messages || []), result.user_message, result.assistant_message] } : previous);
      setQuestion(""); load();
    } catch (err) {
      setError(err instanceof ApiError && err.status === 503 ? "The AI provider is temporarily unavailable. Your documents and chat history are safe. Please try again later." : err instanceof Error ? err.message : "Unable to send message.");
    } finally { setBusy(false); }
  }

  const selectedDocs = docs.filter(doc => selected.includes(doc.id));
  return <div className="chat-layout">
    <aside className="chat-list">
      <div className="chat-list-head"><span>CONVERSATIONS</span><button className="new-chat" onClick={fresh}>＋</button></div>
      <button className="primary full" onClick={fresh}>✦ New chat</button>
      <div className="chat-session-list">{chats.map(chat => <button key={chat.id} className={active?.id === chat.id ? "active" : ""} onClick={() => open(chat.id)}><span>✦</span><div><b>{chat.title}</b><small>{new Date(chat.updated_at).toLocaleDateString()}</small></div></button>)}</div>
      {!chats.length && <p className="chat-list-empty">Your conversations will appear here.</p>}
    </aside>

    <section className="conversation">
      <header className="chat-topbar">
        <div><span className="eyebrow">GROUNDED CHAT</span><h1>{active?.title || "Chat with your documents"}</h1></div>
        <div className="context-control">
          <button className="context-trigger" onClick={() => setSelectorOpen(!selectorOpen)}><span>▤</span><div><small>DOCUMENT CONTEXT</small><b>{selected.length ? `${selected.length} document${selected.length > 1 ? "s" : ""} selected` : "Choose documents"}</b></div><i>⌄</i></button>
          {selectorOpen && <div className="context-menu"><strong>Ready documents</strong>{docs.map(doc => <label key={doc.id}><input type="checkbox" checked={selected.includes(doc.id)} onChange={() => toggleDocument(doc.id)}/><span className="file-icon">{doc.filename.endsWith(".pdf") ? "PDF" : "TXT"}</span><b>{doc.filename}</b></label>)}{!docs.length && <p>No ready documents yet.</p>}</div>}
        </div>
      </header>
      {selectedDocs.length > 0 && <div className="selected-docs">{selectedDocs.map(doc => <button key={doc.id} onClick={() => toggleDocument(doc.id)}>▤ {doc.filename} <span>×</span></button>)}</div>}

      <div className="messages">
        {active?.messages?.length ? active.messages.map(message => <article className={`message ${message.role}`} key={message.id}><div className="message-avatar">{message.role === "assistant" ? "✦" : "You"}</div><div className="message-body"><p>{message.content}</p>{message.citations?.length ? <footer>{message.citations.map(citation => <span key={citation.chunk_id}><i>▤</i><b>{citation.filename}</b>{citation.page_number ? <small>Page {citation.page_number}</small> : <small>Source</small>}</span>)}</footer> : null}</div></article>) : <div className="chat-empty"><i>✦</i><h2>Ask your documents anything</h2><p>Select one or more ready documents, then ask a focused question.</p><div>{examples.map(example => <button key={example} onClick={() => setQuestion(example)}>{example}</button>)}</div></div>}
      </div>

      {error && <div className="provider-warning"><span>!</span><div><b>AI provider temporarily unavailable</b><p>{error}</p></div><button onClick={() => setError("")}>×</button></div>}
      <form className="composer" onSubmit={send}><div className="composer-box"><textarea value={question} onChange={e => setQuestion(e.target.value)} placeholder="Ask a focused question about your documents…" maxLength={4000}/><div className="composer-meta"><span>{selected.length ? `▤ ${selected.length} selected` : "No documents selected"}</span><small>{question.length}/4000</small></div></div><button className="send-button" aria-label="Send message" disabled={busy || !question.trim()}>{busy ? <span className="send-loader"/> : "↑"}</button></form>
    </section>
  </div>;
}
