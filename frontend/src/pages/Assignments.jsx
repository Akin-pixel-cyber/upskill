import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { Async, Badge, Empty, Icon, PageHeader, StatusBadge, dueLabel, fmtDate, useAsync, useToast } from '../ui.jsx';

export default function Assignments() {
  const state = useAsync(() => api.get('/assignments/mine'), []);
  const toast = useToast();
  const [filter, setFilter] = useState('open');
  const [busy, setBusy] = useState('');

  const setStatus = async (a, status) => {
    setBusy(a.id);
    try { await api.patch(`/assignments/${a.id}`, { status }); toast(status === 'completed' ? 'Marked complete' : 'Status updated'); state.reload(); }
    catch (e) { toast(e.message, 'err'); } finally { setBusy(''); }
  };

  return (
    <>
      <PageHeader title="My assignments" subtitle="Courses assigned to you by HR. Mark them complete as you finish."
        actions={state.data && <Badge tone="neutral">Total: {state.data.items.length}</Badge>} />
      <Async state={state} label="Loading assignments…">{(d) => {
        const list = d.items.filter((a) => (filter === 'all' ? true : filter === 'open' ? a.status !== 'completed' : a.status === 'completed'));
        const overdue = d.items.filter((a) => a.overdue).length;
        return (
          <>
            {overdue > 0 && <div className="banner banner-error"><strong>{overdue} overdue.</strong> Finish these first or share a check-in explaining what’s blocking you.</div>}
            <div className="tabs" role="tablist">
              {[['open', 'Open'], ['completed', 'Completed'], ['all', 'All']].map(([v, l]) => <button key={v} className={filter === v ? 'on' : ''} onClick={() => setFilter(v)}>{l}</button>)}
            </div>
            {d.items.length === 0 ? <div className="card"><Empty icon="book" title="No courses assigned yet">When HR assigns you a course it will appear here and you’ll get a notification.</Empty></div>
              : list.length === 0 ? <div className="card"><Empty icon="check" title={filter === 'open' ? 'Nothing open. Nice work!' : 'Nothing here yet'} /></div>
              : list.map((a) => (
                <div className="card" key={a.id}>
                  <div className="row-between">
                    <div style={{ flex: 1, minWidth: 220 }}>
                      <h2 style={{ margin: 0 }}>{a.title}</h2>
                      {a.description && <p className="muted" style={{ margin: '.3rem 0' }}>{a.description}</p>}
                      <div className="row small muted">
                        <span><Icon name="calendar" size={14} /> Deadline {fmtDate(a.deadline)}{a.status !== 'completed' && ` (${dueLabel(a.deadline + 'T23:59:00')})`}</span>
                        <span>· Assigned by {a.assigned_by_name || 'HR'}</span>
                        {a.link && <a href={a.link} target="_blank" rel="noopener noreferrer"><Icon name="link" size={14} /> Open course</a>}
                      </div>
                    </div>
                    <div className="row">
                      {a.overdue && <Badge tone="red">Overdue</Badge>}<StatusBadge status={a.status} />
                    </div>
                  </div>
                  <div className="row" style={{ marginTop: '.9rem' }}>
                    {a.status === 'not_started' && <button className="btn btn-sm" disabled={busy === a.id} onClick={() => setStatus(a, 'in_progress')}>Start</button>}
                    {a.status !== 'completed' && <button className="btn btn-sm btn-primary" disabled={busy === a.id} onClick={() => setStatus(a, 'completed')}>Mark complete</button>}
                    {a.status !== 'completed' && <Link className="btn btn-sm" to="/checkin">Share progress</Link>}
                    {a.status === 'completed' && <button className="btn btn-sm" disabled={busy === a.id} onClick={() => setStatus(a, 'in_progress')}>Reopen</button>}
                  </div>
                </div>
              ))}
          </>
        );
      }}</Async>
    </>
  );
}
