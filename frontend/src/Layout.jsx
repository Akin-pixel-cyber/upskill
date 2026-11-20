import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from './auth.jsx';
import { api } from './api.js';
import { Avatar, Badge, Icon, ROLE_LABEL, relTime, Spinner } from './ui.jsx';

function Bell() {
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  const [data, setData] = useState({ items: [], unread: 0 });
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);
  const box = useRef(null);

  const load = () => api.get('/notifications').then((d) => { setData(d); setErr(null); }).catch((e) => setErr(e.message));
  useEffect(() => { load(); const t = setInterval(load, 60000); return () => clearInterval(t); }, []);
  useEffect(() => {
    const close = (e) => box.current && !box.current.contains(e.target) && setOpen(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const toggle = async () => { const next = !open; setOpen(next); if (next) { setLoading(true); await load(); setLoading(false); } };
  const click = async (n) => {
    setOpen(false);
    if (!n.read_at) { await api.post(`/notifications/${n.id}/read`).catch(() => {}); load(); }
    if (n.link) nav(n.link);
  };
  const readAll = async () => { await api.post('/notifications/read-all').catch(() => {}); load(); };

  return (
    <div style={{ position: 'relative' }} ref={box}>
      <button className="bell" onClick={toggle} aria-label={`Notifications${data.unread ? `, ${data.unread} unread` : ''}`} aria-expanded={open}>
        <Icon name="bell" size={21} />
        {data.unread > 0 && <span className="bell-count">{data.unread > 9 ? '9+' : data.unread}</span>}
      </button>
      {open && (
        <div className="popover">
          <div className="popover-head"><strong>Notifications</strong>{data.unread > 0 && <button className="btn btn-sm" onClick={readAll}>Mark all read</button>}</div>
          <div className="popover-body">
            {loading && !data.items.length && <div style={{ padding: '1rem' }}><Spinner /></div>}
            {err && <div style={{ padding: '1rem' }} className="field-error">{err}</div>}
            {!loading && !err && !data.items.length && <p className="muted" style={{ padding: '1.2rem' }}>You’re all caught up. New plan, approval and course updates appear here.</p>}
            {data.items.map((n) => (
              <button key={n.id} className={`notif ${n.read_at ? '' : 'unread'}`} onClick={() => click(n)}>
                <div>{n.message}</div><small>{relTime(n.created_at)}</small>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function Layout() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [loc.pathname]);

  const role = user.role;
  const isMgr = role === 'manager' || role === 'admin';
  const isHr = role === 'hr' || role === 'admin';
  const link = (to, icon, label, end) => (
    <NavLink to={to} end={end} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}><Icon name={icon} />{label}</NavLink>
  );
  const today = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' });

  return (
    <div className="shell">
      {open && <div className="scrim" onClick={() => setOpen(false)} />}
      <aside className={`sidebar ${open ? 'open' : ''}`} aria-label="Main navigation">
        <div className="brand">
          <div className="brand-mark"><Icon name="sparkles" size={20} /></div>
          <div><strong>Exquis Upskill</strong><small>Learning Workspace</small></div>
        </div>
        <div className="nav-title">WORKSPACE</div>
        {link('/', 'dashboard', 'Dashboard', true)}
        {link('/interview', 'sparkles', 'Skill interview')}
        {link('/plans', 'target', 'Plans')}
        {link('/checkin', 'clipboard', 'New check-in')}
        {link('/assignments', 'book', 'My assignments')}
        {(isMgr || isHr) && <div className="nav-title">MANAGE</div>}
        {isMgr && link('/team', 'users', 'Team')}
        {isHr && link('/assign', 'calendar', 'Assign courses')}
        {role === 'admin' && link('/admin', 'shield', 'Admin')}
        <div className="nav-title">ACCOUNT</div>
        {link('/profile', 'user', 'Profile setup')}
        <div className="nav-spacer" />
        {link('/help', 'help', 'Help')}
        <button className="nav-link" onClick={async () => { await logout(); nav('/login'); }}><Icon name="logout" />Sign out</button>
      </aside>
      <div className="main-col">
        <header className="topbar">
          <div className="row">
            <button className="menu-btn" onClick={() => setOpen(true)} aria-label="Open menu"><Icon name="menu" size={22} /></button>
            <div className="date"><Icon name="calendar" size={16} />{today}</div>
          </div>
          <div className="top-right">
            <Bell />
            <div className="userbox">
              <div className="meta"><div className="name">{user.display_name}</div><div className="sub">{user.job_title || 'Set your job title'}</div></div>
              <Avatar user={user} size={36} />
              <Badge tone="teal">{ROLE_LABEL[role]}</Badge>
            </div>
          </div>
        </header>
        <main className="content"><Outlet /></main>
      </div>
    </div>
  );
}
