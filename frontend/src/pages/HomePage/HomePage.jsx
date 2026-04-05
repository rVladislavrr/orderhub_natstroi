import { useNavigate } from 'react-router-dom';
import logo from './logo.svg';
import './HomePage.css';

const HomePage = () => {
  const navigate = useNavigate();
  const handleClick = () => {
    navigate('/orders');
  };

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
          onClick={handleClick}
        >
          В рабочее пространство
        </button>
      </div>
    </div>
  );
};

export default HomePage;
