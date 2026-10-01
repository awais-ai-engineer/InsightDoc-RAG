"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { api, Chat, Document, Workspace } from "@/lib/api";
import { useAuth } from "./AuthProvider";

export function Dashboard() {
  const { token, user } = useAuth();
  const [docs, setDocs] = useState<Document[]>([]);
  const [chats, setChats] = useState<Chat[]>([]);
  const [spaces, setSpaces] = useState<Workspace[]>([]);
  useEffect(() => {
    if (!token) return;
    Promise.all([api<{items: Document[]}>("/documents?limit=5", {}, token), api<{items: Chat[]}>("/chats?limit=5", {}, token), api<{items: Workspace[]}>("/workspaces?limit=5", {}, token)]).then(([d, c, w]) => { setDocs(d.items); setChats(c.items); setSpaces(w.items); }).catch(() => {});
  }, [token]);

  return <>
    <header className="page-head"><div><span className="eyebrow">OVERVIEW</span><h1>Welcome, {user?.email.split("@")[0]}</h1><p>Your document intelligence workspace at a glance.</p></div><Link className="primary" href="/documents">＋ Upload document</Link></header>
    <section className="stats"><Stat icon="▤" n={docs.length} label="Documents"/><Stat icon="✦" n={chats.length} label="Chats"/><Stat icon="◇" n={spaces.length} label="Workspaces"/><Stat icon="✓" n={docs.filter(doc => doc.status === "ready").length} label="Ready documents"/></section>
    <h2 className="section-title">Quick actions</h2>
    <section className="quick"><Quick href="/documents" icon="⇧" title="Upload document" text="Add PDF, TXT or DOCX"/><Quick href="/chat" icon="✦" title="Start a new chat" text="Ask grounded questions"/><Quick href="/workspaces" icon="◇" title="Create workspace" text="Organize your research"/></section>
    <section className="dashboard-panels"><Panel title="Recent documents" href="/documents">{docs.length ? docs.map(doc => <Row key={doc.id} icon="▤" title={doc.filename} meta={doc.status}/>) : <Empty text="Upload your first document"/>}</Panel><Panel title="Recent chats" href="/history">{chats.length ? chats.map(chat => <Row key={chat.id} icon="✦" title={chat.title} meta={new Date(chat.updated_at).toLocaleDateString()}/>) : <Empty text="Start your first conversation"/>}</Panel><Panel title="Recent workspaces" href="/workspaces">{spaces.length ? spaces.map(space => <Row key={space.id} icon="◇" title={space.name} meta={`${space.document_count} documents`}/>) : <Empty text="Create your first workspace"/>}</Panel></section>
  </>;
}
function Stat({icon,n,label}:{icon:string;n:number;label:string}){return <div className="stat"><i>{icon}</i><div><b>{n}</b><span>{label}</span></div></div>}
function Quick({href,icon,title,text}:{href:string;icon:string;title:string;text:string}){return <Link className="quick-card" href={href}><i>{icon}</i><div><b>{title}</b><span>{text}</span></div><strong>→</strong></Link>}
function Panel({title,href,children}:{title:string;href:string;children:React.ReactNode}){return <div className="panel"><div className="panel-head"><h2>{title}</h2><Link href={href}>View all →</Link></div>{children}</div>}
function Row({icon,title,meta}:{icon:string;title:string;meta:string}){return <div className="list-row"><span className="file-icon">{icon}</span><b>{title}</b><small>{meta}</small></div>}
function Empty({text}:{text:string}){return <div className="empty">{text}</div>}
