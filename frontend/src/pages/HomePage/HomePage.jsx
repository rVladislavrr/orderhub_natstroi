import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import logo from './logo.svg';
import './HomePage.css';
import LoginModal from './LoginModal/LoginModal';

const HomePage = () => {
  const { user, loading, getRouteByPermissions } = useAuth();
  const [showModal, setShowModal] = useState(false);

  if (!loading && user) {
    return (
      <Navigate
        to={getRouteByPermissions(user.permissions)}
        replace
      />
    );
  }

  return (
    <div className="home-page-container">
      <div className="overlay"></div>
      <div className="content">
        <div className="logo-section">
          <img
            src={logo}
            alt="Natstroy-logo"
            className="logo"
          />
          <h1 className="company-name">НАТСТРОЙ</h1>
          <p className="slogan">Надежность, комфорт и уверенность</p>
        </div>
        <button
          className="btn"
          onClick={() => setShowModal(true)}
        >
          В рабочее пространство
        </button>
      </div>

      {showModal && <LoginModal onClose={() => setShowModal(false)} />}
    </div>
  );
};

export default HomePage;
