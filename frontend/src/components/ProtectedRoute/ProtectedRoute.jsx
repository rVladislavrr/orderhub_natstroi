import { useEffect, useRef } from 'react';
import { Navigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { useAuth } from '../../context/AuthContext';

/** Возвращает первый доступный маршрут для пользователя */
const getDefaultRoute = (permissions) => {
  if (!permissions) return '/';
  if (permissions.order >= 1) return '/orders';
  if (permissions.queues >= 1) return '/orders';
  if (permissions.storage >= 1) return '/materials';
  if (permissions.role >= 1) return '/employees';
  return '/';
};

const ProtectedRoute = ({ children, allowedPermissions }) => {
  const { user, loading } = useAuth();
  const toastShown = useRef(false);

  const hasAccess = !allowedPermissions || allowedPermissions.some(({ key, level }) => (user?.permissions?.[key] ?? 0) >= level);

  useEffect(() => {
    if (!loading && user && !hasAccess && !toastShown.current) {
      toastShown.current = true;
      toast.error('У вас нет доступа к этой странице');
    }
  }, [loading, user, hasAccess]);

  if (loading) {
    return <div style={{ color: 'white', textAlign: 'center', paddingTop: '40vh', fontSize: '18px' }}>Загрузка...</div>;
  }

  if (!user) {
    return (
      <Navigate
        to="/"
        replace
      />
    );
  }

  if (!hasAccess) {
    return (
      <Navigate
        to={getDefaultRoute(user.permissions)}
        replace
      />
    );
  }

  return children;
};

export default ProtectedRoute;
