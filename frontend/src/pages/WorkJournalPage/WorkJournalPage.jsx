import { useState, useEffect, useRef, useCallback } from 'react';
import { getWorkJournal } from '../../api/workApi';
import LoadingDots from '../../components/LoadingDots/LoadingDots';
import EmptyState from '../../components/EmptyState/EmptyState';
import './WorkJournalPage.css';

const formatDate = (iso) => {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
};

const WorkJournalPage = () => {
  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);

  const observerRef = useRef(null);
  const sentinelRef = useRef(null);

  const fetchJournal = useCallback(async (p = 1, append = false) => {
    if (p === 1) {
      setLoading(true);
    } else {
      setLoadingMore(true);
    }
    setError(null);

    try {
      const data = await getWorkJournal({ page: p, limit: 20 });

      if (append) {
        setItems((prev) => [...prev, ...(data.items || [])]);
      } else {
        setItems(data.items || []);
      }

      setPagination(data.pagination);
    } catch (e) {
      console.error('Ошибка загрузки журнала:', e);
      setError('Не удалось загрузить журнал работ');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    fetchJournal(1);
  }, [fetchJournal]);

  // Бесконечный скролл
  useEffect(() => {
    if (!pagination || !pagination.has_more || loading || loadingMore) return;

    if (observerRef.current) {
      observerRef.current.disconnect();
    }

    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && pagination.has_more && !loadingMore) {
          fetchJournal(pagination.next_page, true);
        }
      },
      { threshold: 0.1 },
    );

    if (sentinelRef.current) {
      observerRef.current.observe(sentinelRef.current);
    }

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [pagination, loading, loadingMore, fetchJournal]);

  const handlePageChange = (newPage) => {
    setPage(newPage);
    fetchJournal(newPage);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="journal-page">
      <div className="journal-header">
        <div className="journal-header-left">
          <h1 className="journal-title">Журнал работ</h1>
          {pagination && <span className="journal-total-badge">{pagination.total_items} записей</span>}
        </div>
      </div>

      {error && (
        <div className="journal-error">
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <LoadingDots />
      ) : items.length === 0 ? (
        <EmptyState
          type="journal"
          title="Журнал пуст"
          subtitle="Здесь будут отображаться все выполненные работы"
        />
      ) : (
        <>
          <div className="journal-table-wrapper">
            <table className="journal-table">
              <thead>
                <tr>
                  <th>Дата</th>
                  <th>Сотрудник</th>
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
                {items.map((item) => (
                  <tr key={item.id}>
                    <td className="journal-date">{formatDate(item.completion_date)}</td>
                    <td>
                      <div className="journal-user">
                        <span className="journal-user-name">
                          {item.user?.lastname} {item.user?.name}
                        </span>
                      </div>
                    </td>
                    <td>
                      <div className="journal-order">
                        <span className="journal-order-num">№{item.relation?.internal_num_orders}</span>
                        <span className="journal-order-name">{item.relation?.order_name}</span>
                      </div>
                    </td>
                    <td>{item.relation?.kmd_num || '—'}</td>
                    <td>
                      <span className="journal-mark">
                        {item.relation?.mark_title} {item.relation?.mark_name}
                      </span>
                    </td>
                    <td>{item.relation?.detail_num || '—'}</td>
                    <td>{item.relation?.detail_type || '—'}</td>
                    <td>{item.relation?.detail_size || '—'}</td>
                    <td className="journal-quantity">{item.quantity} шт.</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {loadingMore && <LoadingDots inline />}

          <div
            ref={sentinelRef}
            className="journal-sentinel"
          />

          {pagination && pagination.total_pages > 1 && (
            <div className="journal-pagination">
              <button
                className="journal-page-btn"
                disabled={!pagination.has_previous}
                onClick={() => handlePageChange(pagination.previous_page)}
              >
                ←
              </button>
              <span className="journal-page-info">
                {pagination.page} / {pagination.total_pages}
              </span>
              <button
                className="journal-page-btn"
                disabled={!pagination.has_more}
                onClick={() => handlePageChange(pagination.next_page)}
              >
                →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default WorkJournalPage;
