import { useState } from 'react';
import { addUser, updatePermissions } from '../../api/usersApi';
import { toast } from 'react-toastify';

const PERMISSIONS = [
  { key: 'storage', label: 'Склад' },
  { key: 'order', label: 'Заказы' },
  { key: 'product', label: 'Продукты' },
  { key: 'role', label: 'Роли' },
];

const CreateUserModal = ({ onClose, onCreated }) => {
  const [form, setForm] = useState({
    username: '',
    password: '',
    name: '',
    lastname: '',
  });
  const [permissions, setPermissions] = useState({
    storage: 0,
    order: 0,
    product: 0,
    role: 0,
  });
  const [loading, setLoading] = useState(false);

  const handleField = (e) => setForm((p) => ({ ...p, [e.target.name]: e.target.value }));

  const togglePerm = (key) => setPermissions((p) => ({ ...p, [key]: p[key] ? 0 : 1 }));

  const handleSubmit = async () => {
    if (!form.username || !form.password || !form.name || !form.lastname) {
      toast.warn('Заполните все поля');
      return;
    }
    setLoading(true);
    try {
      const created = await addUser({
        ...form,
        is_login: true,
        is_active: true,
      });
      await updatePermissions(created.uuid, permissions);
      toast.success('Сотрудник успешно создан');
      onCreated();
      onClose();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Ошибка при создании пользователя');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="emp-modal-overlay"
      onClick={onClose}
    >
      <div
        className="emp-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="emp-modal-header">
          <h2 className="emp-modal-title">Новый сотрудник</h2>
          <button
            className="emp-modal-close"
            onClick={onClose}
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

        <div className="emp-modal-body">
          <div className="emp-form-grid">
            {[
              { name: 'name', label: 'Имя' },
              { name: 'lastname', label: 'Фамилия' },
              { name: 'username', label: 'Логин' },
              { name: 'password', label: 'Пароль', type: 'password' },
            ].map(({ name, label, type = 'text' }) => (
              <div
                className="emp-form-field"
                key={name}
              >
                <label className="emp-form-label">{label}</label>
                <input
                  className="emp-form-input"
                  type={type}
                  name={name}
                  value={form[name]}
                  onChange={handleField}
                  placeholder={label}
                  autoComplete="off"
                />
              </div>
            ))}
          </div>

          <div className="emp-perms-section">
            <p className="emp-perms-title">Права доступа</p>
            <div className="emp-perms-grid">
              {PERMISSIONS.map(({ key, label }) => (
                <button
                  key={key}
                  className={`emp-perm-chip ${permissions[key] ? 'emp-perm-chip--on' : ''}`}
                  onClick={() => togglePerm(key)}
                  type="button"
                >
                  <span className="emp-perm-chip-dot" />
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="emp-modal-footer">
          <button
            className="emp-btn emp-btn--ghost"
            onClick={onClose}
            disabled={loading}
          >
            Отмена
          </button>
          <button
            className="emp-btn emp-btn--primary"
            onClick={handleSubmit}
            disabled={loading}
          >
            {loading ? 'Создание…' : 'Создать'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CreateUserModal;
