import { useState, useEffect } from 'react';
import { getUserStats } from '../../../api/usersApi';
import LoadingDots from '../../../components/LoadingDots/LoadingDots';
import './UserStatsModal.css';

const UserStatsModal = ({ isOpen, onClose, user }) => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && user) {
      loadStats();
    }
  }, [isOpen, user]);

  const loadStats = async () => {
    setLoading(true);
    try {
      const data = await getUserStats(user.uuid);
      setStats(data);
    } catch (error) {
      console.error('Ошибка загрузки статистики:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (iso) => {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  if (!isOpen) return null;

  return (
    <div
      className="modal-overlay"
      onClick={onClose}
    >
      <div
        className="stats-modal-content"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="stats-modal-header">
          <h3>Статистика сотрудника</h3>
          <button
            className="modal-close"
            onClick={onClose}
          >
            ×
          </button>
        </div>

        <div className="stats-modal-body">
          {loading ? (
            <LoadingDots inline />
          ) : stats ? (
            <>
              <div className="stats-user-info">
                <h4 className="stats-user-name">
                  {stats.lastname} {stats.name}
                </h4>
              </div>

              <div className="stats-summary">
                <div className="stats-card">
                  <span className="stats-card-label">Последняя работа</span>
                  <span className="stats-card-value">{formatDate(stats.last_work_date)}</span>
                </div>
                <div className="stats-card">
                  <span className="stats-card-label">Сегодня</span>
                  <span className="stats-card-value stats-card-value--highlight">{stats.today_quantity} шт.</span>
                </div>
                <div className="stats-card">
                  <span className="stats-card-label">За месяц</span>
                  <span className="stats-card-value stats-card-value--highlight">{stats.month_quantity} шт.</span>
                </div>
              </div>

              {stats.recent_items && stats.recent_items.length > 0 && (
                <div className="stats-recent">
                  <h4 className="stats-recent-title">Последние выполнения</h4>
                  <div className="stats-table-wrapper">
                    <table className="stats-table">
                      <thead>
                        <tr>
                          <th>Дата</th>
                          <th>Заказ</th>
                          <th>КМД</th>
                          <th>Марка</th>
                          <th>Деталь</th>
                          <th>Тип</th>
                          <th>Размер</th>
                          <th>Кол-во</th>
                        </tr>
                      </thead>
                      <tbody>
                        {stats.recent_items.map((item, index) => (
                          <tr key={item.id || index}>
                            <td>{formatDate(item.completion_date)}</td>
                            <td>
                              <div className="stats-cell-order">
                                <span className="stats-order-num">№{item.order_num}</span>
                                <span className="stats-order-name">{item.order_name}</span>
                              </div>
                            </td>
                            <td>{item.kmd_num || '—'}</td>
                            <td>
                              <span className="stats-mark">
                                {item.mark_title} {item.mark_name}
                              </span>
                            </td>
                            <td>{item.detail_num || '—'}</td>
                            <td>{item.detail_type || '—'}</td>
                            <td>{item.detail_size || '—'}</td>
                            <td className="stats-quantity">{item.quantity} шт.</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {stats.pagination && stats.pagination.total_items === 0 && <div className="stats-empty">Нет данных о выполненных работах</div>}
            </>
          ) : (
            <div className="stats-error">Не удалось загрузить статистику</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default UserStatsModal;
