import { useEffect, useRef, useState } from 'react';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { Avatar, Banner, Field, PageHeader, useToast } from '../ui.jsx';

const SIZE = 400;

function AvatarEditor({ onSaved }) {
  const { user, setUser } = useAuth();
  const toast = useToast();
  const canvas = useRef(null);
  const [img, setImg] = useState(null);
  const [zoom, setZoom] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const draw = () => {
    const c = canvas.current; if (!c || !img) return;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, SIZE, SIZE);
    const base = Math.max(SIZE / img.width, SIZE / img.height) * zoom;
    const w = img.width * base, h = img.height * base;
    const maxX = (w - SIZE) / 2, maxY = (h - SIZE) / 2;
    ctx.drawImage(img, (SIZE - w) / 2 + pos.x * maxX, (SIZE - h) / 2 + pos.y * maxY, w, h);
  };
  useEffect(draw, [img, zoom, pos]);

  const pick = (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    setErr('');
    if (!/^image\/(png|jpe?g|webp|gif)$/.test(file.type)) { setErr('Choose a PNG, JPG, WebP or GIF image.'); return; }
    const url = URL.createObjectURL(file);
    const im = new Image();
    im.onload = () => { setImg(im); setZoom(1); setPos({ x: 0, y: 0 }); URL.revokeObjectURL(url); };
    im.onerror = () => setErr('We couldn’t read that image. Try another one.');
    im.src = url;
  };
  const save = () => {
    setBusy(true); setErr('');
    canvas.current.toBlob(async (blob) => {
      try {
        const fd = new FormData(); fd.append('avatar', blob, 'avatar.jpg');
        const d = await api.post('/me/avatar', fd, { timeout: 40000 });
        setUser(d.user); setImg(null); toast('Profile picture updated'); onSaved?.();
      } catch (e) { setErr(e.message); } finally { setBusy(false); }
    }, 'image/jpeg', 0.9);
  };
  const remove = async () => { try { const d = await api.del('/me/avatar'); setUser(d.user); toast('Profile picture removed'); } catch (e) { setErr(e.message); } };

  return (
    <section className="card">
      <h2>Profile picture</h2>
      {err && <Banner tone="error">{err}</Banner>}
      <div className="row" style={{ gap: '1.5rem', alignItems: 'flex-start' }}>
        {img ? <div className="crop-box"><canvas ref={canvas} width={SIZE} height={SIZE} /></div> : <Avatar user={user} size={120} />}
        <div style={{ flex: 1, minWidth: 220 }}>
          <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={pick} aria-label="Choose a profile picture" />
          {img && <>
            <Field label="Zoom"><input type="range" min="1" max="3" step="0.05" value={zoom} onChange={(e) => setZoom(Number(e.target.value))} /></Field>
            <Field label="Move left / right"><input type="range" min="-1" max="1" step="0.02" value={pos.x} onChange={(e) => setPos({ ...pos, x: Number(e.target.value) })} /></Field>
            <Field label="Move up / down"><input type="range" min="-1" max="1" step="0.02" value={pos.y} onChange={(e) => setPos({ ...pos, y: Number(e.target.value) })} /></Field>
            <div className="row"><button className="btn btn-primary" onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save picture'}</button><button className="btn" onClick={() => setImg(null)}>Cancel</button></div>
          </>}
          {!img && <p className="hint" style={{ marginTop: '.5rem' }}>We crop and resize to a square before upload. {user.avatar_url && <button className="btn btn-sm" onClick={remove}>Remove picture</button>}</p>}
        </div>
      </div>
    </section>
  );
}

function PasswordCard() {
  const toast = useToast();
  const [f, setF] = useState({ current_password: '', new_password: '', confirm: '' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault(); setErr('');
    if (f.new_password !== f.confirm) { setErr('The new passwords do not match.'); return; }
    setBusy(true);
    try { await api.post('/me/password', { current_password: f.current_password, new_password: f.new_password }); toast('Password changed'); setF({ current_password: '', new_password: '', confirm: '' }); }
    catch (x) { setErr(x.message); } finally { setBusy(false); }
  };
  return (
    <form className="card" onSubmit={submit} noValidate>
      <h2>Change password</h2>
      {err && <Banner tone="error">{err}</Banner>}
      <Field label="Current password"><input type="password" autoComplete="current-password" value={f.current_password} onChange={(e) => setF({ ...f, current_password: e.target.value })} /></Field>
      <div className="grid-2">
        <Field label="New password" hint="At least 10 characters, with a letter and a number."><input type="password" autoComplete="new-password" value={f.new_password} onChange={(e) => setF({ ...f, new_password: e.target.value })} /></Field>
        <Field label="Confirm new password"><input type="password" autoComplete="new-password" value={f.confirm} onChange={(e) => setF({ ...f, confirm: e.target.value })} /></Field>
      </div>
      <button className="btn" disabled={busy}>{busy ? 'Updating…' : 'Update password'}</button>
    </form>
  );
}

export default function Profile() {
  const { user, setUser } = useAuth();
  const toast = useToast();
  const [f, setF] = useState({ display_name: user.display_name, job_title: user.job_title, department: user.department, bio: user.bio, phone: user.phone, location: user.location, interests: user.interests });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const submit = async (e) => {
    e.preventDefault(); setErr(''); setBusy(true);
    try { const d = await api.put('/me', f); setUser(d.user); toast('Profile saved'); } catch (x) { setErr(x.message); } finally { setBusy(false); }
  };
  return (
    <>
      <PageHeader title="Profile setup" subtitle="Tell your team who you are. Your manager is set by an Admin." />
      <div className="stack">
        <AvatarEditor />
        <form className="card" onSubmit={submit} noValidate>
          <h2>Your details</h2>
          {err && <Banner tone="error">{err}</Banner>}
          <div className="grid-2">
            <Field label="Display name"><input value={f.display_name} onChange={set('display_name')} maxLength={80} /></Field>
            <Field label="Email" hint="Your sign-in email can’t be changed."><input value={user.email} disabled /></Field>
            <Field label="Job title"><input value={f.job_title} onChange={set('job_title')} maxLength={120} /></Field>
            <Field label="Department"><input value={f.department} onChange={set('department')} maxLength={120} /></Field>
            <Field label="Reporting manager" hint="Set by an Admin. This person approves your plans."><input value={user.manager_name || 'Not assigned yet'} disabled /></Field>
            <Field label="Phone"><input type="tel" value={f.phone} onChange={set('phone')} maxLength={40} /></Field>
            <Field label="Location"><input value={f.location} onChange={set('location')} maxLength={120} /></Field>
            <Field label="Skills and interests" hint="Comma-separated, e.g. React, mentoring, public speaking"><input value={f.interests} onChange={set('interests')} maxLength={300} /></Field>
          </div>
          <Field label="Bio"><textarea value={f.bio} onChange={set('bio')} maxLength={1000} /></Field>
          <button className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save profile'}</button>
        </form>
        <PasswordCard />
      </div>
    </>
  );
}
