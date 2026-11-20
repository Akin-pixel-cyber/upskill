import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { Async, Avatar, Banner, CADENCES, Empty, Icon, PageHeader, ProgressBar, StatusBadge, cadenceLabel, fmtDate, fmtDateTime, useAsync, useToast } from '../ui.jsx';

const blank = (n) => ({ key: Math.random(), title: '', description: '', resource_title: '', resource_url: '', due_date: '', week: n });

function ItemView({ it, canToggle, onToggle, busy }) {
  const done = !!it.completed_at;
  return (
    <div className={`item-card ${done ? 'item-done' : ''}`}>
      <div className="check">
        {canToggle && <input type="checkbox" checked={done} disabled={busy} onChange={() => onToggle(it)} aria-label={`Mark "${it.title}" ${done ? 'incomplete' : 'complete'}`} />}
        <div style={{ flex: 1 }}>
          <div className="item-title">{it.title}</div>
          {it.description && <div className="muted">{it.description}</div>}
          <div className="item-meta">
            <span>Week {it.week}</span>{it.due_date && <span>· Due {fmtDate(it.due_date)}</span>}
            {it.resource_url && <a href={it.resource_url} target="_blank" rel="noopener noreferrer"><Icon name="link" size={13} /> {it.resource_title || 'Resource'}</a>}
            {done && <span>· Completed {fmtDate(it.completed_at)}</span>}
          </div>
        </div>
      </div>
    </div>
  );
}

function Editor({ data, onSaved }) {
  const nav = useNavigate();
  const toast = useToast();
  const { plan } = data;
  const [title, setTitle] = useState(plan.title);
  const [cadence, setCadence] = useState(plan.cadence_days);
  const [items, setItems] = useState(data.items.map((i) => ({ ...i, key: i.id })));
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');

  useEffect(() => { setTitle(plan.title); setCadence(plan.cadence_days); setItems(data.items.map((i) => ({ ...i, key: i.id }))); }, [data]);

  const upd = (key, patch) => setItems((l) => l.map((i) => (i.key === key ? { ...i, ...patch } : i)));
  const move = (idx, d) => setItems((l) => { const n = [...l]; const j = idx + d; if (j < 0 || j >= n.length) return l; [n[idx], n[j]] = [n[j], n[idx]]; return n; });
  const body = () => ({ title, cadence_days: Number(cadence), items: items.map(({ title, description, resource_title, resource_url, due_date, week }) => ({ title, description: description || '', resource_title: resource_title || '', resource_url: resource_url || '', due_date: due_date || null, week: Number(week) || 1 })) });

  const save = async (quiet) => { await api.put(`/plans/${plan.id}`, body()); if (!quiet) toast('Draft saved'); };
  const run = (name, fn) => async () => { setBusy(name); setErr(''); try { await fn(); } catch (e) { setErr(e.message); } finally { setBusy(''); } };
  const onSave = run('save', async () => { await save(); onSaved(); });
  const onSubmit = run('submit', async () => {
    await save(true);
    const r = await api.post(`/plans/${plan.id}/submit`);
    toast(`Submitted to ${r.awaiting} for approval`);
    nav('/plans');
  });
  const onDelete = run('delete', async () => {
    if (!window.confirm('Delete this plan? This cannot be undone.')) return;
    await api.del(`/plans/${plan.id}`); toast('Plan deleted'); nav('/plans');
  });

  return (
    <>
      {err && <Banner tone="error">{err}</Banner>}
      <section className="card">
        <div className="grid-2">
          <label className="field"><span className="field-label">Plan title</span><input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} /></label>
          <label className="field"><span className="field-label">Check-in cadence</span><select value={cadence} onChange={(e) => setCadence(e.target.value)}>{CADENCES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
        </div>
      </section>
      <h2 style={{ margin: '1.4rem 0 .7rem' }}>Plan items ({items.length})</h2>
      {items.length === 0 && <Empty title="No items yet" icon="plus">Add at least one item before you submit.</Empty>}
      {items.map((it, idx) => (
        <div className="item-card" key={it.key}>
          <div className="edit-grid">
            <label className="field"><span className="field-label">Week</span><input type="number" min="1" max="60" value={it.week} onChange={(e) => upd(it.key, { week: e.target.value })} /></label>
            <label className="field"><span className="field-label">Title</span><input value={it.title} onChange={(e) => upd(it.key, { title: e.target.value })} maxLength={200} /></label>
            <label className="field"><span className="field-label">Due date</span><input type="date" value={it.due_date || ''} onChange={(e) => upd(it.key, { due_date: e.target.value })} /></label>
            <label className="field full"><span className="field-label">Description</span><textarea style={{ minHeight: 56 }} value={it.description || ''} onChange={(e) => upd(it.key, { description: e.target.value })} maxLength={1000} /></label>
            <label className="field" style={{ gridColumn: '1 / 3' }}><span className="field-label">Resource link</span><input type="url" placeholder="https://" value={it.resource_url || ''} onChange={(e) => upd(it.key, { resource_url: e.target.value })} /></label>
            <label className="field"><span className="field-label">Link label</span><input value={it.resource_title || ''} onChange={(e) => upd(it.key, { resource_title: e.target.value })} maxLength={200} /></label>
          </div>
          <div className="row">
            <button className="btn btn-sm" onClick={() => move(idx, -1)} disabled={idx === 0} aria-label="Move up"><Icon name="up" size={14} /></button>
            <button className="btn btn-sm" onClick={() => move(idx, 1)} disabled={idx === items.length - 1} aria-label="Move down"><Icon name="down" size={14} /></button>
            <button className="btn btn-sm btn-danger" onClick={() => setItems((l) => l.filter((i) => i.key !== it.key))}><Icon name="trash" size={14} />Remove</button>
          </div>
        </div>
      ))}
      <div className="row" style={{ marginTop: '1rem' }}>
        <button className="btn" onClick={() => setItems((l) => [...l, blank(l.length ? l[l.length - 1].week : 1)])}><Icon name="plus" size={16} />Add item</button>
      </div>
      <div className="row" style={{ marginTop: '1.4rem' }}>
        <button className="btn" onClick={onSave} disabled={!!busy}>{busy === 'save' ? 'Saving…' : 'Save draft'}</button>
        <button className="btn btn-primary" onClick={onSubmit} disabled={!!busy || !items.length}>{busy === 'submit' ? 'Submitting…' : 'Submit for approval'}</button>
        <button className="btn btn-danger" onClick={onDelete} disabled={!!busy}>Delete plan</button>
      </div>
    </>
  );
}

function Decision({ plan, onDone }) {
  const toast = useToast();
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const go = async (decision) => {
    setBusy(true); setErr('');
    try { await api.post(`/plans/${plan.id}/decision`, { decision, comment }); toast(decision === 'approve' ? 'Plan approved' : 'Plan sent back with your comment'); onDone(); }
    catch (e) { setErr(e.message); } finally { setBusy(false); }
  };
  return (
    <section className="card" style={{ marginBottom: '1rem' }}>
      <h2>Review this plan</h2>
      {err && <Banner tone="error">{err}</Banner>}
      <label className="field"><span className="field-label">Comment</span><textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Optional when approving, required when requesting changes." maxLength={2000} /></label>
      <div className="row">
        <button className="btn btn-primary" disabled={busy} onClick={() => go('approve')}>Approve</button>
        <button className="btn btn-danger" disabled={busy} onClick={() => go('reject')}>Request changes</button>
      </div>
    </section>
  );
}

export default function PlanDetail() {
  const { id } = useParams();
  const state = useAsync(() => api.get(`/plans/${id}`), [id]);
  const toast = useToast();
  const [busyItem, setBusyItem] = useState('');

  const toggle = async (it) => {
    setBusyItem(it.id);
    try { await api.patch(`/plans/items/${it.id}`, { completed: !it.completed_at }); state.reload(); }
    catch (e) { toast(e.message, 'err'); } finally { setBusyItem(''); }
  };

  return (
    <Async state={state}>{(d) => {
      const { plan, items, can } = d;
      return (
        <>
          <div className="row" style={{ marginBottom: '.6rem' }}><Link to="/plans" className="small">← All plans</Link></div>
          <PageHeader title={plan.title} subtitle={plan.summary} actions={<StatusBadge status={plan.status} />} />
          <div className="row small muted" style={{ marginBottom: '1rem' }}>
            <Avatar user={{ display_name: plan.owner_name, avatar_file: plan.owner_avatar }} size={24} />
            <span>{plan.owner_name}</span><span>·</span>
            <span>{plan.role_current} → {plan.role_target}</span><span>·</span>
            <span>{plan.hours_per_week} h/week, {plan.timeline_weeks} weeks</span><span>·</span>
            <span>{cadenceLabel(plan.cadence_days)} check-ins</span>
            {plan.source !== 'template' && <><span>·</span><span>AI-assisted draft</span></>}
          </div>

          {plan.status === 'rejected' && <Banner tone="warn"><strong>Changes requested.</strong> {plan.manager_comment || 'Your manager sent this plan back.'} Edit it below and resubmit.</Banner>}
          {plan.status === 'submitted' && <Banner tone="info">Submitted {fmtDateTime(plan.submitted_at)}. {plan.manager_name ? `Waiting for approval from ${plan.manager_name}.` : 'Waiting for an admin to approve (no reporting manager is set).'}</Banner>}
          {plan.status === 'approved' && plan.manager_comment && <Banner tone="ok">Approval comment: {plan.manager_comment}</Banner>}
          {plan.status === 'approved' && plan.overdue && <Banner tone="error"><strong>Check-in overdue</strong> since {fmtDateTime(plan.next_due)}.{can.toggle && <> <Link to="/checkin">Submit a check-in</Link>.</>}</Banner>}

          {can.decide && <Decision plan={plan} onDone={state.reload} />}

          {can.edit ? <Editor data={d} onSaved={state.reload} /> : (
            <>
              {plan.status === 'approved' && (
                <section className="card" style={{ marginBottom: '1rem' }}>
                  <div className="row-between small muted" style={{ marginBottom: '.4rem' }}><span>{plan.items_done} of {plan.items_total} items complete</span><span>Next check-in {fmtDateTime(plan.next_due)}</span></div>
                  <ProgressBar done={plan.items_done} total={plan.items_total} />
                  {can.toggle && <div style={{ marginTop: '.8rem' }}><Link className="btn btn-sm" to="/checkin">New check-in</Link></div>}
                </section>
              )}
              {items.map((it) => <ItemView key={it.id} it={it} canToggle={can.toggle} onToggle={toggle} busy={busyItem === it.id} />)}
            </>
          )}
        </>
      );
    }}</Async>
  );
}
