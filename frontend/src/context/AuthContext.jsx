import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, setAuthToken } from '../api/client';

const AuthContext = createContext(null);

const STORAGE_KEY = 'parksense_auth';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  const persist = useCallback((authToken, authUser) => {
    setToken(authToken);
    setUser(authUser);
    setAuthToken(authToken);
    if (authToken && authUser) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ token: authToken, user: authUser }));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  const logout = useCallback(() => {
    persist(null, null);
  }, [persist]);

  const loginWithToken = useCallback(
    async (authToken) => {
      setAuthToken(authToken);
      const { data } = await api.getMe();
      persist(authToken, data);
      return data;
    },
    [persist]
  );

  const login = useCallback(
    async (email, password) => {
      const { data } = await api.login({ email, password });
      setAuthToken(data.access_token);
      const userData = { email: data.email, full_name: data.full_name, role: data.role };
      persist(data.access_token, userData);
      return userData;
    },
    [persist]
  );

  const register = useCallback(
    async (email, password, full_name) => {
      const { data } = await api.register({ email, password, full_name });
      setAuthToken(data.access_token);
      const userData = { email: data.email, full_name: data.full_name, role: data.role };
      persist(data.access_token, userData);
      return userData;
    },
    [persist]
  );

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      setLoading(false);
      return;
    }
    try {
      const { token: savedToken, user: savedUser } = JSON.parse(stored);
      setAuthToken(savedToken);
      api
        .getMe()
        .then(({ data }) => persist(savedToken, data))
        .catch(() => logout())
        .finally(() => setLoading(false));
    } catch {
      logout();
      setLoading(false);
    }
  }, [logout, persist]);

  const updateUserData = useCallback((updatedUser) => {
    setUser(updatedUser);
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...parsed, user: updatedUser }));
      } catch (err) {
        console.error("Failed to update user storage:", err);
      }
    }
  }, []);

  const value = useMemo(
    () => ({
      user,
      token,
      loading,
      isOfficer: user?.role === 'officer',
      isUser: user?.role === 'user' || user?.role === 'officer',
      login,
      register,
      loginWithToken,
      logout,
      updateUserData,
    }),
    [user, token, loading, login, register, loginWithToken, logout, updateUserData]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
