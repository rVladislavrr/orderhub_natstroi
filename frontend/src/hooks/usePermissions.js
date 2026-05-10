import { useAuth } from '../context/AuthContext';

const usePermission = () => {
  const { user } = useAuth();

  const hasPermission = (key, level = 1) => {
    return (user?.permissions?.[key] ?? 0) >= level;
  };

  return hasPermission;
};

export default usePermission;
