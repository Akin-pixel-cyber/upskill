import { Route, Routes, Navigate } from 'react-router-dom';
import { Protected } from './auth.jsx';
import Layout from './Layout.jsx';
import { Login, Signup, Forgot, Reset, Verify } from './pages/Auth.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Interview from './pages/Interview.jsx';
import Plans from './pages/Plans.jsx';
import PlanDetail from './pages/PlanDetail.jsx';
import Checkin from './pages/Checkin.jsx';
import Assignments from './pages/Assignments.jsx';
import Team from './pages/Team.jsx';
import AssignCourses from './pages/AssignCourses.jsx';
import Admin from './pages/Admin.jsx';
import Profile from './pages/Profile.jsx';
import Help from './pages/Help.jsx';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/forgot" element={<Forgot />} />
      <Route path="/reset" element={<Reset />} />
      <Route path="/verify" element={<Verify />} />
      <Route element={<Protected><Layout /></Protected>}>
        <Route index element={<Dashboard />} />
        <Route path="interview" element={<Interview />} />
        <Route path="plans" element={<Plans />} />
        <Route path="plans/:id" element={<PlanDetail />} />
        <Route path="checkin" element={<Checkin />} />
        <Route path="assignments" element={<Assignments />} />
        <Route path="team" element={<Protected roles={['manager']}><Team /></Protected>} />
        <Route path="assign" element={<Protected roles={['hr']}><AssignCourses /></Protected>} />
        <Route path="admin" element={<Protected roles={[]}><Admin /></Protected>} />
        <Route path="profile" element={<Profile />} />
        <Route path="help" element={<Help />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
