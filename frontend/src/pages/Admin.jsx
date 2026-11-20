import { useState } from 'react';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { Async, Avatar, Badge, PageHeader, ROLE_LABEL, useAsync, useToast } from '../ui.jsx';

export default function Admin() {
  const { user: me } = useAuth();
  const state = useAsync(() => api.get('/admin/users'), []);
  const toast = useToast();
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState('');

  const patch = async (u, body, msg) => {
    setBusy(u.id);
    try {
      const r = await api.patch(`/admin/users/${u.id}`, body);
      toast(msg); if (r.notice) toast(r.notice);
      state.reload();
    } catch (e) { toast(e.message, 'err'); } finally { setBusy(''); }
  };

  return (
    <>
      <PageHeader title="Admin" subtitle="Manage roles, reporting managers and access. Only Admins can change roles." />
      <Async state={state}>{(d) => {
        const mgrs = d.users.filter((u) => ['manager', 'admin'].includes(u.role) && u.is_active);
        const rows = d.users.filter((u) => `${u.display_name} ${u.email}`.toLowerCase().includes(q.toLowerCase()));
        return (
          <section className="card">
            <div className="row-between" style={{ marginBottom: '.6rem' }}>
              <span className="muted">{d.users.length} users</span>
              <input style={{ width: 240 }} placeholder="Search name or email" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search users" />
            </div>
            <div className="table-wrap"><table>
              <thead><tr><th>Name</th><th>Role</th><th>Reporting manager</th><th>Status</th><th>Verified</th><th /></tr></thead>
              <tbody>{rows.map((u) => (
                <tr key={u.id} style={{ opacity: u.is_active ? 1 : .6 }}>
                  <td><div className="person"><Avatar user={u} /><div><b>{u.display_name}</b>{u.id === me.id && ' (you)'}<small>{u.email}</small></div></div></td>
                  <td><select value={u.role} disabled={busy === u.id} aria-label={`Role for ${u.display_name}`} onChange={(e) => patch(u, { role: e.target.value }, `${u.display_name} is now ${ROLE_LABEL[e.target.value]}`)}>
                    {Object.entries(ROLE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></td>
                  <td><select value={u.manager_id || ''} disabled={busy === u.id} aria-label={`Manager for ${u.display_name}`} onChange={(e) => patch(u, { manager_id: e.target.value || null }, 'Reporting manager updated')}>
                    <option value="">No manager</option>
                    {mgrs.filter((m) => m.id !== u.id).map((m) => <option key={m.id} value={m.id}>{m.display_name}</option>)}</select></td>
                  <td>{u.is_active ? <Badge tone="green">Active</Badge> : <Badge tone="red">Deactivated</Badge>}</td>
                  <td>{u.email_verified ? <Badge tone="green">Verified</Badge> : <Badge tone="amber">Pending</Badge>}</td>
                  <td>{u.id !== me.id && <button className={`btn btn-sm ${u.is_active ? 'btn-danger' : ''}`} disabled={busy === u.id}
                    onClick={() => { if (!u.is_active || window.confirm(`Deactivate ${u.display_name}? They will be signed out and unable to sign in.`)) patch(u, { is_active: !u.is_active }, u.is_active ? 'User deactivated' : 'User reactivated'); }}>
                    {u.is_active ? 'Deactivate' : 'Reactivate'}</button>}</td>
                </tr>
              ))}</tbody>
            </table></div>
            <p className="muted small" style={{ marginTop: '.8rem' }}>Only people with the Manager or Admin role can be chosen as a reporting manager. Make someone a Manager first.</p>
          </section>
        );
      }}</Async>
    </>
  );
}
