import { useState, useEffect, useCallback } from 'react';
import LoadingDots from '../../../components/LoadingDots/LoadingDots';
import { getTrucks, getTruckById } from '../../../api/deliveryApi';
import './TrucksTab.css';

export default function TrucksTab({ refreshKey }) {
  const [trucks, setTrucks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expanded, setExpanded] = useState(null);
  const [detailMap, setDetailMap] = useState({});

  const fetchTrucks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getTrucks();
      setTrucks(Array.isArray(data) ? data : (data.trucks ?? data.rows ?? []));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTrucks();
  }, [fetchTrucks, refreshKey]);

  const handleToggle = async (truck) => {
    const id = truck.id ?? truck.uuid;
    if (expanded === id) {
      setExpanded(null);
      return;
    }
    setExpanded(id);
    if (detailMap[id]) return;
    setDetailMap((p) => ({ ...p, [id]: 'loading' }));
    try {
      const data = await getTruckById(id);
      setDetailMap((p) => ({ ...p, [id]: data }));
    } catch (e) {
      setDetailMap((p) => ({ ...p, [id]: 'error' }));
    }
  };

  if (loading) return <LoadingDots />;
  if (error) return <div className="trucks-error">Ошибка загрузки: {error}</div>;
  if (!trucks.length)
    return (
      <div className="trucks-empty">
        <div>Поставок пока нет</div>
        <div className="trucks-empty-sub">Создайте первую поставку на вкладке «Создать поставку»</div>
      </div>
    );

  return (
    <div className="trucks-tab">
      <div className="trucks-toolbar">
        <span className="trucks-count">{trucks.length} поставок</span>
        <button
          className="trucks-refresh-btn"
          onClick={fetchTrucks}
          title="Обновить"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="23 4 23 10 17 10" />
            <polyline points="1 20 1 14 7 14" />
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
          </svg>
          Обновить
        </button>
      </div>

      <div className="trucks-list">
        {trucks.map((truck) => {
          const id = truck.id ?? truck.uuid;
          const isOpen = expanded === id;
          const detail = detailMap[id];

          return (
            <div
              key={id}
              className={`truck-card ${isOpen ? 'truck-card--open' : ''}`}
            >
              <div
                className="truck-card-header"
                onClick={() => handleToggle(truck)}
              >
                <div className="truck-card-left">
                  <div className="truck-card-icon">
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
                      <rect
                        x="1"
                        y="3"
                        width="15"
                        height="13"
                        rx="1"
                      />
                      <path d="M16 8h4l3 5v3h-7V8z" />
                      <circle
                        cx="5.5"
                        cy="18.5"
                        r="2.5"
                      />
                      <circle
                        cx="18.5"
                        cy="18.5"
                        r="2.5"
                      />
                    </svg>
                  </div>
                  <div>
                    <div className="truck-card-name">{truck.name}</div>
                    <div className="truck-card-meta">
                      {truck.delivery_date && (
                        <span className="truck-meta-date">
                          {new Date(truck.delivery_date).toLocaleDateString('ru-RU', {
                            day: 'numeric',
                            month: 'long',
                            year: 'numeric',
                          })}
                        </span>
                      )}
                      {truck.items_count != null && <span className="truck-meta-items">{truck.items_count} позиций</span>}
                      {truck.total_weight != null && <span className="truck-meta-weight">{truck.total_weight.toLocaleString('ru-RU')} кг</span>}
                    </div>
                  </div>
                </div>
                <div className="truck-card-right">
                  
                  <svg
                    className={`truck-arrow ${isOpen ? 'truck-arrow--open' : ''}`}
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  >
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                </div>
              </div>

              {isOpen && (
                <div className="truck-detail">
                  {detail === 'loading' && <LoadingDots />}
                  {detail === 'error' && <div className="truck-detail-error">Ошибка загрузки деталей</div>}
                  {detail && detail !== 'loading' && detail !== 'error' && (
                    <TruckDetail
                      truck={truck}
                      data={detail}
                    />
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TruckDetail({ truck, data }) {
  const items = data.items ?? (Array.isArray(data) ? data : []);
  const truckData = data.truck ?? data;

  return (
    <div className="truck-detail-inner">
      {(truckData.note || truck.note) && (
        <div className="truck-detail-note">
          <span className="truck-detail-note-label">Примечание:</span>
          <span>{truckData.note ?? truck.note}</span>
        </div>
      )}

      {!items.length ? (
        <div className="truck-detail-empty">Позиции не найдены</div>
      ) : (
        <div className="truck-items-list">
          {items.map((item, idx) => (
            <div
              key={idx}
              className="truck-item"
            >
              <div className="truck-item-header">
                <div className="truck-item-profile">
                  <span className="truck-item-type">{item.profile_type}</span>
                  <span className="truck-item-size">{item.profile_size}</span>
                  <span className="mat-grade-badge">{item.steel_grade}</span>
                </div>
                <div className="truck-item-weight">{item.total_weight?.toLocaleString('ru-RU')} кг</div>
              </div>

              {item.allocations?.length > 0 && (
                <div className="truck-item-allocs">
                  {item.allocations.map((alloc, ai) => (
                    <div
                      key={ai}
                      className="truck-alloc-row"
                    >
                      
                      <span className="truck-alloc-kmd">- КМД: {alloc.kmd_num ?? alloc.kmd_uuid}</span>
                      <span className="truck-alloc-weight">{alloc.allocated_weight?.toLocaleString('ru-RU')} кг</span>
                    </div>
                  ))}
                  {(() => {
                    const allocated = item.allocations.reduce((s, a) => s + (a.allocated_weight ?? 0), 0);
                    const remainder = (item.total_weight ?? 0) - allocated;
                    return remainder > 0.01 ? (
                      <div className="truck-alloc-row truck-alloc-row--stock">
                        <svg
                          width="10"
                          height="10"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="#0f766e"
                          strokeWidth="2"
                          strokeLinecap="round"
                        >
                          <polyline points="9 18 15 12 9 6" />
                        </svg>
                        <span className="truck-alloc-kmd truck-alloc-stock">→ На склад</span>
                        <span className="truck-alloc-weight truck-alloc-weight--stock">{remainder.toLocaleString('ru-RU')} кг</span>
                      </div>
                    ) : null;
                  })()}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
