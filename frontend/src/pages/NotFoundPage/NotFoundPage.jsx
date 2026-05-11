import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import './NotFoundPage.css';

const NotFoundPage = () => {
  const navigate = useNavigate();
  const { user, getRouteByPermissions } = useAuth();

  const handleGoHome = () => {
    if (user) {
      navigate(getRouteByPermissions(user.permissions));
    } else {
      navigate('/');
    }
  };

  return (
    <div className="not-found-page">
      <div className="not-found-content">
        <div className="not-found-number">404</div>
        <div className="not-found-divider" />
        <h1 className="not-found-title">Страница не найдена</h1>
        <p className="not-found-text">Страница, которую вы ищете, не существует или была перемещена.</p>
        <button
          className="not-found-btn"
          onClick={handleGoHome}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
            <polyline points="9 22 9 12 15 12 15 22" />
          </svg>
          На главную
        </button>
      </div>
    </div>
  );
};

export default NotFoundPage;
