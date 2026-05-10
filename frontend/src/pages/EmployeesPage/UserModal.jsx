import { useState } from 'react';
import { addUser, updateUser, updatePermissions } from '../../api/usersApi';
import { toast } from 'react-toastify';

const PERMISSIONS = [
  { key: 'storage', label: 'Склад' },
  { key: 'order', label: 'Заказы' },
  { key: 'queues', label: 'Очереди' },
  { key: 'role', label: 'Роли' },
];

const LEVELS = [
  { value: 0, label: 'Нет' },
  { value: 1, label: 'Чтение' },
  { value: 2, label: 'Полный' },
];

const UserModal = ({ onClose, onCreated, user = null }) => {
  const isEdit = Boolean(user);

  const [form, setForm] = useState({
    username: user?.username ?? '',
    password: '',
    name: user?.name ?? '',
    lastname: user?.lastname ?? '',
    is_login: user?.is_login ?? true,
    is_active: user?.is_active ?? true,
  });

  const [permissions, setPermissions] = useState({
    storage: user?.permissions?.storage ?? 0,
    order: user?.permissions?.order ?? 0,
    queues: user?.permissions?.queues ?? 0,
    role: user?.permissions?.role ?? 0,
  });

  const [loading, setLoading] = useState(false);

  const handleField = (e) => setForm((p) => ({ ...p, [e.target.name]: e.target.value }));
  const handleToggle = (key) => setForm((p) => ({ ...p, [key]: !p[key] }));

  const handleSubmit = async () => {
    if (!form.username || !form.name || !form.lastname || (!isEdit && !form.password)) {
      toast.warn('Заполните все поля');
      return;
    }

    setLoading(true);
    try {
      if (isEdit) {
        await updateUser(user.uuid, {
          username: form.username,
          name: form.name,
          lastname: form.lastname,
          is_login: form.is_login,
          is_active: form.is_active,
          password: form.password.trim() || null,
        });
        await updatePermissions(user.uuid, permissions);
        toast.success('Данные сотрудника обновлены');
      } else {
        const created = await addUser({
          username: form.username,
          password: form.password,
          name: form.name,
          lastname: form.lastname,
          is_login: form.is_login,
          is_active: true,
        });
        await updatePermissions(created.uuid, permissions);
        toast.success('Сотрудник успешно создан');
      }
      onCreated();
      onClose();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Ошибка при сохранении');
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
          <h2 className="emp-modal-title">{isEdit ? 'Редактировать сотрудника' : 'Новый сотрудник'}</h2>
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
              {
                name: 'password',
                label: isEdit ? 'Новый пароль' : 'Пароль',
                type: 'password',
                placeholder: isEdit ? 'Оставьте пустым, чтобы не менять' : 'Пароль',
              },
            ].map(({ name, label, type = 'text', placeholder }) => (
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
                  placeholder={placeholder ?? label}
                  autoComplete="off"
                />
              </div>
            ))}
          </div>

          <div className="emp-toggles-section">
            <div className="emp-toggle-row">
              <div className="emp-toggle-info">
                <span className="emp-toggle-label">Доступ к сайту</span>
                <span className="emp-toggle-hint">Пользователь сможет войти в систему</span>
              </div>
              <button
                type="button"
                className={`emp-toggle ${form.is_login ? 'emp-toggle--on' : ''}`}
                onClick={() => handleToggle('is_login')}
              >
                <span className="emp-toggle-thumb" />
              </button>
            </div>

            {isEdit && (
              <div className="emp-toggle-row">
                <div className="emp-toggle-info">
                  <span className="emp-toggle-label">Активен</span>
                  <span className="emp-toggle-hint">Неактивные сотрудники скрыты из выборок</span>
                </div>
                <button
                  type="button"
                  className={`emp-toggle ${form.is_active ? 'emp-toggle--on' : ''}`}
                  onClick={() => handleToggle('is_active')}
                >
                  <span className="emp-toggle-thumb" />
                </button>
              </div>
            )}
          </div>

          <div className="emp-perms-section">
            <p className="emp-perms-title">Права доступа</p>
            <div className="emp-perms-table">
              {PERMISSIONS.map(({ key, label }) => (
                <div
                  className="emp-perms-row"
                  key={key}
                >
                  <span className="emp-perms-row-label">{label}</span>
                  <div className="emp-perms-row-options">
                    {LEVELS.map(({ value, label: lvlLabel }) => (
                      <button
                        key={value}
                        type="button"
                        className={`emp-perm-option emp-perm-option--${value} ${permissions[key] === value ? 'emp-perm-option--active' : ''}`}
                        onClick={() => setPermissions((p) => ({ ...p, [key]: value }))}
                      >
                        {lvlLabel}
                      </button>
                    ))}
                  </div>
                </div>
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
            {loading ? (isEdit ? 'Сохранение…' : 'Создание…') : isEdit ? 'Сохранить' : 'Создать'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default UserModal;
