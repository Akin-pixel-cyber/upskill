import { Fragment, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { Async, Avatar, Badge, Empty, Icon, PageHeader, ProgressBar, StatusBadge, cadenceLabel, fmtDate, fmtDateTime, relTime, useAsync, useToast } from '../ui.jsx';

function Approval({ a, onDone }) {
  const toast = useToast();
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const go = async (decision) => {
    setBusy(true); setErr('');
    try { await api.post(`/plans/${a.id}/decision`, { decision, comment }); toast(decision === 'approve' ? 'Plan approved' : 'Plan sent back'); onDone(); }
    catch (e) { setErr(e.message); setBusy(false); }
  };
  return (
    <div className="item-card">
      <div className="row-between">
        <div className="person"><Avatar user={{ display_name: a.display_name, avatar_file: a.avatar_file }} /><div><b>{a.display_name}</b><small>{a.role_current} → {a.role_target}</small></div></div>
        <span className="muted small">Submitted {relTime(a.submitted_at)}</span>
      </div>
      <p style={{ margin: '.7rem 0 .4rem' }}><b>{a.title}</b> <span className="muted small">· {a.items_total} items</span> · <Link to={`/plans/${a.id}`}>View full plan</Link></p>
      <textarea style={{ minHeight: 56 }} placeholder="Comment (required if you request changes)" value={comment} onChange={(e) => setComment(e.target.value)} maxLength={2000} />
      {err && <div className="field-error" style={{ marginTop: '.4rem' }}>{err}</div>}
      <div className="row" style={{ marginTop: '.6rem' }}>
        <button className="btn btn-sm btn-primary" disabled={busy} onClick={() => go('approve')}>Approve</button>
        <button className="btn btn-sm btn-danger" disabled={busy} onClick={() => go('reject')}>Request changes</button>
      </div>
    </div>
  );
}

function Detail({ id }) {
  const state = useAsync(() => api.get(`/team/${id}`), [id]);
  return (
    <Async state={state}>{(d) => (
      <div style={{ padding: '.4rem .2rem 1rem' }}>
        <h3>Recent check-ins</h3>
        {d.checkins.length ? d.checkins.map((c) => (
          <div key={c.id} className="item-card">
            <div className="row-between small"><b>{c.target}</b><span className="muted">{fmtDateTime(c.created_at)}</span></div>
            <p style={{ margin: '.3rem 0' }}>{c.progress}</p>
            {c.blockers && <p className="small muted"><b>Blockers:</b> {c.blockers}</p>}
            {c.next_steps && <p className="small muted"><b>Next:</b> {c.next_steps}</p>}
            <div className="row small">
              {c.evidence_file && <a href={`/api/files/evidence/${c.evidence_file}`} target="_blank" rel="noopener noreferrer">{c.evidence_name || 'Evidence file'}</a>}
              {c.evidence_link && <a href={c.evidence_link} target="_blank" rel="noopener noreferrer">Evidence link</a>}
            </div>
          </div>
        )) : <p className="muted">No check-ins yet.</p>}
        <h3 style={{ marginTop: '1rem' }}>Assignments</h3>
        {d.assignments.length ? d.assignments.map((a) => (
          <div key={a.id} className="row small" style={{ padding: '.25rem 0' }}><StatusBadge status={a.status} />{a.overdue && <Badge tone="red">Overdue</Badge>}<span>{a.title}</span><span className="muted">due {fmtDate(a.deadline)}</span></div>
        )) : <p className="muted">No assignments.</p>}
        {d.plans.map((p) => <p key={p.id} className="small"><Link to={`/plans/${p.id}`}>Open plan: {p.title}</Link></p>)}
      </div>
    )}</Async>
  );
}

export default function Team() {
  const state = useAsync(() => api.get('/team'), []);
  const [open, setOpen] = useState(null);
  return (
    <>
      <PageHeader title="Team" subtitle="Approve plans and keep an eye on your direct reports’ progress." />
      <Async state={state}>{(d) => (
        <>
          <section className="card">
            <h2>Pending approvals {d.approvals.length > 0 && <Badge tone="amber">{d.approvals.length}</Badge>}</h2>
            {d.approvals.length ? d.approvals.map((a) => <Approval key={a.id} a={a} onDone={state.reload} />) : <Empty icon="check" title="Nothing waiting for you">New plans from your team will appear here.</Empty>}
          </section>
          <section className="card">
            <h2>Direct reports</h2>
            {d.reports.length === 0 ? <Empty icon="users" title="No direct reports yet">An admin sets who reports to you from the Admin page.</Empty> : (
              <div className="table-wrap"><table>
                <thead><tr><th>Person</th><th>Active plan</th><th>Last check-in</th><th>Next due</th><th>Assignments</th><th /></tr></thead>
                <tbody>{d.reports.map((r) => (
                  <Fragment key={r.id}>
                    <tr>
                      <td><div className="person"><Avatar user={r} /><div><b>{r.display_name}</b><small>{r.job_title || r.email}</small></div></div></td>
                      <td>{r.plan ? <div style={{ minWidth: 160 }}><Link to={`/plans/${r.plan.id}`}>{r.plan.title}</Link><div className="small muted">{r.plan.items_done}/{r.plan.items_total} · {cadenceLabel(r.plan.cadence_days)}</div><ProgressBar done={r.plan.items_done} total={r.plan.items_total} /></div> : <span className="muted">No active plan</span>}</td>
                      <td>{r.last_checkin_at ? relTime(r.last_checkin_at) : <span className="muted">None</span>}</td>
                      <td>{r.plan ? (r.plan.overdue ? <Badge tone="red">Overdue · {fmtDate(r.plan.next_due)}</Badge> : <span>{fmtDate(r.plan.next_due)}</span>) : '—'}</td>
                      <td className="small">{r.assignments.open} open{r.assignments.overdue > 0 && <> · <Badge tone="red">{r.assignments.overdue} overdue</Badge></>}<br /><span className="muted">{r.assignments.done} done</span></td>
                      <td><button className="btn btn-sm" onClick={() => setOpen(open === r.id ? null : r.id)} aria-expanded={open === r.id}>{open === r.id ? 'Hide' : 'Details'}</button></td>
                    </tr>
                    {open === r.id && <tr><td colSpan={6}><Detail id={r.id} /></td></tr>}
                  </Fragment>
                ))}</tbody>
              </table></div>
            )}
          </section>
        </>
      )}</Async>
    </>
  );
}
