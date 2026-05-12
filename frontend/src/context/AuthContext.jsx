import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/ordersApi';
import { loginRequest, logoutRequest } from '../api/authApi';

const AuthContext = createContext(null);

const hasAnyPermission = (permissions) => {
  if (!permissions) return false;
  return Object.values(permissions).some((v) => v >= 1);
};

const getRouteByPermissions = (permissions) => {
  if (!permissions || !hasAnyPermission(permissions)) return '/no-access';
  if (permissions.order >= 1) return '/orders';
  if (permissions.queues >= 1) return '/orders';
  if (permissions.storage >= 1) return '/materials';
  if (permissions.role >= 1) return '/employees';
  return '/no-access';
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const logout = useCallback(async () => {
    try {
      await logoutRequest();
    } catch {}
    localStorage.removeItem('access_token');
    delete api.defaults.headers.common['Authorization'];
    setUser(null);
    navigate('/');
  }, [navigate]);

  const fetchMe = useCallback(async () => {
    try {
      const response = await api.get('/users/me');
      setUser(response.data);
    } catch {
      logout();
    } finally {
      setLoading(false);
    }
  }, [logout]);

  useEffect(() => {
    const token = localStorage.getItem('access_token');
    if (token) {
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      fetchMe();
    } else {
      setLoading(false);
    }
  }, [fetchMe]);

  const login = async (username, password) => {
    const data = await loginRequest(username, password);
    const { accessToken } = data;
    localStorage.setItem('access_token', accessToken);
    api.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;
    const response = await api.get('/users/me');
    const me = response.data;
    setUser(me);
    navigate(getRouteByPermissions(me.permissions));
  };

  return <AuthContext.Provider value={{ user, loading, login, logout, getRouteByPermissions }}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
