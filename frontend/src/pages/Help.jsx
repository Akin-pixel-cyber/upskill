import { Link } from 'react-router-dom';
import { PageHeader } from '../ui.jsx';

export default function Help() {
  return (
    <>
      <PageHeader title="Help" subtitle="A quick guide to Exquis Upskill." />
      <div className="card help">
        <h2 style={{ marginTop: 0 }}>Getting started</h2>
        <ol>
          <li>Open <Link to="/profile">Profile setup</Link> and add your photo, job title and department.</li>
          <li>Go to <Link to="/interview">Skill interview</Link>. Answer five short steps about your role, skills, goal and available time, then generate a plan.</li>
          <li>Review the draft in <Link to="/plans">Plans</Link>. Edit titles, dates and links, reorder items, then <b>Submit for approval</b>.</li>
          <li>Your reporting manager approves the plan or sends it back with comments. Revise and resubmit if needed. An approved plan becomes your <b>active plan</b>.</li>
          <li>Share progress with <Link to="/checkin">New check-in</Link> at the cadence your plan sets. The dashboard shows when the next one is due and flags it in red when overdue.</li>
        </ol>

        <h2>Plans</h2>
        <ul>
          <li>Lifecycle: Draft → Pending approval → Active (or Needs changes → revise → resubmit).</li>
          <li>You have one active plan at a time. Older plans move to Plan history automatically.</li>
          <li>On your active plan, tick items as you finish them to update the progress bar.</li>
        </ul>

        <h2>Check-ins</h2>
        <ul>
          <li>Pick the target (your plan or an HR assignment), then describe progress, blockers and next steps.</li>
          <li>Attach a file or a link as evidence. Drafts are autosaved in this browser.</li>
          <li>You can submit as many updates as you like. Work only closes when you mark it complete.</li>
        </ul>

        <h2>Assignments</h2>
        <p>Courses assigned by HR appear under <Link to="/assignments">My assignments</Link> with a deadline. Start them, share progress, and mark them complete when done.</p>

        <h2>Notifications</h2>
        <p>The bell at the top shows plan submissions, approvals, new course assignments and overdue check-ins. Important ones are also emailed.</p>

        <h2>Roles</h2>
        <ul>
          <li><b>Employee</b>: interviews, plans, check-ins, assignments, profile.</li>
          <li><b>Manager</b>: everything above plus approving plans for direct reports and the Team view.</li>
          <li><b>HR</b>: everything an Employee can do plus assigning courses and tracking them company-wide.</li>
          <li><b>Admin</b>: everything, plus roles, reporting managers and deactivating users.</li>
        </ul>

        <h2>Need something else?</h2>
        <p>If you can’t sign in, use “Forgot your password?” on the sign-in page. For anything else, contact an Admin.</p>
      </div>
    </>
  );
}
