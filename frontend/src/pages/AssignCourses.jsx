import { useMemo, useState } from 'react';
import { api } from '../api.js';
import { Async, Badge, Banner, Empty, Field, PageHeader, StatusBadge, fmtDate, useAsync, useToast } from '../ui.jsx';

const today = () => new Date().toISOString().slice(0, 10);

function NewAssignment({ users, onCreated }) {
  const toast = useToast();
  const [f, setF] = useState({ title: '', description: '', link: '', deadline: '', user_ids: [] });
  const [search, setSearch] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const shown = useMemo(() => users.filter((u) => `${u.display_name} ${u.email}`.toLowerCase().includes(search.toLowerCase())), [users, search]);
  const toggle = (id) => setF((x) => ({ ...x, user_ids: x.user_ids.includes(id) ? x.user_ids.filter((i) => i !== id) : [...x.user_ids, id] }));
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault(); setErr(''); setBusy(true);
    try {
      const r = await api.post('/assignments', f);
      toast(`Assigned to ${r.created} ${r.created === 1 ? 'person' : 'people'}`);
      setF({ title: '', description: '', link: '', deadline: '', user_ids: [] });
      onCreated();
    } catch (x) { setErr(x.message); } finally { setBusy(false); }
  };

  return (
    <form className="card" onSubmit={submit} noValidate>
      <h2>Assign a course</h2>
      {err && <Banner tone="error">{err}</Banner>}
      <Field label="Course title"><input value={f.title} onChange={set('title')} maxLength={200} /></Field>
      <Field label="Description" hint="Optional"><textarea value={f.description} onChange={set('description')} maxLength={2000} /></Field>
      <div className="grid-2">
        <Field label="Course link" hint="Optional"><input type="url" placeholder="https://" value={f.link} onChange={set('link')} /></Field>
        <Field label="Deadline"><input type="date" min={today()} value={f.deadline} onChange={set('deadline')} /></Field>
      </div>
      <div className="field">
        <span className="field-label">Assign to ({f.user_ids.length} selected)</span>
        <input placeholder="Search people" value={search} onChange={(e) => setSearch(e.target.value)} style={{ marginBottom: '.5rem' }} />
        <div className="row" style={{ marginBottom: '.4rem' }}>
          <button type="button" className="btn btn-sm" onClick={() => setF({ ...f, user_ids: [...new Set([...f.user_ids, ...shown.map((u) => u.id)])] })}>Select all shown</button>
          <button type="button" className="btn btn-sm" onClick={() => setF({ ...f, user_ids: [] })}>Clear</button>
        </div>
        <div className="pick-list">
          {shown.map((u) => <label key={u.id}><input type="checkbox" checked={f.user_ids.includes(u.id)} onChange={() => toggle(u.id)} /><span>{u.display_name} <span className="muted small">{u.job_title || u.email}</span></span></label>)}
          {!shown.length && <p className="muted" style={{ padding: '.8rem' }}>No one matches “{search}”.</p>}
        </div>
      </div>
      <button className="btn btn-primary" disabled={busy}>{busy ? 'Assigning…' : 'Assign course'}</button>
    </form>
  );
}

export default function AssignCourses() {
  const users = useAsync(() => api.get('/assignments/users'), []);
  const list = useAsync(() => api.get('/assignments'), []);
  const toast = useToast();
  const [status, setStatus] = useState('all');
  const [q, setQ] = useState('');

  const remove = async (a) => {
    if (!window.confirm(`Remove "${a.title}" for ${a.assignee_name}?`)) return;
    try { await api.del(`/assignments/${a.id}`); toast('Assignment removed'); list.reload(); } catch (e) { toast(e.message, 'err'); }
  };

  return (
    <>
      <PageHeader title="Assign courses" subtitle="Give people courses with deadlines and follow their progress across the company." />
      <Async state={users}>{(u) => <NewAssignment users={u.users} onCreated={list.reload} />}</Async>
      <section className="card">
        <div className="row-between"><h2>All assignments</h2>
          <div className="row">
            <input style={{ width: 200 }} placeholder="Search person or course" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search assignments" />
            <select style={{ width: 150 }} value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Filter by status">
              <option value="all">All statuses</option><option value="not_started">Not started</option><option value="in_progress">In progress</option><option value="completed">Completed</option><option value="overdue">Overdue</option>
            </select>
          </div>
        </div>
        <Async state={list} label="Loading assignments…">{(d) => {
          const rows = d.items.filter((a) => (status === 'all' || (status === 'overdue' ? a.overdue : a.status === status)) && `${a.title} ${a.assignee_name}`.toLowerCase().includes(q.toLowerCase()));
          const done = d.items.filter((a) => a.status === 'completed').length;
          return (
            <>
              <p className="muted small">{d.items.length} assignments · {done} completed · {d.items.filter((a) => a.overdue).length} overdue</p>
              {rows.length === 0 ? <Empty icon="book" title="No assignments to show">{d.items.length ? 'Try a different filter.' : 'Assign a course above to get started.'}</Empty> : (
                <div className="table-wrap"><table>
                  <thead><tr><th>Person</th><th>Course</th><th>Deadline</th><th>Status</th><th /></tr></thead>
                  <tbody>{rows.map((a) => (
                    <tr key={a.id}>
                      <td>{a.assignee_name}<small className="muted" style={{ display: 'block' }}>{a.assignee_email}</small></td>
                      <td>{a.link ? <a href={a.link} target="_blank" rel="noopener noreferrer">{a.title}</a> : a.title}</td>
                      <td>{fmtDate(a.deadline)} {a.overdue && <Badge tone="red">Overdue</Badge>}</td>
                      <td><StatusBadge status={a.status} /></td>
                      <td><button className="btn btn-sm btn-danger" onClick={() => remove(a)}>Remove</button></td>
                    </tr>
                  ))}</tbody>
                </table></div>
              )}
            </>
          );
        }}</Async>
      </section>
    </>
  );
}
