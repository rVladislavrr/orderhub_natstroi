import { useLocation } from 'react-router-dom';
import './Header.css';

const Header = () => {
  const location = useLocation();

  const getPageTitle = () => {
    switch (location.pathname) {
      case '/':
        return 'Главная';
      case '/orders':
        return 'Заказы';
      case '/create-order':
        return 'Создание заказа';
      case '/print-queue':
        return 'Очередь печати';
      default:
        if (location.pathname.startsWith('/orders/')) {
          return 'Детали заказа';
        }
        return 'Страница';
    }
  };
  return (
    <div className="main-header">
      <div className="header-burger">
        <span></span>
        <span></span>
        <span></span>
      </div>
      <div className="page-title">{getPageTitle()}</div>
    </div>
  );
};

export default Header;
