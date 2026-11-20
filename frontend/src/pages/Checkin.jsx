import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { Async, Badge, Banner, Empty, Icon, PageHeader, ProgressBar, StatusBadge, fmtDate, fmtDateTime, relTime, useAsync, useToast } from '../ui.jsx';

const blank = { progress: '', blockers: '', next_steps: '', link: '', done_ids: [], mark_complete: false };

function Form({ targets, onSubmitted }) {
  const { user } = useAuth();
  const toast = useToast();
  const KEY = `upskill-checkin-draft:${user.id}`;
  const options = [
    ...(targets.plan ? [{ value: `plan:${targets.plan.id}`, label: `Active plan: ${targets.plan.title}` }] : []),
    ...targets.assignments.map((a) => ({ value: `assignment:${a.id}`, label: `HR assignment: ${a.title}` })),
  ];
  const saved = (() => { try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { return null; } })();
  const [target, setTarget] = useState(options.find((o) => o.value === saved?.target)?.value || options[0].value);
  const [f, setF] = useState(saved?.f ? { ...blank, ...saved.f } : blank);
  const [mode, setMode] = useState('file');
  const [file, setFile] = useState(null);
  const [savedAt, setSavedAt] = useState(saved ? new Date() : null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const fileRef = useRef(null);

  const [type, id] = target.split(':');
  const ctxPlan = type === 'plan' ? targets.plan : null;
  const ctxAsg = type === 'assignment' ? targets.assignments.find((a) => a.id === id) : null;

  useEffect(() => {
    const t = setTimeout(() => {
      try {
        if (f.progress || f.blockers || f.next_steps || f.link) { localStorage.setItem(KEY, JSON.stringify({ target, f })); setSavedAt(new Date()); }
      } catch { /* storage unavailable */ }
    }, 500);
    return () => clearTimeout(t);
  }, [f, target, KEY]);

  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const submit = async (e) => {
    e.preventDefault(); setErr('');
    if (f.progress.trim().length < 3) { setErr('Tell us what progress you made.'); return; }
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('target_type', type); fd.append('target_id', id);
      fd.append('progress', f.progress); fd.append('blockers', f.blockers); fd.append('next_steps', f.next_steps);
      if (mode === 'link' && f.link) fd.append('link', f.link);
      if (mode === 'file' && file) fd.append('file', file);
      fd.append('mark_complete', String(f.mark_complete));
      fd.append('complete_item_ids', JSON.stringify(f.done_ids));
      await api.post('/checkins', fd, { timeout: 60000 });
      localStorage.removeItem(KEY);
      toast('Check-in submitted');
      setF(blank); setFile(null); setSavedAt(null);
      onSubmitted();
    } catch (x) { setErr(x.message); } finally { setBusy(false); }
  };

  const items = ctxPlan?.items || [];
  const doneCount = items.filter((i) => i.completed_at).length;

  return (
    <>
      <PageHeader title="Share your progress" subtitle="Submit progress updates as often as you like. Items only close when you mark them complete."
        actions={savedAt && <span className="saved"><Icon name="check" size={14} />Autosaved locally</span>} />
      <div className="checkin">
        <aside className="card">
          <div className="eyebrow">{ctxPlan ? 'Active plan' : 'HR assignment'}</div>
          <h2 style={{ margin: '.2rem 0 .6rem' }}>{ctxPlan ? ctxPlan.title : ctxAsg?.title}</h2>
          {ctxAsg && <>
            <p className="muted small"><Icon name="calendar" size={14} /> Assigned by {ctxAsg.assigned_by_name || 'HR'} · deadline {fmtDate(ctxAsg.deadline)} {ctxAsg.overdue && <Badge tone="red">Overdue</Badge>}</p>
            {ctxAsg.description && <p className="muted">{ctxAsg.description}</p>}
            {ctxAsg.link && <p><a href={ctxAsg.link} target="_blank" rel="noopener noreferrer"><Icon name="link" size={14} /> Open course</a></p>}
            <StatusBadge status={ctxAsg.status} />
          </>}
          {ctxPlan && <>
            <p className="muted small">Approved by {ctxPlan.approved_by || 'your manager'} · next check-in {fmtDateTime(ctxPlan.next_due)} {ctxPlan.overdue && <Badge tone="red">Overdue</Badge>}</p>
            <div className="eyebrow" style={{ marginTop: '.8rem' }}>Progress</div>
            <div style={{ margin: '.3rem 0 .6rem' }}><b>{doneCount}/{items.length}</b> items complete</div>
            <ProgressBar done={doneCount} total={items.length} />
            <div className="eyebrow" style={{ margin: '1rem 0 .4rem' }}>Plan items</div>
            <div style={{ maxHeight: 280, overflowY: 'auto' }}>
              {items.map((it, i) => <div key={it.id} className="row small" style={{ padding: '.3rem 0' }}><Badge tone={it.completed_at ? 'green' : 'neutral'}>{it.completed_at ? 'Done' : 'Open'}</Badge><span>{i + 1}. {it.title}</span></div>)}
            </div>
          </>}
          <div className="banner banner-warn small" style={{ marginTop: '1rem', marginBottom: 0 }}>Progress updates can be submitted repeatedly. This only closes when you mark it complete.</div>
        </aside>

        <form className="card" onSubmit={submit} noValidate>
          {err && <Banner tone="error">{err}</Banner>}
          <label className="field"><span className="field-label">Check-in target</span>
            <select value={target} onChange={(e) => setTarget(e.target.value)}>{options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select>
          </label>
          <label className="field"><span className="field-label">Progress</span><textarea value={f.progress} onChange={set('progress')} placeholder="What progress did you make?" maxLength={5000} rows={4} /></label>
          <label className="field"><span className="field-label">Blockers</span><textarea value={f.blockers} onChange={set('blockers')} placeholder="What’s currently blocking your progress?" maxLength={5000} rows={3} /></label>
          <label className="field"><span className="field-label">Next steps</span><textarea value={f.next_steps} onChange={set('next_steps')} placeholder="What are your next steps until the next check-in?" maxLength={5000} rows={3} /></label>

          <div className="field">
            <span className="field-label">Evidence</span>
            <div className="tabs" role="tablist">
              <button type="button" role="tab" aria-selected={mode === 'file'} className={mode === 'file' ? 'on' : ''} onClick={() => setMode('file')}><Icon name="upload" size={15} />Upload file</button>
              <button type="button" role="tab" aria-selected={mode === 'link'} className={mode === 'link' ? 'on' : ''} onClick={() => setMode('link')}><Icon name="link" size={15} />Add link</button>
            </div>
            {mode === 'file' ? (
              <>
                <input ref={fileRef} type="file" accept="image/*,.pdf,.docx,.xlsx,.pptx" onChange={(e) => {
                  const x = e.target.files?.[0];
                  if (x && x.size > 10 * 1024 * 1024) { setErr('That file is over 10 MB. Add a link instead.'); e.target.value = ''; setFile(null); } else setFile(x || null);
                }} />
                <span className="hint">Images, PDF, Word, Excel or PowerPoint, up to 10 MB.</span>
              </>
            ) : <input type="url" placeholder="https://…" value={f.link} onChange={set('link')} />}
          </div>

          {ctxPlan && items.some((i) => !i.completed_at) && (
            <div className="field">
              <span className="field-label">Mark plan items complete (optional)</span>
              {items.filter((i) => !i.completed_at).map((it) => (
                <label key={it.id} className="check small" style={{ marginBottom: '.3rem' }}>
                  <input type="checkbox" checked={f.done_ids.includes(it.id)} onChange={(e) => setF({ ...f, done_ids: e.target.checked ? [...f.done_ids, it.id] : f.done_ids.filter((x) => x !== it.id) })} />
                  <span>{it.title}</span>
                </label>
              ))}
            </div>
          )}
          {ctxAsg && <label className="check" style={{ marginBottom: '1rem' }}><input type="checkbox" checked={f.mark_complete} onChange={(e) => setF({ ...f, mark_complete: e.target.checked })} /><span><b>Mark this assignment complete</b><br /><span className="muted small">Leave unchecked to just share progress.</span></span></label>}

          <button className="btn btn-primary" disabled={busy}>{busy ? 'Submitting…' : 'Submit check-in'}</button>
        </form>
      </div>
    </>
  );
}

export default function Checkin() {
  const targets = useAsync(() => api.get('/checkins/targets'), []);
  const recent = useAsync(() => api.get('/checkins/mine'), []);
  const reloadAll = () => { targets.reload(); recent.reload(); };

  return (
    <>
      <Async state={targets}>{(t) => (t.plan || t.assignments.length) ? <Form targets={t} onSubmitted={reloadAll} /> : (
        <>
          <PageHeader title="Share your progress" subtitle="Submit progress updates until you explicitly mark the work complete." />
          <div className="card"><Empty icon="clipboard" title="Nothing to check in on yet" action={<div className="row"><Link className="btn btn-primary" to="/interview">Start skill interview</Link><Link className="btn" to="/plans">View my plans</Link></div>}>
            You need an approved plan or an assignment from HR before you can submit a check-in.
          </Empty></div>
        </>
      )}</Async>
      <h2 style={{ margin: '1.6rem 0 .7rem' }}>Recent check-ins</h2>
      <Async state={recent}>{(d) => d.items.length ? d.items.map((c) => (
        <div key={c.id} className="card" style={{ marginTop: '.6rem' }}>
          <div className="row-between"><b>{c.target}</b><span className="muted small">{relTime(c.created_at)}</span></div>
          <p style={{ margin: '.4rem 0' }}>{c.progress}</p>
          {c.blockers && <p className="small muted"><b>Blockers:</b> {c.blockers}</p>}
          {c.next_steps && <p className="small muted"><b>Next:</b> {c.next_steps}</p>}
          <div className="row small">
            {c.evidence_file && <a href={`/api/files/evidence/${c.evidence_file}`} target="_blank" rel="noopener noreferrer"><Icon name="upload" size={13} /> {c.evidence_name || 'Evidence file'}</a>}
            {c.evidence_link && <a href={c.evidence_link} target="_blank" rel="noopener noreferrer"><Icon name="link" size={13} /> Evidence link</a>}
          </div>
        </div>
      )) : <p className="muted">Your submitted check-ins will show up here.</p>}</Async>
    </>
  );
}
