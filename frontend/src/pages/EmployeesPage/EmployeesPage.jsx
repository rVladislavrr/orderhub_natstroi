import { useState, useEffect, useCallback } from 'react';
import { getUsers } from '../../api/usersApi';
import CreateUserModal from './CreateUserModal';
import LoadingDots from '../../components/LoadingDots/LoadingDots';
import './EmployeesPage.css';

const formatDate = (iso) => {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
};

const EmployeesPage = () => {
  const [users, setUsers] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  const fetchUsers = useCallback(async (p = 1) => {
    setLoading(true);
    try {
      const data = await getUsers(p, 10);
      setUsers(data.users);
      setPagination(data.pagination);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers(page);
  }, [page, fetchUsers]);

  const handleCreated = () => fetchUsers(page);

  return (
    <div className="emp-page">
      <div className="emp-top-row">
        <div className="emp-top-left">
          <h1 className="emp-heading">Сотрудники</h1>
          {pagination && <span className="emp-total-badge">{pagination.total_items}</span>}
        </div>
        <button
          className="emp-btn emp-btn--primary"
          onClick={() => setShowModal(true)}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line
              x1="12"
              y1="5"
              x2="12"
              y2="19"
            />
            <line
              x1="5"
              y1="12"
              x2="19"
              y2="12"
            />
          </svg>
          Добавить сотрудника
        </button>
      </div>

      <div className="emp-table-wrapper">
        {loading ? (
          <LoadingDots inline />
        ) : users.length === 0 ? (
          <div className="emp-empty">Сотрудники не найдены</div>
        ) : (
          <table className="emp-table">
            <thead>
              <tr>
                <th>Имя</th>
                <th>Фамилия</th>
                <th>Статус</th>
                <th>Дата создания</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.uuid}>
                  <td>{u.name}</td>
                  <td>{u.lastname}</td>
                  <td>
                    <span className={`emp-status-badge ${u.is_active ? 'emp-status-badge--active' : 'emp-status-badge--inactive'}`}>{u.is_active ? 'Активен' : 'Неактивен'}</span>
                  </td>
                  <td>{formatDate(u.create_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {pagination && pagination.total_pages > 1 && (
        <div className="emp-pagination">
          <button
            className="emp-page-btn"
            disabled={!pagination.has_previous}
            onClick={() => setPage((p) => p - 1)}
          >
            ←
          </button>
          <span className="emp-page-info">
            {pagination.page} / {pagination.total_pages}
          </span>
          <button
            className="emp-page-btn"
            disabled={!pagination.has_more}
            onClick={() => setPage((p) => p + 1)}
          >
            →
          </button>
        </div>
      )}

      {showModal && (
        <CreateUserModal
          onClose={() => setShowModal(false)}
          onCreated={handleCreated}
        />
      )}
    </div>
  );
};

export default EmployeesPage;
