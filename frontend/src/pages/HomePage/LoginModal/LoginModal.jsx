import { useState } from 'react';
import { toast } from 'react-toastify';
import { useAuth } from '../../../context/AuthContext';
import './LoginModal.css';

const LoginModal = ({ onClose }) => {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({ username: '', password: '' });

  const validate = () => {
    const newErrors = { username: '', password: '' };
    let valid = true;

    if (!username.trim()) {
      newErrors.username = 'Поле обязательно для заполнения';
      valid = false;
    }
    if (!password.trim()) {
      newErrors.password = 'Поле обязательно для заполнения';
      valid = false;
    }

    setErrors(newErrors);
    return valid;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    if (password.length < 6) {
      toast.error('Пароль должен содержать минимум 6 символов');
      return;
    }

    if (username.length < 3) {
      toast.error('Логин должен содержать минимум 3 символа');
      return;
    }

    setLoading(true);
    try {
      await login(username, password);
      toast.success('Добро пожаловать!');
      onClose();
    } catch (err) {
      const status = err.response?.status;
      if (status === 401 || status === 403) {
        setErrors({ username: ' ', password: 'Неверный логин или пароль' });
      } else {
        toast.error(err.response?.data?.detail || 'Ошибка сервера, попробуйте позже');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleUsernameChange = (e) => {
    setUsername(e.target.value);
    if (errors.username) setErrors((prev) => ({ ...prev, username: '' }));
  };

  const handlePasswordChange = (e) => {
    setPassword(e.target.value);
    if (errors.password) setErrors((prev) => ({ ...prev, password: '' }));
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-box">
        <button
          className="modal-close"
          onClick={onClose}
        >
          ✕
        </button>
        <h2 className="modal-title">Авторизация</h2>
        <p className="modal-subtitle">Войдите в рабочее пространство</p>

        <form
          onSubmit={handleSubmit}
          className="modal-form"
        >
          <div className="modal-field">
            <label>Логин</label>
            <input
              type="text"
              value={username}
              onChange={handleUsernameChange}
              placeholder="Введите логин"
              className={errors.username && errors.username.trim() ? 'input--error' : ''}
              autoFocus
            />
            {errors.username && errors.username.trim() && <span className="field-error">{errors.username}</span>}
          </div>

          <div className="modal-field">
            <label>Пароль</label>
            <input
              type="password"
              value={password}
              onChange={handlePasswordChange}
              placeholder="Введите пароль"
              className={errors.password && errors.password.trim() ? 'input--error' : ''}
            />
            {errors.password && errors.password.trim() && <span className="field-error">{errors.password}</span>}
          </div>

          <button
            type="submit"
            className="modal-btn"
            disabled={loading}
          >
            {loading ? 'Вход...' : 'Войти'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default LoginModal;
