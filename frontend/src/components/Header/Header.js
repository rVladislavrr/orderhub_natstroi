import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import './Header.css';

const Header = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const getPageTitle = () => {
    switch (location.pathname) {
      case '/orders':
        return 'Заказы';
      case '/create-order':
        return 'Создание заказа';
      case '/print-queue':
        return 'Печать очереди';
      default:
        if (location.pathname.startsWith('/orders/')) return 'Детали заказа';
        return 'Страница';
    }
  };

  const canGoBack = location.pathname !== '/';

  const handleNavigateToOrders = () => {
    navigate('/orders');
    setMenuOpen(false); // закрываем меню после перехода
  };

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

        {canGoBack && (
          <button
            className="header-back-btn"
            onClick={() => navigate(-1)}
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
        <button
          className="sidebar-close"
          onClick={() => setMenuOpen(false)}
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
          >
            <path
              d="M18 6L6 18M6 6l12 12"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>

        <nav className="sidebar-nav">
          <button
            className="sidebar-nav-item"
            onClick={handleNavigateToOrders}
          >
            Заказы
          </button>
        </nav>
      </div>
    </>
  );
};

export default Header;
