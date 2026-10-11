import { useEffect, useRef, useState, type FormEvent } from 'react';
import { api } from './api';
import type { Contact, Entry, Social } from '../shared/models';
import { entryPath } from '../shared/models';
import { TerminalPreview } from './Terminal';
import { PicturesAdmin } from './PicturesAdmin';

type Auth = { setupRequired: boolean; authenticated: boolean; csrf: string };
type Page = 'entries' | 'socials' | 'contacts' | 'pictures';
const emptyEntry = (): Entry => ({ id: '', kind: 'project', slug: '', title: '', markdown: '', published: false, createdAt: '', updatedAt: '' });
export function Admin() {
  const [auth, setAuth] = useState<Auth | null>(null); const [error, setError] = useState('');
  const [page, setPage] = useState<Page>(location.pathname === '/admin/pictures' ? 'pictures' : 'entries'); const [entries, setEntries] = useState<Entry[]>([]); const [editing, setEditing] = useState<Entry | null>(null);
  const [socials, setSocials] = useState<Social[]>([]); const [contacts, setContacts] = useState<Contact[]>([]); const [notice, setNotice] = useState(''); const [busy, setBusy] = useState(false);
  const initialAuth = useRef<Promise<Auth> | null>(null);
  useEffect(() => {
    document.title = 'Luna admin';
    let active = true;
    // Strict Mode repeats effects in development. Share the request so two
    // first-run sessions cannot race to replace the browser's session cookie.
    initialAuth.current ??= api<Auth>('/api/auth/status');
    void initialAuth.current.then(a => {
      if (!active) return;
      setAuth(a);
      if (a.setupRequired && location.pathname !== '/admin/setup') history.replaceState({}, '', '/admin/setup');
      else if (!a.authenticated && !a.setupRequired) history.replaceState({}, '', '/admin/login');
    }).catch(e => { if (active) setError(e.message); });
    return () => { active = false; };
  }, []);
  async function load(which: Page) {
    setError(''); setNotice('');
    try {
      if (which === 'entries') setEntries(await api<Entry[]>('/api/admin/entries'));
      if (which === 'socials') setSocials(await api<Social[]>('/api/admin/socials'));
      if (which === 'contacts') setContacts(await api<Contact[]>('/api/admin/contacts'));
    } catch (e) { setError((e as Error).message); }
  }
  useEffect(() => { if (auth?.authenticated) void load(page); }, [auth?.authenticated, page]);
  async function perform(fn: () => Promise<unknown>, message?: string) {
    setBusy(true); setError(''); setNotice('');
    try { await fn(); if (message) setNotice(message); } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  if (!auth) return <main className="admin-page"><h1>Luna admin</h1><p role="status">{error || 'Loading…'}</p>{error && <button onClick={() => location.reload()}>Retry</button>}</main>;
  if (!auth.authenticated) return <AuthForm auth={auth} />;
  return <main className="admin-page">
    <header className="admin-header"><div><span className="admin-eyebrow">term.pmck.ie</span><h1>Luna admin</h1></div><div className="admin-header-actions"><a href="/" target="_blank" rel="noopener noreferrer">Open terminal ↗</a><button className="secondary" disabled={busy} onClick={() => void perform(async () => { await api('/api/auth/logout', { method: 'POST' }, auth.csrf); location.assign('/admin/login'); })}>Sign out</button></div></header>
    <nav className="admin-tabs" aria-label="Admin sections">{(['entries', 'pictures', 'socials', 'contacts'] as Page[]).map(p => <button key={p} aria-current={page === p ? 'page' : undefined} onClick={() => { if (editing && !confirm('Leave the editor? Unsaved changes will be lost.')) return; setPage(p); setEditing(null); history.replaceState({}, '', p === 'pictures' ? '/admin/pictures' : '/admin'); }}>{p === 'entries' ? 'Projects & posts' : p === 'pictures' ? 'Pictures' : p === 'socials' ? 'Social links' : 'Messages'}</button>)}</nav>
    {error && <div className="admin-error" role="alert">{error}{error === 'Sign in to continue.' && <> <a href="/admin/login">Sign in</a></>}</div>}
    {notice && <p className="admin-notice" role="status">{notice}</p>}
    {page === 'pictures' && <PicturesAdmin csrf={auth.csrf} />}
    {page === 'entries' && (editing ? <EntryEditor key={editing.id || 'new'} entry={editing} csrf={auth.csrf} onCancel={() => { if (confirm('Discard unsaved changes?')) setEditing(null); }} onSave={async () => { setEditing(null); await load('entries'); setNotice('Entry saved.'); }} /> : <>
      <div className="section-heading"><h2>Projects & posts</h2><button onClick={() => setEditing(emptyEntry())}>Create entry</button></div>
      <div className="admin-list">{entries.map(entry => <div className="admin-list-row" key={entry.id}><div><h3>{entry.title}</h3><code>~{entryPath(entry)}</code><p>{entry.kind === 'project' ? 'Project' : 'Blog post'} · <span className={entry.published ? 'published-status' : ''}>{entry.published ? 'Published' : 'Draft'}</span></p></div><div className="row-actions"><button className="secondary" onClick={() => setEditing(entry)}>Edit & preview</button><button className="danger" disabled={busy} onClick={() => { if (confirm(`Delete “${entry.title}”?`)) void perform(async () => { await api(`/api/admin/entries/${entry.id}`, { method: 'DELETE' }, auth.csrf); await load('entries'); }, 'Entry deleted.'); }}>Delete</button></div></div>)}</div>
      {!entries.length && <p>No entries yet.</p>}
    </>)}
    {page === 'socials' && <form className="admin-panel" onSubmit={e => { e.preventDefault(); void perform(async () => { setSocials(await api<Social[]>('/api/admin/socials', { method: 'PUT', body: JSON.stringify(socials) }, auth.csrf)); }, 'Social links saved.'); }}><h2>Social links</h2><p className="admin-muted">Shown in ~/messaging/socials.txt.</p>{socials.map((social, i) => <div className="social-row" key={i}><label>Label<input required maxLength={60} value={social.label} onChange={e => setSocials(s => s.map((link, j) => j === i ? { ...link, label: e.target.value } : link))} /></label><label>URL<input required type="url" value={social.url} onChange={e => setSocials(s => s.map((link, j) => j === i ? { ...link, url: e.target.value } : link))} /></label><button type="button" className="danger" onClick={() => setSocials(s => s.filter((_, j) => j !== i))}>Remove</button></div>)}<div className="form-actions"><button type="button" className="secondary" disabled={socials.length >= 20} onClick={() => setSocials(s => [...s, { label: '', url: '' }])}>Add link</button><button disabled={busy}>Save links</button></div></form>}
    {page === 'contacts' && <><div className="section-heading"><h2>Messages</h2><button className="secondary" onClick={() => void load('contacts')}>Refresh</button></div>{!contacts.length && <p>No messages yet.</p>}<div className="admin-list">{contacts.map(contact => <article className="contact-card" key={contact.id}><header><div><h3>{contact.subject}</h3><p><strong>{contact.name}</strong> · <a href={`mailto:${contact.email}`}>{contact.email}</a></p><p className="admin-muted">{new Date(contact.createdAt).toLocaleString()} · {contact.read ? 'Read' : 'Unread'}</p></div><div className="row-actions"><button className="secondary" disabled={busy} onClick={() => void perform(async () => { await api(`/api/admin/contacts/${contact.id}`, { method: 'PATCH', body: JSON.stringify({ read: !contact.read }) }, auth.csrf); await load('contacts'); })}>{contact.read ? 'Mark unread' : 'Mark read'}</button><button className="danger" disabled={busy} onClick={() => { if (confirm('Delete this message?')) void perform(async () => { await api(`/api/admin/contacts/${contact.id}`, { method: 'DELETE' }, auth.csrf); await load('contacts'); }, 'Message deleted.'); }}>Delete</button></div></header><pre>{contact.message}</pre></article>)}</div></>}
  </main>;
}
function AuthForm({ auth }: { auth: Auth }) {
  const [username, setUsername] = useState(''); const [password, setPassword] = useState(''); const [token, setToken] = useState(''); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault(); setBusy(true); setError('');
    try {
      // Refresh before submitting if the form outlived its session or another
      // tab changed it. The write still requires a session-bound CSRF token.
      const currentAuth = await api<Auth>('/api/auth/status');
      await api(`/api/auth/${auth.setupRequired ? 'setup' : 'login'}`, { method: 'POST', body: JSON.stringify({ username, password, ...(auth.setupRequired ? { token } : {}) }) }, currentAuth.csrf);
      location.assign('/admin');
    }
    catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  return <main className="admin-auth"><a className="admin-back" href="/">← Terminal</a><form className="admin-panel" onSubmit={submit}><span className="admin-eyebrow">Luna admin</span><h1>{auth.setupRequired ? 'Create your account' : 'Sign in'}</h1>{auth.setupRequired && <p className="admin-muted">Use the setup token from your environment configuration.</p>}{error && <p className="admin-error" role="alert">{error}</p>}{auth.setupRequired && <label>Setup token<input type="password" autoComplete="off" required value={token} onChange={e => setToken(e.target.value)} /></label>}<label>Username<input autoComplete="username" required maxLength={80} value={username} onChange={e => setUsername(e.target.value)} /></label><label>Password<input type="password" autoComplete={auth.setupRequired ? 'new-password' : 'current-password'} required minLength={auth.setupRequired ? 12 : undefined} maxLength={256} value={password} onChange={e => setPassword(e.target.value)} /></label>{auth.setupRequired && <p className="admin-muted">At least 12 characters.</p>}<button disabled={busy}>{busy ? 'Please wait…' : auth.setupRequired ? 'Create account' : 'Sign in'}</button></form></main>;
}
function EntryEditor({ entry, csrf, onCancel, onSave }: { entry: Entry; csrf: string; onCancel: () => void; onSave: () => Promise<void> }) {
  const [draft, setDraft] = useState(entry); const [error, setError] = useState(''); const [busy, setBusy] = useState(false); const [uploading, setUploading] = useState(false); const [slugTouched, setSlugTouched] = useState(!!entry.id);
  const markdown = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { const warn = (e: BeforeUnloadEvent) => { if (JSON.stringify(draft) !== JSON.stringify(entry)) e.preventDefault(); }; window.addEventListener('beforeunload', warn); return () => window.removeEventListener('beforeunload', warn); }, [draft, entry]);
  async function save(e: FormEvent) {
    e.preventDefault(); setBusy(true); setError('');
    try { await api(`/api/admin/entries${entry.id ? '/' + entry.id : ''}`, { method: entry.id ? 'PUT' : 'POST', body: JSON.stringify(draft) }, csrf); await onSave(); }
    catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  async function upload(file: File) {
    setUploading(true); setError(''); const form = new FormData(); form.append('file', file);
    try {
      const result = await api<{ url: string; mime: string; name: string }>('/api/admin/media', { method: 'POST', body: form }, csrf);
      const caption = result.name.replace(/[\[\]\\\r\n]/g, ''); const insertion = result.mime.startsWith('video/') ? `\n\n\`\`\`video\n${result.url}\n${caption}\n\`\`\`\n\n` : `\n\n![${caption}](${result.url})\n\n`;
      const start = markdown.current?.selectionStart ?? draft.markdown.length, end = markdown.current?.selectionEnd ?? start;
      setDraft(d => ({ ...d, markdown: d.markdown.slice(0, start) + insertion + d.markdown.slice(end) }));
    } catch (e) { setError((e as Error).message); } finally { setUploading(false); }
  }
  return <div className="editor"><form className="admin-panel" onSubmit={save}><div className="section-heading"><h2>{entry.id ? 'Edit entry' : 'Create entry'}</h2><button type="button" className="secondary" onClick={onCancel}>Back to entries</button></div>{error && <p className="admin-error" role="alert">{error}</p>}<div className="editor-fields"><label>Type<select value={draft.kind} onChange={e => setDraft(d => ({ ...d, kind: e.target.value as Entry['kind'] }))}><option value="project">Project</option><option value="blog">Blog post</option></select></label><label>Title<input required maxLength={160} value={draft.title} onChange={e => { const title = e.target.value; setDraft(d => ({ ...d, title, ...(slugTouched ? {} : { slug: title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80) }) })); }} /></label><label>Filename slug<input required maxLength={80} pattern="[a-z0-9]+(-[a-z0-9]+)*" value={draft.slug} onChange={e => { setSlugTouched(true); setDraft(d => ({ ...d, slug: e.target.value })); }} /></label></div><p className="admin-muted"><code>~{entryPath(draft)}</code></p><label>Markdown<textarea ref={markdown} rows={16} maxLength={100000} value={draft.markdown} onChange={e => setDraft(d => ({ ...d, markdown: e.target.value }))} /></label><div className="upload-row"><label className="upload-label">{uploading ? 'Uploading…' : 'Add image or video'}<input type="file" accept="image/jpeg,image/png,image/gif,image/webp,video/mp4,video/webm" disabled={uploading} onChange={e => { const file = e.target.files?.[0]; if (file) void upload(file); e.target.value = ''; }} /></label><p className="admin-muted">Images up to 10 MB; video up to 50 MB. Uploads insert Markdown at the cursor.</p></div><label className="checkbox"><input type="checkbox" checked={draft.published} onChange={e => setDraft(d => ({ ...d, published: e.target.checked }))} />Published</label><div className="form-actions"><button disabled={busy || uploading}>{busy ? 'Saving…' : 'Save entry'}</button><span className="admin-muted">{draft.published ? 'Saving makes this entry public.' : 'Saving keeps this entry as a private draft.'}</span></div><details className="markdown-help"><summary>Markdown and video syntax</summary><pre>{'# Heading\n\nText with [a link](https://example.com).\n\n- List item\n\n![Image description](/media/upload-id)\n\n```video\n/media/upload-id\nVideo description\n```'}</pre></details></form><h2 className="preview-heading">Terminal preview</h2><TerminalPreview entry={draft} /></div>;
}
