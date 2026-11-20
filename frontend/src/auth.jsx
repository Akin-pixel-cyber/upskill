import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { api } from './api.js';
import { Spinner } from './ui.jsx';

const Ctx = createContext(null);
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/me').then((d) => setUser(d.user)).catch(() => setUser(null)).finally(() => setLoading(false));
    const out = () => setUser(null);
    window.addEventListener('upskill:unauthorized', out);
    return () => window.removeEventListener('upskill:unauthorized', out);
  }, []);

  const login = async (email, password) => { const d = await api.post('/auth/login', { email, password }); setUser(d.user); };
  const logout = async () => { await api.post('/auth/logout').catch(() => {}); setUser(null); };
  const refresh = useCallback(async () => { const d = await api.get('/me'); setUser(d.user); }, []);

  return <Ctx.Provider value={{ user, setUser, loading, login, logout, refresh }}>{children}</Ctx.Provider>;
}

export function Protected({ roles, children }) {
  const { user, loading } = useAuth();
  const loc = useLocation();
  if (loading) return <div className="center-screen"><Spinner /></div>;
  if (!user) return <Navigate to="/login" replace state={{ from: loc.pathname }} />;
  if (roles && user.role !== 'admin' && !roles.includes(user.role)) return <Navigate to="/" replace />;
  return children;
}
