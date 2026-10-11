import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { Picture, PictureAlbum, Pictures } from '../shared/models';
import { albumPaths, pictureFilename, picturePath } from '../shared/pictures';
import { api } from './api';
import { TerminalPicturePreview } from './Terminal';

export function PicturesAdmin({ csrf }: { csrf: string }) {
  const [gallery, setGallery] = useState<Pictures>({ albums: [], pictures: [] });
  const [currentAlbum, setCurrentAlbum] = useState('');
  const [name, setName] = useState(''), [albumId, setAlbumId] = useState('');
  const [file, setFile] = useState<File | null>(null), [editing, setEditing] = useState<Picture | null>(null);
  const [albumName, setAlbumName] = useState(''), [parentId, setParentId] = useState(''), [editingAlbum, setEditingAlbum] = useState<PictureAlbum | null>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);
  const paths = albumPaths(gallery.albums);
  const sortedAlbums = [...gallery.albums].sort((a, b) => (paths.get(a.id) ?? '').localeCompare(paths.get(b.id) ?? ''));
  async function load() { setGallery(await api<Pictures>('/api/admin/pictures')); }
  useEffect(() => { let active = true; void api<Pictures>('/api/admin/pictures').then(data => { if (active) setGallery(data); }).catch(e => { if (active) setError(e.message); }); return () => { active = false; }; }, []);
  async function perform(action: () => Promise<void>) {
    setBusy(true); setError(''); setNotice('');
    try { await action(); } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  function resetPicture(album = currentAlbum) { setEditing(null); setName(''); setFile(null); setAlbumId(album); if (fileInput.current) fileInput.current.value = ''; }
  function resetAlbum(parent = currentAlbum) { setEditingAlbum(null); setAlbumName(''); setParentId(parent); }
  async function savePicture(event: FormEvent) {
    event.preventDefault();
    await perform(async () => {
      let saved: Picture;
      if (editing) saved = await api<Picture>(`/api/admin/pictures/${editing.id}`, { method: 'PUT', body: JSON.stringify({ name, albumId: albumId || null }) }, csrf);
      else {
        if (!file) throw new Error('Choose a picture.');
        const form = new FormData(); form.append('name', name); form.append('albumId', albumId); form.append('file', file);
        saved = await api<Picture>('/api/admin/pictures', { method: 'POST', body: form }, csrf);
      }
      await load(); setEditing(saved); setFile(null); if (fileInput.current) fileInput.current.value = ''; setCurrentAlbum(saved.albumId ?? ''); setNotice('Picture saved.');
    });
  }
  async function saveAlbum(event: FormEvent) {
    event.preventDefault();
    await perform(async () => {
      await api(`/api/admin/picture-albums${editingAlbum ? '/' + editingAlbum.id : ''}`, { method: editingAlbum ? 'PUT' : 'POST', body: JSON.stringify({ name: albumName, parentId: parentId || null }) }, csrf);
      await load(); resetAlbum(); setNotice('Album saved.');
    });
  }
  const preview = editing ? { ...editing, name, albumId: albumId || null, filename: pictureFilename(name, editing.filename.split('.').pop()!) } : null;
  const previewPath = preview ? picturePath(preview, gallery.albums) : null;
  return <>
    <div className="section-heading"><h2>Pictures</h2><button className="secondary" disabled={busy} onClick={() => void perform(load)}>Refresh</button></div>
    <p className="admin-muted">Pictures are public after saving and live in ~/pictures. These uploads are separate from project and post media.</p>
    {error && <p className="admin-error" role="alert">{error}{error === 'Sign in to continue.' && <> <a href="/admin/login">Sign in</a></>}</p>}
    {notice && <p className="admin-notice" role="status">{notice}</p>}
    <label className="picture-browse">Browse album<select value={currentAlbum} disabled={busy} onChange={e => { const id = e.target.value; setCurrentAlbum(id); resetPicture(id); resetAlbum(id); }}><option value="">~/pictures</option>{sortedAlbums.map(album => <option key={album.id} value={album.id}>~{paths.get(album.id)}</option>)}</select></label>
    <div className="pictures-management">
      <form className="admin-panel" aria-label="Picture editor" onSubmit={savePicture}>
        <div className="section-heading"><h3>{editing ? 'Edit picture' : 'Add picture'}</h3>{editing && <button type="button" className="secondary" disabled={busy} onClick={() => resetPicture()}>New picture</button>}</div>
        <label>Picture name<input required maxLength={160} value={name} disabled={busy} onChange={e => setName(e.target.value)} /></label>
        <label>Album<select value={albumId} disabled={busy} onChange={e => setAlbumId(e.target.value)}><option value="">~/pictures</option>{sortedAlbums.map(album => <option key={album.id} value={album.id}>~{paths.get(album.id)}</option>)}</select></label>
        {!editing && <label>Image file<input ref={fileInput} type="file" required accept="image/jpeg,image/png,image/gif,image/webp" disabled={busy} onChange={e => { const chosen = e.target.files?.[0] ?? null; setFile(chosen); if (chosen && !name) setName(chosen.name.replace(/\.[^.]+$/, '')); }} /></label>}
        <p className="admin-muted">JPEG, PNG, GIF, or WebP up to 10 MB. The name becomes the filename, with its image extension retained.</p>
        {previewPath && <p className="admin-muted"><code>~{previewPath}</code></p>}
        <button disabled={busy}>{busy ? 'Saving…' : editing ? 'Save picture' : 'Upload picture'}</button>
      </form>
      <form className="admin-panel" aria-label="Album editor" onSubmit={saveAlbum}>
        <div className="section-heading"><h3>{editingAlbum ? 'Edit album' : 'Create album'}</h3>{editingAlbum && <button type="button" className="secondary" disabled={busy} onClick={() => resetAlbum()}>New album</button>}</div>
        <label>Directory name<input required maxLength={80} pattern="[a-z0-9]+(-[a-z0-9]+)*" value={albumName} disabled={busy} onChange={e => setAlbumName(e.target.value)} /></label>
        <label>Parent directory<select value={parentId} disabled={busy} onChange={e => setParentId(e.target.value)}><option value="">~/pictures</option>{sortedAlbums.filter(album => !editingAlbum || album.id !== editingAlbum.id && !paths.get(album.id)?.startsWith(paths.get(editingAlbum.id)! + '/')).map(album => <option key={album.id} value={album.id}>~{paths.get(album.id)}</option>)}</select></label>
        <p className="admin-muted">Use lowercase letters, numbers, and hyphens. Choose an album as the parent to create a subdirectory. Only empty albums can be deleted.</p>
        <button disabled={busy}>{busy ? 'Saving…' : editingAlbum ? 'Save album' : 'Create album'}</button>
      </form>
    </div>
    <div className="admin-list">{gallery.pictures.filter(picture => (picture.albumId ?? '') === currentAlbum).map(picture => <div className="admin-list-row" key={picture.id}><div><h3>{picture.name}</h3><code>~{picturePath(picture, gallery.albums)}</code></div><div className="row-actions"><button className="secondary" disabled={busy} onClick={() => { setEditing(picture); setName(picture.name); setAlbumId(picture.albumId ?? ''); setFile(null); }}>Edit & preview</button><button className="danger" disabled={busy} onClick={() => { if (confirm(`Delete “${picture.name}” and its uploaded file?`)) void perform(async () => { await api(`/api/admin/pictures/${picture.id}`, { method: 'DELETE' }, csrf); await load(); if (editing?.id === picture.id) resetPicture(); setNotice('Picture deleted.'); }); }}>Delete</button></div></div>)}</div>
    {!gallery.pictures.some(picture => (picture.albumId ?? '') === currentAlbum) && <p>No pictures in this album.</p>}
    {preview && previewPath && <><h3 className="preview-heading">Terminal preview</h3><TerminalPicturePreview picture={preview} path={previewPath} /></>}
    <h3>Albums</h3>
    <div className="admin-list">{sortedAlbums.map(album => <div className="admin-list-row" key={album.id}><code>~{paths.get(album.id)}/</code><div className="row-actions"><button className="secondary" disabled={busy} onClick={() => { setEditingAlbum(album); setAlbumName(album.name); setParentId(album.parentId ?? ''); }}>Edit album</button><button className="danger" disabled={busy} onClick={() => { if (confirm(`Delete the empty album “${album.name}”?`)) void perform(async () => { await api(`/api/admin/picture-albums/${album.id}`, { method: 'DELETE' }, csrf); await load(); if (currentAlbum === album.id) { setCurrentAlbum(''); resetPicture(''); } if (editingAlbum?.id === album.id) resetAlbum(''); setNotice('Album deleted.'); }); }}>Delete</button></div></div>)}</div>
  </>;
}
