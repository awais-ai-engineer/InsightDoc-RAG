"use client";

/* eslint-disable react-hooks/set-state-in-effect */
import Link from "next/link";
import { useEffect, useState } from "react";
import { api, Chat, Document, Workspace } from "@/lib/api";
import { useAuth } from "./AuthProvider";
import { IconName, UiIcon } from "./UiIcon";

function localGreeting() {
  const hour = new Date().getHours();
  return hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
}

export function Dashboard() {
  const { token, user } = useAuth();
  const [greeting, setGreeting] = useState("Welcome back");
  const [docs, setDocs] = useState<Document[]>([]);
  const [chats, setChats] = useState<Chat[]>([]);
  const [spaces, setSpaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => setGreeting(localGreeting()), []);
  useEffect(() => {
    if (!token) return;
    let active = true;
    Promise.all([
      api<{ items: Document[] }>("/documents?limit=5", {}, token),
      api<{ items: Chat[] }>("/chats?limit=5", {}, token),
      api<{ items: Workspace[] }>("/workspaces?limit=5", {}, token),
    ]).then(([documents, conversations, workspaces]) => {
      if (!active) return;
      setDocs(documents.items);
      setChats(conversations.items);
      setSpaces(workspaces.items);
    }).catch((cause) => {
      if (active) setError(cause instanceof Error ? cause.message : "Unable to load your overview.");
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [token]);

  return (
    <div className="dashboard-page">
      <div className="dashboard-topbar">
        <div><span className="eyebrow">YOUR WORKSPACE</span><h1>Overview</h1></div>
        <div className="dashboard-profile" aria-label="Signed in account">
          <span className="dashboard-profile-avatar">{user?.email[0].toUpperCase()}</span>
          <span><b>My account</b><small title={user?.email}>{user?.email}</small></span>
        </div>
      </div>

      <section className="dashboard-hero" aria-labelledby="dashboard-greeting">
        <div className="dashboard-hero-copy">
          <span className="dashboard-hero-kicker"><span /> INTELLIGENCE STARTS HERE</span>
          <h2 id="dashboard-greeting">{greeting}!</h2>
          <p>Your document intelligence, powered by AI. Bring your knowledge together and find answers you can verify.</p>
          <Link className="dashboard-upload shine-link" href="/documents"><UiIcon name="upload" /> Upload Document <UiIcon name="arrow" /></Link>
        </div>
        <div className="dashboard-hero-art" aria-hidden="true">
          <div className="dashboard-art-orbit" />
          <div className="dashboard-art-sheet dashboard-art-sheet-back"><UiIcon name="document" /></div>
          <div className="dashboard-art-sheet dashboard-art-sheet-front"><UiIcon name="document" /><i /><i /><i /></div>
          <span className="dashboard-art-spark dashboard-art-spark-one" />
          <span className="dashboard-art-spark dashboard-art-spark-two" />
        </div>
      </section>

      <div className="dashboard-section-heading"><div><span className="eyebrow">GET MOVING</span><h2>Quick actions</h2></div><p>Pick up where your work begins.</p></div>
      <section className="dashboard-actions" aria-label="Quick actions">
        <QuickAction href="/chat" icon="chat" tone="violet" title="Chat with Documents" text="Ask grounded questions" />
        <QuickAction href="/workspaces" icon="workspace" tone="cyan" title="Create Workspace" text="Organize your knowledge" />
        <QuickAction href="/documents" icon="document" tone="pink" title="View All Documents" text="Explore your knowledge base" />
      </section>

      {error && <div className="dashboard-error" role="alert">{error}</div>}
      <div className="dashboard-section-heading dashboard-recent-heading"><div><span className="eyebrow">YOUR ACTIVITY</span><h2>Recent content</h2></div><p>Everything you have been working on.</p></div>
      <section className="dashboard-recents" aria-label="Recent content">
        <RecentPanel title="Recent Documents" href="/documents" icon="document" tone="blue" loading={loading} error={Boolean(error)} emptyTitle="No documents yet" emptyText="Upload your first document to start analyzing." emptyAction="Upload a document">
          {docs.slice(0, 4).map((doc) => <RecentRow key={doc.id} href={`/chat?document=${doc.id}`} icon="document" title={doc.filename} meta={doc.status} />)}
        </RecentPanel>
        <RecentPanel title="Recent Chats" href="/history" icon="chat" tone="violet" loading={loading} error={Boolean(error)} emptyTitle="No conversations yet" emptyText="Start a chat with one of your documents." emptyAction="Start a chat" actionHref="/chat">
          {chats.slice(0, 4).map((chat) => <RecentRow key={chat.id} href={`/chat?chat=${chat.id}`} icon="chat" title={chat.title} meta={new Date(chat.updated_at).toLocaleDateString()} />)}
        </RecentPanel>
        <RecentPanel title="Recent Workspaces" href="/workspaces" icon="workspace" tone="cyan" loading={loading} error={Boolean(error)} emptyTitle="No workspaces yet" emptyText="Create a workspace to organize your knowledge." emptyAction="Create a workspace">
          {spaces.slice(0, 4).map((space) => <RecentRow key={space.id} href="/workspaces" icon="workspace" title={space.name} meta={`${space.document_count} document${space.document_count === 1 ? "" : "s"}`} />)}
        </RecentPanel>
      </section>
    </div>
  );
}

function QuickAction({ href, icon, tone, title, text }: { href: string; icon: IconName; tone: string; title: string; text: string }) {
  return <Link href={href} className={`dashboard-action dashboard-tone-${tone} shine-link`}><span className="dashboard-action-icon"><UiIcon name={icon} /></span><span className="dashboard-action-copy"><b>{title}</b><small>{text}</small></span><UiIcon name="arrow" className="dashboard-action-arrow" /></Link>;
}

function RecentPanel({ title, href, icon, tone, loading, error, emptyTitle, emptyText, emptyAction, actionHref, children }: { title: string; href: string; icon: IconName; tone: string; loading: boolean; error: boolean; emptyTitle: string; emptyText: string; emptyAction: string; actionHref?: string; children: React.ReactNode }) {
  const hasItems = Boolean(children && (!Array.isArray(children) || children.length));
  return <article className={`dashboard-recent dashboard-tone-${tone}`}><header><span className="dashboard-recent-icon"><UiIcon name={icon} /></span><h3>{title}</h3><Link href={href} aria-label={`View all ${title.toLowerCase()}`}><UiIcon name="arrow" /></Link></header><div className="dashboard-recent-body">{loading ? <div className="dashboard-recent-loading">Loading…</div> : error ? <div className="dashboard-recent-loading">Recent activity is unavailable.</div> : hasItems ? children : <div className="dashboard-empty"><span><UiIcon name={icon} /></span><b>{emptyTitle}</b><p>{emptyText}</p><Link href={actionHref ?? href}>{emptyAction} <UiIcon name="arrow" /></Link></div>}</div></article>;
}

function RecentRow({ href, icon, title, meta }: { href: string; icon: IconName; title: string; meta: string }) {
  return <Link href={href} className="dashboard-recent-row"><span><UiIcon name={icon} /></span><b title={title}>{title}</b><small>{meta}</small></Link>;
}
