import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams, Navigate } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { Banner, Field, Icon, Spinner } from '../ui.jsx';

function Shell({ title, subtitle, children }) {
  return (
    <div className="auth">
      <section className="auth-art">
        <div className="row"><Icon name="sparkles" size={28} /><strong style={{ fontSize: '1.2rem' }}>Exquis Upskill</strong></div>
        <h2>Grow a little every week.</h2>
        <p>Set a goal, get a plan your manager approves, and share progress as you go.</p>
        <ul>
          <li><Icon name="check" />Personalised learning plans</li>
          <li><Icon name="check" />Simple check-ins with evidence</li>
          <li><Icon name="check" />Courses assigned by HR in one place</li>
        </ul>
      </section>
      <section className="auth-form">
        <h1>{title}</h1>
        <p className="muted">{subtitle}</p>
        {children}
      </section>
    </div>
  );
}

export function Login() {
  const { user, login } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const [f, setF] = useState({ email: '', password: '' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [resent, setResent] = useState('');
  if (user) return <Navigate to={loc.state?.from || '/'} replace />;

  const submit = async (e) => {
    e.preventDefault(); setErr(''); setBusy(true);
    try { await login(f.email, f.password); nav(loc.state?.from || '/'); } catch (x) { setErr(x.message); } finally { setBusy(false); }
  };
  const resend = async () => { const d = await api.post('/auth/resend', { email: f.email }).catch((x) => ({ message: x.message })); setResent(d.message); };

  return (
    <Shell title="Welcome back" subtitle="Sign in with your Exquis App Factory email.">
      <form onSubmit={submit} noValidate>
        {err && <Banner tone="error">{err}</Banner>}
        {err.includes('verify your email') && <p><button type="button" className="btn btn-sm" onClick={resend}>Resend verification email</button> {resent && <span className="small muted">{resent}</span>}</p>}
        <Field label="Work email"><input type="email" autoComplete="username" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} required autoFocus /></Field>
        <Field label="Password"><input type="password" autoComplete="current-password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} required /></Field>
        <button className="btn btn-primary btn-block" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
      </form>
      <p style={{ marginTop: '1.2rem' }}><Link to="/forgot">Forgot your password?</Link></p>
      <p>New here? <Link to="/signup">Create an account</Link></p>
    </Shell>
  );
}

export function Signup() {
  const [f, setF] = useState({ display_name: '', email: '', password: '' });
  const [err, setErr] = useState('');
  const [done, setDone] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault(); setErr(''); setBusy(true);
    try { const d = await api.post('/auth/signup', f); setDone(d.message); } catch (x) { setErr(x.message); } finally { setBusy(false); }
  };
  if (done) return <Shell title="Check your inbox" subtitle={done}><Banner tone="ok">We sent a link to {f.email}. Open it to activate your account, then sign in.</Banner><Link className="btn" to="/login">Go to sign in</Link></Shell>;
  return (
    <Shell title="Create your account" subtitle="Only @exquisappfactory.com email addresses can sign up.">
      <form onSubmit={submit} noValidate>
        {err && <Banner tone="error">{err}</Banner>}
        <Field label="Full name"><input value={f.display_name} onChange={(e) => setF({ ...f, display_name: e.target.value })} autoComplete="name" required autoFocus /></Field>
        <Field label="Work email"><input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} autoComplete="username" required /></Field>
        <Field label="Password" hint="At least 10 characters, with a letter and a number."><input type="password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} autoComplete="new-password" required /></Field>
        <button className="btn btn-primary btn-block" disabled={busy}>{busy ? 'Creating account…' : 'Create account'}</button>
      </form>
      <p style={{ marginTop: '1.2rem' }}>Already have an account? <Link to="/login">Sign in</Link></p>
    </Shell>
  );
}

export function Forgot() {
  const [email, setEmail] = useState('');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const submit = async (e) => {
    e.preventDefault(); setErr('');
    try { const d = await api.post('/auth/forgot', { email }); setMsg(d.message); } catch (x) { setErr(x.message); }
  };
  return (
    <Shell title="Reset your password" subtitle="We’ll email you a link that works for one hour.">
      {msg ? <Banner tone="ok">{msg}</Banner> : (
        <form onSubmit={submit} noValidate>
          {err && <Banner tone="error">{err}</Banner>}
          <Field label="Work email"><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus /></Field>
          <button className="btn btn-primary btn-block">Send reset link</button>
        </form>
      )}
      <p style={{ marginTop: '1.2rem' }}><Link to="/login">Back to sign in</Link></p>
    </Shell>
  );
}

export function Reset() {
  const [params] = useSearchParams();
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [done, setDone] = useState(false);
  const submit = async (e) => {
    e.preventDefault(); setErr('');
    try { await api.post('/auth/reset', { token: params.get('token') || '', password }); setDone(true); } catch (x) { setErr(x.message); }
  };
  return (
    <Shell title="Choose a new password" subtitle="Use at least 10 characters, with a letter and a number.">
      {done ? <Banner tone="ok">Password updated. You can now <Link to="/login">sign in</Link>.</Banner> : (
        <form onSubmit={submit} noValidate>
          {err && <Banner tone="error">{err}</Banner>}
          <Field label="New password"><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" required autoFocus /></Field>
          <button className="btn btn-primary btn-block">Update password</button>
        </form>
      )}
    </Shell>
  );
}

export function Verify() {
  const [params] = useSearchParams();
  const [state, setState] = useState({ loading: true, error: '' });
  const ran = useRef(false);
  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    api.post('/auth/verify', { token: params.get('token') || '' }).then(() => setState({ loading: false, error: '' })).catch((e) => setState({ loading: false, error: e.message }));
  }, [params]);
  return (
    <Shell title="Email verification" subtitle="">
      {state.loading ? <Spinner label="Verifying…" /> : state.error ? <Banner tone="error">{state.error}</Banner> : <Banner tone="ok">Your email is verified. You can now sign in.</Banner>}
      {!state.loading && <Link className="btn btn-primary" to="/login">Go to sign in</Link>}
    </Shell>
  );
}
