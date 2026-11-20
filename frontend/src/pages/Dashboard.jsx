import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { Async, Badge, Banner, Icon, PageHeader, ProgressBar, cadenceLabel, dueLabel, fmtDate, fmtDateTime, useAsync } from '../ui.jsx';

export default function Dashboard() {
  const { user } = useAuth();
  const state = useAsync(() => api.get('/dashboard'), []);
  const first = user.display_name.split(' ')[0];

  return (
    <>
      <PageHeader title={`Welcome, ${first}`} subtitle="Track your plan and next check-in at a glance." />
      <Async state={state}>{(d) => {
        const p = d.active_plan;
        const a = d.assignments;
        return (
          <>
            {p?.overdue && <Banner tone="error"><strong>Your check-in is overdue.</strong> It was due {fmtDateTime(p.next_due)} ({dueLabel(p.next_due)}). <Link to="/checkin">Submit it now</Link>.</Banner>}
            {a.overdue > 0 && <Banner tone="error"><strong>{a.overdue} assigned course{a.overdue > 1 ? 's are' : ' is'} past deadline.</strong> <Link to="/assignments">Review assignments</Link>.</Banner>}
            {d.plan_states.rejected > 0 && <Banner tone="warn">A plan was sent back with comments. <Link to="/plans">Revise and resubmit</Link>.</Banner>}

            <section className="card">
              <div className="row-between">
                <div>
                  <div className="eyebrow">Active plan</div>
                  <h2 style={{ fontSize: '1.6rem', margin: '.2rem 0' }}>{p ? p.title : 'No active plan yet'}</h2>
                </div>
                {p && <Link className="btn" to={`/plans/${p.id}`}>Open plan</Link>}
              </div>
              {p ? (
                <div style={{ maxWidth: 520 }}>
                  <div className="row-between small muted" style={{ marginBottom: '.3rem' }}><span>{p.items_done} of {p.items_total} items complete</span><span>{p.items_total ? Math.round(p.items_done / p.items_total * 100) : 0}%</span></div>
                  <ProgressBar done={p.items_done} total={p.items_total} />
                </div>
              ) : (
                <>
                  <p className="muted">
                    {d.plan_states.submitted ? 'Your plan is waiting for manager approval.' : d.plan_states.draft ? 'You have a draft plan ready to review and submit.' : 'Start a skill interview and we’ll draft a plan for you to review.'}
                  </p>
                  <Link className="btn btn-primary" to={d.plan_states.submitted || d.plan_states.draft ? '/plans' : '/interview'}>
                    {d.plan_states.submitted || d.plan_states.draft ? 'View my plans' : 'Generate a plan'}<Icon name="arrow" size={16} />
                  </Link>
                </>
              )}

              <div className="timeline">
                <div className="tl-node">
                  <div className="tl-dot"><Icon name="check" size={22} /></div>
                  <div className="eyebrow">Check-in cadence</div>
                  <div className="tl-big">{p ? cadenceLabel(p.cadence_days) : '—'}</div>
                  <div className="muted small">{p ? 'Stay consistent with regular progress updates.' : 'Set when you create a plan.'}</div>
                  {p && <Link className="btn btn-sm" to="/checkin">New check-in</Link>}
                </div>
                <div className="tl-node">
                  <div className={`tl-dot ${p?.overdue ? 'bad' : ''}`}><Icon name="calendar" size={22} /></div>
                  <div className="eyebrow">Last check-in</div>
                  <div className="tl-big">{d.last_checkin_at ? fmtDate(d.last_checkin_at) : p ? 'None yet' : '—'}</div>
                  {p && <><div className="muted small">Next due</div>
                    <div className={p.overdue ? 'due-bad' : ''}>{fmtDateTime(p.next_due)}{p.overdue && ' · overdue'}</div>
                    <Link className={`btn btn-sm ${p.overdue ? 'btn-danger' : ''}`} to="/checkin">Submit check-in</Link></>}
                </div>
                <div className="tl-node">
                  <div className="tl-dot focus"><Icon name="target" size={22} /></div>
                  <div className="eyebrow">Focus this week</div>
                  <div className="tl-big">{d.focus ? d.focus.title : p ? 'All items done' : '—'}</div>
                  <div className="muted small">{d.focus ? (d.focus.due_date ? `Due ${fmtDate(d.focus.due_date)}` : d.focus.description) : p ? 'Great work. Ask your manager about next steps.' : 'Pick a plan item from your roadmap.'}</div>
                  {p && <Link className="btn btn-sm" to={`/plans/${p.id}`}>View details</Link>}
                </div>
              </div>
            </section>

            <h2 style={{ marginTop: '1.6rem' }}>Quick actions</h2>
            <div className="quick">
              <Link to="/checkin"><span className="qi"><Icon name="clipboard" /></span><span><b>Submit check-in</b><small>Share progress, blockers and next steps</small></span><Icon className="go" name="arrow" /></Link>
              <Link to="/interview"><span className="qi"><Icon name="sparkles" /></span><span><b>Start skill interview</b><small>Answer a few questions to draft a plan</small></span><Icon className="go" name="arrow" /></Link>
              <Link to="/assignments"><span className="qi"><Icon name="book" /></span><span><b>My assignments</b><small>{a.open ? `${a.open} open${a.overdue ? `, ${a.overdue} overdue` : ''}` : 'No open courses'}{d.next_assignment ? ` · next: ${d.next_assignment.title}` : ''}</small></span>{a.overdue > 0 && <Badge tone="red">Overdue</Badge>}</Link>
              {['manager', 'admin'].includes(user.role) && <Link to="/team"><span className="qi"><Icon name="users" /></span><span><b>Approvals</b><small>{d.pending_approvals ? `${d.pending_approvals} plan${d.pending_approvals > 1 ? 's' : ''} waiting for you` : 'Nothing waiting'}</small></span>{d.pending_approvals > 0 && <Badge tone="amber">{d.pending_approvals}</Badge>}</Link>}
              {['hr', 'admin'].includes(user.role) && <Link to="/assign"><span className="qi"><Icon name="calendar" /></span><span><b>Assign courses</b><small>Give people courses with deadlines</small></span><Icon className="go" name="arrow" /></Link>}
            </div>
          </>
        );
      }}</Async>
    </>
  );
}
