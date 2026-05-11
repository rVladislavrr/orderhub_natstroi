import { useState, useEffect, useCallback } from 'react';
import { getUsers, getUser } from '../../api/usersApi';
import UserModal from './UserModal';
import LoadingDots from '../../components/LoadingDots/LoadingDots';
import EmptyState from '../../components/EmptyState/EmptyState';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'react-toastify';
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
  const [editUser, setEditUser] = useState(null);
  const [editLoading, setEditLoading] = useState(null);
  const { user: currentUser } = useAuth();

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

  const handleEdit = async (u) => {
    setEditLoading(u.uuid);
    try {
      const full = await getUser(u.uuid);
      setEditUser(full);
      setShowModal(true);
    } catch (e) {
      toast.error('Не удалось загрузить данные сотрудника');
    } finally {
      setEditLoading(null);
    }
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditUser(null);
  };

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
          <EmptyState
            type="employees"
            title="Сотрудников пока нет"
            subtitle="Нажмите «Добавить сотрудника», чтобы создать первого"
          />
        ) : (
          <table className="emp-table">
            <thead>
              <tr>
                <th>Имя</th>
                <th>Фамилия</th>
                <th>Статус</th>
                <th>Дата создания</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const isSelf = u.uuid === currentUser?.uuid;
                return (
                  <tr key={u.uuid}>
                    <td>{u.name}</td>
                    <td>{u.lastname}</td>
                    <td>
                      <span className={`emp-status-badge ${u.is_active ? 'emp-status-badge--active' : 'emp-status-badge--inactive'}`}>{u.is_active ? 'Активен' : 'Неактивен'}</span>
                    </td>
                    <td>{formatDate(u.create_at)}</td>
                    <td>
                      {!isSelf && (
                        <button
                          className="emp-edit-btn"
                          onClick={() => handleEdit(u)}
                          disabled={editLoading === u.uuid}
                          title="Редактировать"
                        >
                          {editLoading === u.uuid ? (
                            <svg
                              width="15"
                              height="15"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              style={{ opacity: 0.4 }}
                            >
                              <circle
                                cx="12"
                                cy="12"
                                r="10"
                              />
                            </svg>
                          ) : (
                            <svg
                              width="15"
                              height="15"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                            </svg>
                          )}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
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
        <UserModal
          onClose={handleCloseModal}
          onCreated={handleCreated}
          user={editUser}
        />
      )}
    </div>
  );
};

export default EmployeesPage;
