import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();

  console.log('ProtectedRoute:', { user, loading });

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
  return children;
};

export default ProtectedRoute;
