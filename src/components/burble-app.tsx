"use client";

import { createClient } from "@/lib/supabase/client";
import { FileText, Hash, LogOut, Paperclip, Plus, Send, Sparkles } from "lucide-react";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";

type Profile = { id: string; handle: string; display_name: string };
type Space = { id: string; name: string; description: string; invite_code: string };
type Channel = { id: string; name: string; topic: string; kind: "chat" | "announcements" };
type Message = { id: string; body: string; attachment_path: string | null; attachment_name: string | null; created_at: string; author: Pick<Profile, "handle" | "display_name"> | null };

const supabase = createClient();

export function BurbleApp() {
	const [session, setSession] = useState<Session | null>(null);
	const [profile, setProfile] = useState<Profile | null>(null);
	const [spaces, setSpaces] = useState<Space[]>([]);
	const [channels, setChannels] = useState<Channel[]>([]);
	const [activeSpace, setActiveSpace] = useState<Space | null>(null);
	const [activeChannel, setActiveChannel] = useState<Channel | null>(null);
	const [messages, setMessages] = useState<Message[]>([]);
	const [notice, setNotice] = useState<string | null>(null);
	const [loading, setLoading] = useState(true);

	const loadSpaces = useCallback(async () => {
		const { data, error } = await supabase.from("spaces").select("id,name,description,invite_code").order("created_at");
		if (error) return setNotice(error.message);
		const next = (data ?? []) as Space[];
		setSpaces(next);
		setActiveSpace((current) => next.find((space) => space.id === current?.id) ?? next[0] ?? null);
	}, []);

	const loadChannels = useCallback(async (spaceId: string) => {
		const { data, error } = await supabase.from("channels").select("id,name,topic,kind").eq("space_id", spaceId).order("created_at");
		if (error) return setNotice(error.message);
		const next = (data ?? []) as Channel[];
		setChannels(next);
		setActiveChannel((current) => next.find((channel) => channel.id === current?.id) ?? next[0] ?? null);
	}, []);

	const loadMessages = useCallback(async (channelId: string) => {
		const { data, error } = await supabase
			.from("messages")
			.select("id,body,attachment_path,attachment_name,created_at,author:profiles!messages_author_id_fkey(handle,display_name)")
			.eq("channel_id", channelId)
			.is("deleted_at", null)
			.order("created_at", { ascending: true })
			.limit(100);
		if (error) return setNotice(error.message);
		setMessages((data ?? []) as Message[]);
	}, []);

	useEffect(() => {
		let subscribed = true;
		supabase.auth.getSession().then(({ data }) => subscribed && setSession(data.session));
		const { data: listener } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
		return () => { subscribed = false; listener.subscription.unsubscribe(); };
	}, []);

	useEffect(() => {
		if (!session) { setLoading(false); return; }
		(async () => {
			setLoading(true);
			const { data, error } = await supabase.from("profiles").select("id,handle,display_name").eq("id", session.user.id).single();
			if (error) setNotice("Your account is still being set up. Refresh in a moment.");
			else setProfile(data as Profile);
			await loadSpaces();
			setLoading(false);
		})();
	}, [session, loadSpaces]);

	useEffect(() => { if (activeSpace) void loadChannels(activeSpace.id); else { setChannels([]); setActiveChannel(null); } }, [activeSpace, loadChannels]);
	useEffect(() => { if (activeChannel) void loadMessages(activeChannel.id); else setMessages([]); }, [activeChannel, loadMessages]);
	useEffect(() => {
		if (!activeChannel) return;
		const channelId = activeChannel.id;
		const realtime = supabase.channel(`burble:${channelId}`).on("postgres_changes", { event: "*", schema: "public", table: "messages", filter: `channel_id=eq.${channelId}` }, () => void loadMessages(channelId)).subscribe();
		return () => { void supabase.removeChannel(realtime); };
	}, [activeChannel, loadMessages]);

	if (!session) return <AuthPanel onNotice={setNotice} notice={notice} />;
	if (loading) return <div className="burble-shell grid place-items-center">Loading your room…</div>;
	return <Workspace {...{ profile, spaces, channels, activeSpace, activeChannel, messages, notice, setNotice, setActiveSpace, setActiveChannel, loadSpaces, loadChannels, loadMessages }} />;
}

function AuthPanel({ onNotice, notice }: { onNotice: (message: string | null) => void; notice: string | null }) {
	const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [busy, setBusy] = useState(false);
	async function submit(event: FormEvent) {
		event.preventDefault(); setBusy(true); onNotice(null);
		const result = mode === "sign-in"
			? await supabase.auth.signInWithPassword({ email, password })
			: await supabase.auth.signUp({ email, password, options: { data: { display_name: email.split("@")[0] } } });
		setBusy(false);
		if (result.error) onNotice(result.error.message);
		else if (mode === "sign-up" && !result.data.session) onNotice("Check your email to confirm your Burble account, then sign in.");
	}
	return <main className="burble-auth"><section className="auth-card"><div className="brand"><span className="brand-mark">b</span><span>burble</span></div><p className="eyebrow">A softer place to talk</p><h1>{mode === "sign-in" ? "Welcome back." : "Start your space."}</h1><p className="muted">Conversations, files, and your crew—without the noise.</p><form onSubmit={submit}><label>Email<input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" /></label><label>Password<input required minLength={6} type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 6 characters" /></label><button className="primary" disabled={busy}>{busy ? "One sec…" : mode === "sign-in" ? "Come on in" : "Create account"}</button></form>{notice && <p className="notice">{notice}</p>}<button className="link-button" onClick={() => { onNotice(null); setMode(mode === "sign-in" ? "sign-up" : "sign-in"); }}>{mode === "sign-in" ? "New here? Create an account" : "Already have an account? Sign in"}</button></section></main>;
}

function Workspace(props: { profile: Profile | null; spaces: Space[]; channels: Channel[]; activeSpace: Space | null; activeChannel: Channel | null; messages: Message[]; notice: string | null; setNotice: (value: string | null) => void; setActiveSpace: (space: Space) => void; setActiveChannel: (channel: Channel) => void; loadSpaces: () => Promise<void>; loadChannels: (spaceId: string) => Promise<void>; loadMessages: (channelId: string) => Promise<void> }) {
	const { profile, spaces, channels, activeSpace, activeChannel, messages, notice, setNotice, setActiveSpace, setActiveChannel, loadSpaces, loadChannels, loadMessages } = props;
	const [newSpace, setNewSpace] = useState(""); const [newChannel, setNewChannel] = useState(""); const [draft, setDraft] = useState(""); const [file, setFile] = useState<File | null>(null); const fileRef = useRef<HTMLInputElement>(null);
	async function createSpace(event: FormEvent) { event.preventDefault(); if (!profile || !newSpace.trim()) return; const space = { id: crypto.randomUUID(), name: newSpace.trim(), description: "", invite_code: "" }; const { error } = await supabase.from("spaces").insert({ id: space.id, name: space.name, owner_id: profile.id }); if (error) return setNotice(error.message); const member = await supabase.from("space_members").insert({ space_id: space.id, profile_id: profile.id, role: "owner" }); if (member.error) return setNotice(member.error.message); const channel = await supabase.from("channels").insert({ space_id: space.id, name: "general", topic: "The first good conversation.", created_by: profile.id }).select("id,name,topic,kind").single(); if (channel.error) return setNotice(channel.error.message); setNewSpace(""); await loadSpaces(); setActiveSpace(space); await loadChannels(space.id); setActiveChannel(channel.data as Channel); }
	async function createChannel(event: FormEvent) { event.preventDefault(); if (!activeSpace || !profile || !newChannel.trim()) return; const name = newChannel.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""); const { data, error } = await supabase.from("channels").insert({ space_id: activeSpace.id, name, created_by: profile.id }).select("id,name,topic,kind").single(); if (error) return setNotice(error.message); setNewChannel(""); await loadChannels(activeSpace.id); setActiveChannel(data as Channel); }
	async function sendMessage(event: FormEvent) { event.preventDefault(); if (!activeChannel || !profile || (!draft.trim() && !file)) return; let attachmentPath: string | null = null; if (file) { const extension = file.name.includes(".") ? `.${file.name.split(".").pop()}` : ""; attachmentPath = `${profile.id}/${crypto.randomUUID()}${extension}`; const upload = await supabase.storage.from("burble-files").upload(attachmentPath, file, { contentType: file.type || undefined }); if (upload.error) return setNotice(upload.error.message); } const { error } = await supabase.from("messages").insert({ channel_id: activeChannel.id, author_id: profile.id, body: draft.trim(), attachment_path: attachmentPath, attachment_name: file?.name ?? null, attachment_type: file?.type ?? null }); if (error) return setNotice(error.message); setDraft(""); setFile(null); if (fileRef.current) fileRef.current.value = ""; await loadMessages(activeChannel.id); }
	return <main className="burble-shell"><aside className="rail"><div className="brand"><span className="brand-mark">b</span></div>{spaces.map((space) => <button title={space.name} onClick={() => setActiveSpace(space)} className={`space-dot ${activeSpace?.id === space.id ? "active" : ""}`} key={space.id}>{space.name.slice(0, 2).toUpperCase()}</button>)}<form onSubmit={createSpace}><button title="Create a space" className="add-dot"><Plus size={20} /></button><input className="sr-only" value={newSpace} onChange={(event) => setNewSpace(event.target.value)} aria-label="New space name" /></form></aside><aside className="spaces"><header><p className="eyebrow">Your space</p><h2>{activeSpace?.name ?? "Make a room"}</h2>{activeSpace && <p className="muted">{activeSpace.description || "A home for your people."}</p>}</header>{activeSpace ? <><div className="section-title"><span>CHANNELS</span><button onClick={() => document.getElementById("channel-name")?.focus()}><Plus size={16} /></button></div><nav>{channels.map((channel) => <button onClick={() => setActiveChannel(channel)} className={`channel-link ${channel.id === activeChannel?.id ? "selected" : ""}`} key={channel.id}><Hash size={17} />{channel.name}</button>)}</nav><form className="inline-form" onSubmit={createChannel}><input id="channel-name" value={newChannel} onChange={(event) => setNewChannel(event.target.value)} placeholder="new-channel" /><button>add</button></form></> : <form className="create-space" onSubmit={createSpace}><Sparkles size={21} /><strong>Your first space is waiting</strong><input value={newSpace} onChange={(event) => setNewSpace(event.target.value)} placeholder="e.g. Sunday club" /><button className="primary">Create space</button></form>}<footer><span className="avatar">{profile?.display_name.slice(0, 1)}</span><div><strong>{profile?.display_name}</strong><small>@{profile?.handle}</small></div><button title="Sign out" onClick={() => void supabase.auth.signOut()}><LogOut size={17} /></button></footer></aside><section className="conversation">{activeChannel ? <><header className="conversation-header"><Hash size={21} /><div><h1>{activeChannel.name}</h1><p>{activeChannel.topic || "A place to keep the thread moving."}</p></div></header><div className="messages">{messages.length === 0 && <div className="empty"><Sparkles size={30} /><h2>This is the beginning.</h2><p>Say hey. Drop a file. Make something happen.</p></div>}{messages.map((message) => <MessageItem key={message.id} message={message} />)}</div><form className="composer" onSubmit={sendMessage}><input ref={fileRef} type="file" onChange={(event) => setFile(event.target.files?.[0] ?? null)} className="sr-only" id="file-upload" /><label title="Attach a file" htmlFor="file-upload"><Paperclip size={20} /></label><input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder={`Message #${activeChannel.name}`} /><button className="send" title="Send"><Send size={19} /></button>{file && <span className="file-pill"><FileText size={14} />{file.name}</span>}</form></> : <div className="empty"><Sparkles size={32} /><h1>Pick a space to get talking.</h1></div>}{notice && <button className="toast" onClick={() => setNotice(null)}>{notice}</button>}</section></main>;
}

function MessageItem({ message }: { message: Message }) {
	const [url, setUrl] = useState<string | null>(null);
	useEffect(() => { if (!message.attachment_path) return; supabase.storage.from("burble-files").createSignedUrl(message.attachment_path, 60 * 60).then(({ data }) => setUrl(data?.signedUrl ?? null)); }, [message.attachment_path]);
	const time = useMemo(() => new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(new Date(message.created_at)), [message.created_at]);
	return <article className="message"><span className="avatar">{message.author?.display_name.slice(0, 1) ?? "?"}</span><div><div className="message-meta"><strong>{message.author?.display_name ?? "Burble member"}</strong><time>{time}</time></div>{message.body && <p>{message.body}</p>}{url && <a className="attachment" href={url} target="_blank" rel="noreferrer"><FileText size={17} />{message.attachment_name ?? "Attachment"}</a>}</div></article>;
}
