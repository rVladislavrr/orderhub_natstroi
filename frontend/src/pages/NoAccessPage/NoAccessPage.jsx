import { useNavigate } from 'react-router-dom';
import './NoAccessPage.css';

const NoAccessPage = () => {
  const navigate = useNavigate();

  return (
    <div className="no-access-page">
      <div className="no-access-card">
        <div className="no-access-icon-wrap">
          <svg
            width="48"
            height="48"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#004e8d"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle
              cx="12"
              cy="12"
              r="10"
            />
            <path d="M12 8v4M12 16h.01" />
          </svg>
        </div>
        <h1 className="no-access-title">Нет доступа</h1>
        <p className="no-access-text">Ваш аккаунт не имеет прав ни к одному разделу системы. Обратитесь к ответственному за роли, чтобы получить необходимые права.</p>
        <div className="no-access-hint">
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
            <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
            <circle
              cx="9"
              cy="7"
              r="4"
            />
            <path d="M23 21v-2a4 4 0 00-3-3.87" />
            <path d="M16 3.13a4 4 0 010 7.75" />
          </svg>
          Ответственный за роли управляет правами сотрудников
        </div>
        <button
          className="no-access-btn"
          onClick={() => navigate('/')}
        >
          На главную
        </button>
      </div>
    </div>
  );
};

export default NoAccessPage;
