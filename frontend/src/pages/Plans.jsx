import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { Async, Banner, Icon, PageHeader, ProgressBar, StatusBadge, cadenceLabel, fmtDate, fmtDateTime, useAsync } from '../ui.jsx';

function Row({ p }) {
  return (
    <div className="plan-row">
      <div>
        <Link to={`/plans/${p.id}`}><b>{p.title}</b></Link>
        <div className="muted small">{p.items_total} items · {cadenceLabel(p.cadence_days)} · updated {fmtDate(p.updated_at)}</div>
        {p.status === 'rejected' && p.manager_comment && <div className="small" style={{ color: 'var(--coral)', marginTop: '.2rem' }}>Manager: {p.manager_comment}</div>}
      </div>
      <div className="row"><StatusBadge status={p.status} /><Link className="btn btn-sm" to={`/plans/${p.id}`}>{p.status === 'draft' || p.status === 'rejected' ? 'Edit' : 'View'}</Link></div>
    </div>
  );
}

export default function Plans() {
  const state = useAsync(() => api.get('/plans'), []);
  return (
    <>
      <PageHeader title="Track your plan" subtitle="Draft, submit, and follow your upskill roadmap."
        actions={<Link className="btn btn-primary" to="/interview"><Icon name="sparkles" size={16} />Start new interview</Link>} />
      <Async state={state}>{(d) => (
        <>
          {d.active?.overdue && <Banner tone="error"><strong>Check-in overdue.</strong> It was due {fmtDateTime(d.active.next_due)}. <Link to="/checkin">Submit a check-in</Link>.</Banner>}
          <div className="cols">
            <section className="card">
              <div className="row"><Icon name="target" /><h2 style={{ margin: 0 }}>Active plan</h2></div>
              {d.active ? (
                <div style={{ marginTop: '.8rem' }}>
                  <Link to={`/plans/${d.active.id}`}><b style={{ fontSize: '1.1rem' }}>{d.active.title}</b></Link>
                  <div className="muted small" style={{ margin: '.2rem 0 .6rem' }}>{d.active.items_done} of {d.active.items_total} items complete · {cadenceLabel(d.active.cadence_days)} check-ins</div>
                  <ProgressBar done={d.active.items_done} total={d.active.items_total} />
                  <p className={d.active.overdue ? 'due-bad' : 'muted small'} style={{ marginTop: '.6rem' }}>Next check-in: {fmtDateTime(d.active.next_due)}{d.active.overdue && ' (overdue)'}</p>
                  <Link className="btn btn-sm" to={`/plans/${d.active.id}`}>Open plan</Link>
                </div>
              ) : (
                <div style={{ marginTop: '.6rem' }}>
                  <p className="muted">No active plan yet. Complete a skill interview to generate one, then submit it for approval.</p>
                  <Link to="/interview">Generate AI plan →</Link>
                </div>
              )}
            </section>
            <section className="card">
              <h2>Drafts &amp; pending approval</h2>
              {d.pending.length ? d.pending.map((p) => <Row key={p.id} p={p} />) : <p className="muted">No drafts or submissions right now.</p>}
            </section>
          </div>
          <section className="card">
            <h2>Plan history</h2>
            {d.history.length ? d.history.map((p) => <Row key={p.id} p={p} />) : <p className="muted">No past plans yet. Earlier plans appear here when a new one is approved.</p>}
          </section>
        </>
      )}</Async>
    </>
  );
}
