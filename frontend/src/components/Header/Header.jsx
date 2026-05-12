import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import usePermission from '../../hooks/usePermissions';
import './Header.css';

const Header = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [history, setHistory] = useState([]);
  const { logout, user } = useAuth();
  const hasPermission = usePermission();

  const canSeeOrders = hasPermission('order', 1) || hasPermission('queues', 1);
  const canSeeEmployees = hasPermission('role', 1);
  const canSeeStorage = hasPermission('storage', 1);

  const isActive = (path) => {
    if (path === '/orders') {
      return location.pathname === '/orders' || location.pathname.startsWith('/orders/');
    }
    return location.pathname === path;
  };

  useEffect(() => {
    setHistory((prev) => {
      const last = prev[prev.length - 1];
      if (last === location.pathname) return prev;
      return [...prev, location.pathname];
    });
  }, [location.pathname]);

  const handleBack = () => {
    setHistory((prev) => prev.slice(0, -1));
    navigate(-1);
  };

  const getPageTitle = () => {
    switch (location.pathname) {
      case '/orders':
        return 'Заказы';
      case '/print-queue':
        return 'Печать очереди';
      case '/employees':
        return 'Сотрудники';
      case '/materials':
        return 'Склад';
      default:
        if (location.pathname.startsWith('/orders/')) return 'Детали заказа';
        return 'Страница';
    }
  };

  const navTo = (path) => {
    navigate(path);
    setMenuOpen(false);
  };

  const handleLogout = () => {
    setMenuOpen(false);
    logout();
  };

  const showBackButton = history.length >= 2;

  return (
    <>
      <div className="main-header">
        <div
          className="header-burger"
          onClick={() => setMenuOpen(true)}
        >
          <span></span>
          <span></span>
          <span></span>
        </div>

        {showBackButton && (
          <button
            className="header-back-btn"
            onClick={handleBack}
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
            >
              <path
                d="M15 18l-6-6 6-6"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        )}

        <div className="page-title">{getPageTitle()}</div>
        <div className="header-spacer" />
      </div>

      <div
        className={`sidebar-overlay ${menuOpen ? 'sidebar-overlay--visible' : ''}`}
        onClick={() => setMenuOpen(false)}
      />

      <div className={`sidebar ${menuOpen ? 'sidebar--open' : ''}`}>
        <div className="sidebar-header">
          <span className="sidebar-brand-name">НАТСТРОЙ</span>
          <button
            className="sidebar-close"
            onClick={() => setMenuOpen(false)}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {user && (
          <div className="sidebar-user">
            <div className="sidebar-user-avatar">
              {user.name?.[0]}
              {user.lastname?.[0]}
            </div>
            <div className="sidebar-user-info">
              <span className="sidebar-user-name">
                {user.name} {user.lastname}
              </span>
              <span className="sidebar-user-login">{user.username}</span>
            </div>
          </div>
        )}

        <div className="sidebar-divider" />

        <p className="sidebar-nav-label">Навигация</p>
        <nav className="sidebar-nav">
          {canSeeOrders && (
            <button
              className={`sidebar-nav-item ${isActive('/orders') ? 'sidebar-nav-item--active' : ''}`}
              onClick={() => navTo('/orders')}
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line
                  x1="16"
                  y1="13"
                  x2="8"
                  y2="13"
                />
                <line
                  x1="16"
                  y1="17"
                  x2="8"
                  y2="17"
                />
              </svg>
              Заказы
            </button>
          )}

          {canSeeStorage && (
            <button
              className={`sidebar-nav-item ${isActive('/materials') ? 'sidebar-nav-item--active' : ''}`}
              onClick={() => navTo('/materials')}
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                <polyline points="9 22 9 12 15 12 15 22" />
              </svg>
              Склад
            </button>
          )}

          {canSeeEmployees && (
            <>
              <button
                className={`sidebar-nav-item ${isActive('/employees') ? 'sidebar-nav-item--active' : ''}`}
                onClick={() => navTo('/employees')}
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
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
                Сотрудники
              </button>
              <button
                className={`sidebar-nav-item ${isActive('/work-journal') ? 'sidebar-nav-item--active' : ''}`}
                onClick={() => navTo('/work-journal')}
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
                >
                  <path d="M18 20V10" />
                  <path d="M12 20V4" />
                  <path d="M6 20v-6" />
                </svg>
                Журнал выполнения
              </button>
            </>
          )}
        </nav>

        <button
          className="sidebar-logout-btn"
          onClick={handleLogout}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line
              x1="21"
              y1="12"
              x2="9"
              y2="12"
            />
          </svg>
          Выйти из аккаунта
        </button>
      </div>
    </>
  );
};

export default Header;
