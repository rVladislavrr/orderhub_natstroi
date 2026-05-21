import { useAuth } from '../context/AuthContext';

const usePermission = () => {
  const { user, loading } = useAuth();

  const hasPermission = (key, level = 1) => {
    if (loading) {
      console.log('Права ещё загружаются...');
      return false;
    }

    const userLevel = user?.permissions?.[key] ?? 0;
    const result = userLevel >= level;

    console.log(`hasPermission('${key}', ${level}) => ${result} (userLevel: ${userLevel})`);

    return result;
  };

  return hasPermission;
};

export default usePermission;
