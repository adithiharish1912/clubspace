import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import api, { setUnauthorizedHandler, tokenStore } from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [member, setMember] = useState(null);
  const [loading, setLoading] = useState(true);

  const clear = useCallback(() => {
    tokenStore.set(null);
    setUser(null);
    setMember(null);
  }, []);

  const refresh = useCallback(async () => {
    if (!tokenStore.get()) {
      setLoading(false);
      return;
    }
    try {
      const { data } = await api.get('/auth/me');
      setUser(data.data.user);
      setMember(data.data.member);
    } catch {
      clear();
    } finally {
      setLoading(false);
    }
  }, [clear]);

  useEffect(() => {
    setUnauthorizedHandler(clear);
    refresh();
  }, [refresh, clear]);

  const applySession = (payload) => {
    tokenStore.set(payload.token);
    setUser(payload.user);
    setMember(payload.member || null);
  };

  const login = async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password });
    applySession(data.data);
    return data.data.user;
  };

  const register = async (form) => {
    const { data } = await api.post('/auth/register', form);
    if (data.data.token) applySession(data.data);
    return data;
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      /* ignore */
    }
    clear();
  };

  const value = useMemo(
    () => ({
      user,
      member,
      loading,
      login,
      register,
      logout,
      refresh,
      setUser,
      setMember,
      setToken: (t) => tokenStore.set(t),
      role: user?.role,
      isAdmin: ['superadmin', 'admin'].includes(user?.role),
      isStaff: ['superadmin', 'admin', 'staff'].includes(user?.role),
      isSuper: user?.role === 'superadmin',
      isMember: user?.role === 'member',
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [user, member, loading, refresh]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
