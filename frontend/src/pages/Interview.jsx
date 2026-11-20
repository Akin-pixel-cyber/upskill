import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { Banner, CADENCES, ChipInput, Field, Icon, PageHeader } from '../ui.jsx';

const ROLES = ['Frontend Developer', 'Backend Developer', 'Full-Stack Developer', 'Mobile Developer', 'DevOps Engineer', 'Cloud Engineer', 'Data Analyst', 'Data Engineer', 'Machine Learning Engineer', 'QA Engineer', 'UI/UX Designer', 'Product Manager', 'Project Manager', 'Engineering Manager', 'Tech Lead', 'Solutions Architect', 'Software Engineer'];
const LEVELS = ['Junior', 'Mid-Level', 'Senior', 'Staff'];
const DOMAINS = ['Web applications', 'APIs and microservices', 'Cloud and infrastructure', 'Mobile apps', 'Data and analytics', 'AI and machine learning', 'Security', 'System design', 'Leadership', 'Product and delivery'];
const SKILLS = ['JavaScript', 'TypeScript', 'React', 'Next.js', 'Vue.js', 'Angular', 'Svelte', 'HTML', 'CSS', 'Tailwind CSS', 'Node.js', 'Express.js', 'NestJS', 'Java', 'Spring Boot', 'Kotlin', 'Python', 'Django', 'PostgreSQL', 'Docker', 'AWS', 'Git'];
const STEPS = [['Role', 'Tell us about your current role and level'], ['Skills', 'Add your current skills'], ['Goal', 'Where do you want to go?'], ['Capacity', 'How much time can you commit?'], ['Review', 'Add notes and generate your plan']];
const KEY = 'upskill-interview-draft';
const EMPTY = { role_current: '', level: '', skills: [], role_target: '', domain: '', hours_per_week: 5, timeline_weeks: 12, cadence_days: 7, notes: '' };

export default function Interview() {
  const nav = useNavigate();
  const [step, setStep] = useState(0);
  const [f, setF] = useState(() => { try { return { ...EMPTY, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch { return EMPTY; } });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  useEffect(() => { try { localStorage.setItem(KEY, JSON.stringify(f)); } catch { /* storage unavailable */ } }, [f]);

  const validate = (s) => {
    const e = {};
    if (s === 0) { if (!f.role_current.trim()) e.role_current = 'Enter your current role.'; if (!f.level.trim()) e.level = 'Choose or enter a level.'; }
    if (s === 1 && !f.skills.length) e.skills = 'Add at least one skill.';
    if (s === 2 && !f.role_target.trim()) e.role_target = 'Enter the role you want to move toward.';
    if (s === 3) { const h = Number(f.hours_per_week); if (!(h >= 1 && h <= 40)) e.hours_per_week = 'Enter between 1 and 40 hours.'; }
    setErrors(e);
    return !Object.keys(e).length;
  };
  const next = () => validate(step) && setStep(step + 1);
  const generate = async () => {
    for (let s = 0; s < 4; s++) if (!validate(s)) { setStep(s); return; }
    setBusy(true); setErr('');
    try {
      const d = await api.post('/plans/generate', { ...f, hours_per_week: Number(f.hours_per_week), timeline_weeks: Number(f.timeline_weeks), cadence_days: Number(f.cadence_days) }, { timeout: 100000 });
      localStorage.removeItem(KEY);
      nav(`/plans/${d.id}`);
    } catch (x) { setErr(x.message); setBusy(false); }
  };

  const suggests = useMemo(() => {
    const total = Math.round(Number(f.hours_per_week || 0) * Number(f.timeline_weeks || 0));
    if (!f.role_current && !f.role_target) return 'Fill in your role and goal to see how your plan will take shape.';
    return `We’ll build on ${f.skills.slice(0, 3).join(', ') || 'your current foundation'}, close priority gaps for ${f.role_target || 'your target role'}, and sequence work around your capacity${total ? ` (about ${total} focused hours over ${f.timeline_weeks} weeks)` : ''}.`;
  }, [f]);

  return (
    <>
      <PageHeader title="Tell us about your goals" subtitle="We’ll generate a tailored plan you can review and edit before sending to your manager." />
      <datalist id="roles">{ROLES.map((r) => <option key={r} value={r} />)}</datalist>
      <datalist id="levels">{LEVELS.map((r) => <option key={r} value={r} />)}</datalist>
      <datalist id="domains">{DOMAINS.map((r) => <option key={r} value={r} />)}</datalist>
      <div className="wizard">
        <ol className="steps" aria-label="Interview steps">
          {STEPS.map(([t, s], i) => (
            <li key={t} className={i === step ? 'active' : i < step ? 'done' : ''}>
              <span className="step-dot">{i < step ? <Icon name="check" size={14} /> : i + 1}</span>
              <div><b>{t}</b><span>{s}</span></div>
            </li>
          ))}
        </ol>

        <section className="card">
          {err && <Banner tone="error">{err}</Banner>}
          {step === 0 && <>
            <Field label="Current role" hint="Choose from suggestions or type your own role." error={errors.role_current}><input list="roles" value={f.role_current} onChange={set('role_current')} placeholder="Type to search or enter any role" autoFocus /></Field>
            <Field label="Level" hint="Examples: Junior, Mid-Level, Senior, Staff." error={errors.level}><input list="levels" value={f.level} onChange={set('level')} placeholder="Search a level or type your own" /></Field>
          </>}
          {step === 1 && <Field label="Current skills" hint="Press Enter or comma to add. You can paste a comma-separated list. Custom skills are welcome." error={errors.skills}>
            <ChipInput value={f.skills} onChange={(skills) => setF({ ...f, skills })} suggestions={SKILLS} placeholder="Type a skill, then press Enter or comma" />
          </Field>}
          {step === 2 && <div className="grid-2">
            <Field label="Target role" error={errors.role_target}><input list="roles" value={f.role_target} onChange={set('role_target')} placeholder="The role you want to grow into" autoFocus /></Field>
            <Field label="Domain focus" hint="Optional"><input list="domains" value={f.domain} onChange={set('domain')} placeholder="Search options or type your own" /></Field>
          </div>}
          {step === 3 && <>
            <div className="grid-2">
              <Field label="Hours per week" error={errors.hours_per_week}><input type="number" min="1" max="40" value={f.hours_per_week} onChange={set('hours_per_week')} /></Field>
              <Field label="Timeline"><select value={f.timeline_weeks} onChange={set('timeline_weeks')}>{[4, 6, 8, 12, 16, 20, 26].map((w) => <option key={w} value={w}>{w} weeks</option>)}</select></Field>
            </div>
            <Field label="Check-in cadence" hint="How often you’ll share progress. Your manager sees this when approving."><select value={f.cadence_days} onChange={set('cadence_days')}>{CADENCES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></Field>
          </>}
          {step === 4 && <>
            <dl className="review-list">
              <dt>Current role</dt><dd>{f.role_current} ({f.level})</dd>
              <dt>Skills</dt><dd>{f.skills.join(', ')}</dd>
              <dt>Target role</dt><dd>{f.role_target}{f.domain && ` · ${f.domain}`}</dd>
              <dt>Capacity</dt><dd>{f.hours_per_week} h/week for {f.timeline_weeks} weeks</dd>
            </dl>
            <Field label="Notes for your plan" hint="Optional: constraints, interests, certifications you want, anything your manager should know."><textarea value={f.notes} onChange={set('notes')} maxLength={2000} /></Field>
          </>}
          <div className="wizard-actions">
            <button className="btn" onClick={() => setStep(step - 1)} disabled={step === 0 || busy}>Back</button>
            {step < 4 ? <button className="btn btn-primary" onClick={next}>Continue</button>
              : <button className="btn btn-primary" onClick={generate} disabled={busy}>{busy ? 'Generating your plan…' : 'Generate plan'}<Icon name="sparkles" size={16} /></button>}
          </div>
          {busy && <p className="muted small" style={{ marginTop: '.8rem' }}>This can take up to a minute when AI is enabled. If it fails, we use the built-in generator automatically.</p>}
        </section>

        <aside className="card">
          <h2>Draft signals</h2>
          <p className="muted small">Live preview of your plan direction.</p>
          <div className="signal">
            <div><div className="eyebrow">Current role</div><b>{f.role_current || 'Not set'}</b></div>
            <Icon name="arrow" className="muted" />
            <div><div className="eyebrow">Target role</div><b>{f.role_target || 'Not set'}</b></div>
          </div>
          <h3 style={{ marginTop: '1rem' }}>Selected skills</h3>
          {f.skills.length ? <div className="tag-list">{f.skills.map((s) => <span key={s} className="chip chip-on">{s}</span>)}</div> : <p className="muted small">Add skills to preview.</p>}
          <h3 style={{ marginTop: '1rem' }}>What this suggests</h3>
          <p className="muted">{suggests}</p>
        </aside>
      </div>
    </>
  );
}
