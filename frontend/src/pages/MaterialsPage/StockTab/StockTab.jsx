import { useState, useEffect, useCallback } from 'react';
import LoadingDots from '../../../components/LoadingDots/LoadingDots';
import { getStock, checkMetal, allocateStock } from '../../../api/deliveryApi';
import './StockTab.css';
import { toast } from 'react-toastify';

export default function StockTab() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [checkPanel, setCheckPanel] = useState(null);
  const [checkLoading, setCheckLoading] = useState(false);

  const [allocating, setAllocating] = useState({});
  const [allocateInputs, setAllocateInputs] = useState({});
  const [allocateSuccess, setAllocateSuccess] = useState({});
  const [allocateError, setAllocateError] = useState({});

  const fetchStock = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getStock();
      setRows(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStock();
  }, [fetchStock]);

  const rowKey = (row) => `${row.profile_type}__${row.profile_size}__${row.steel_grade}`;

  const handleCheck = async (row) => {
    const key = rowKey(row);
    if (checkPanel?.rowKey === key) {
      setCheckPanel(null);
      return;
    }
    setCheckLoading(true);
    setCheckPanel({ rowKey: key, data: null });
    try {
      const data = await checkMetal(row.profile_type, row.profile_size, row.steel_grade);
      setCheckPanel({ rowKey: key, data });
    } catch (e) {
      setCheckPanel({ rowKey: key, data: null, error: e.message });
    } finally {
      setCheckLoading(false);
    }
  };

  const handleAllocate = async (row, kmd_uuid) => {
    const weight = parseFloat(allocateInputs[kmd_uuid]);
    if (!weight || weight <= 0) return;

    setAllocating((p) => ({ ...p, [kmd_uuid]: true }));
    setAllocateError((p) => ({ ...p, [kmd_uuid]: null }));
    try {
      await allocateStock(row.profile_type, row.profile_size, row.steel_grade, kmd_uuid, weight);
      setAllocateSuccess((p) => ({ ...p, [kmd_uuid]: true }));
      setAllocateInputs((p) => ({ ...p, [kmd_uuid]: '' }));

      toast.success('Успешно распределено!');

      await fetchStock();

      const data = await checkMetal(row.profile_type, row.profile_size, row.steel_grade);
      setCheckPanel((prev) => (prev ? { ...prev, data } : prev));
      setTimeout(() => setAllocateSuccess((p) => ({ ...p, [kmd_uuid]: false })), 2000);
    } catch (e) {
      setAllocateError((p) => ({ ...p, [kmd_uuid]: e.message }));
    } finally {
      setAllocating((p) => ({ ...p, [kmd_uuid]: false }));
    }
  };

  if (loading) return <LoadingDots />;
  if (error) return <div className="stock-error">Ошибка загрузки: {error}</div>;
  if (!rows.length) return <div className="stock-empty">Складской остаток пуст</div>;

  return (
    <div className="stock-tab">
      <div className="stock-summary-bar">
        <span className="stock-summary-count">{rows.length} позиций на складе</span>
        <button
          className="stock-refresh-btn"
          onClick={fetchStock}
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

      <div className="stock-table-wrapper">
        <table className="stock-table">
          <thead>
            <tr>
              <th className="stock-th">Тип профиля</th>
              <th className="stock-th">Размер</th>
              <th className="stock-th">Марка стали</th>
              <th className="stock-th stock-th-right">Остаток, кг</th>
              <th className="stock-th" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const key = rowKey(row);
              const isOpen = checkPanel?.rowKey === key;
              return (
                <>
                  <tr
                    key={key}
                    className={`stock-row ${isOpen ? 'stock-row--open' : ''}`}
                  >
                    <td className="stock-td stock-td-type">{row.profile_type}</td>
                    <td className="stock-td">
                      <span className="stock-size-badge">{row.profile_size}</span>
                    </td>
                    <td className="stock-td">
                      <span className="mat-grade-badge">{row.steel_grade}</span>
                    </td>
                    <td className="stock-td stock-td-right stock-td-weight">{row.stock_weight?.toLocaleString('ru-RU')}</td>
                    <td className="stock-td stock-td-actions">
                      <button
                        className={`stock-check-btn ${isOpen ? 'stock-check-btn--active' : ''}`}
                        onClick={() => handleCheck(row)}
                      >
                        {isOpen ? 'Скрыть' : 'Проверить'}
                      </button>
                    </td>
                  </tr>

                  {isOpen && (
                    <tr
                      key={`${key}-panel`}
                      className="stock-panel-row"
                    >
                      <td
                        colSpan={5}
                        className="stock-panel-cell"
                      >
                        {checkLoading && !checkPanel.data && <LoadingDots />}
                        {checkPanel.error && <div className="stock-panel-error">{checkPanel.error}</div>}
                        {checkPanel.data && (
                          <CheckPanel
                            data={checkPanel.data}
                            row={row}
                            allocating={allocating}
                            allocateInputs={allocateInputs}
                            allocateSuccess={allocateSuccess}
                            allocateError={allocateError}
                            onInputChange={(uuid, val) => setAllocateInputs((p) => ({ ...p, [uuid]: val }))}
                            onAllocate={(uuid) => handleAllocate(row, uuid)}
                          />
                        )}
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CheckPanel({ data, allocating, allocateInputs, allocateSuccess, allocateError, onInputChange, onAllocate }) {
  const freeWeight = data.stock_weight ?? 0;

  return (
    <div className="check-panel">
      <div className="check-panel-header">
        <div className="check-panel-stock">
          <span className="check-panel-stock-label">На складе:</span>
          <span className="check-panel-stock-val">{data.stock_weight?.toLocaleString('ru-RU')} кг</span>
        </div>
        <div className="check-panel-free">
          <span className="check-panel-free-label">Доступно:</span>
          <span className="check-panel-free-val">{freeWeight?.toLocaleString('ru-RU')} кг</span>
        </div>
      </div>

      {!data.orders?.length ? (
        <div className="check-panel-empty">Нет заказов, которым нужен этот металл</div>
      ) : (
        <div className="check-panel-orders">
          <div className="check-orders-head">
            <span>КМД</span>
            <span className="check-col-right">Потребность</span>
            <span className="check-col-right">Распределено</span>
            <span className="check-col-right">Дефицит</span>
            <span className="check-col-right">Доступно</span>
            <span />
          </div>
          {data.orders.map((o) => {
            const hasDeficit = o.deficit > 0;
            const inputVal = allocateInputs[o.kmd_uuid] ?? '';
            const inputNum = parseFloat(inputVal) || 0;
            const maxAllocate = Math.min(o.deficit, freeWeight);
            const isOverLimit = inputNum > maxAllocate;

            return (
              <div
                key={o.kmd_uuid}
                className="check-order-row"
              >
                <span className="check-order-num">{o.kmd_num}</span>
                <span className="check-col-right">{o.plan_weight?.toLocaleString('ru-RU')}</span>
                <span className="check-col-right">{o.allocated_weight?.toLocaleString('ru-RU')}</span>
                <span className={`check-col-right ${o.deficit > 0 ? 'check-deficit' : 'check-ok'}`}>{o.deficit?.toLocaleString('ru-RU')}</span>
                <span className={`check-col-right ${freeWeight > 0 && o.deficit > 0 ? 'check-available' : 'check-available--zero'}`}>{hasDeficit ? freeWeight.toLocaleString('ru-RU') : '—'}</span>
                <div className="check-allocate-cell">
                  {!hasDeficit ? (
                    <span className="check-no-deficit">Дефицита нет</span>
                  ) : freeWeight <= 0 ? (
                    <span className="check-no-deficit">Склад пуст</span>
                  ) : (
                    <>
                      <input
                        className={`check-alloc-input ${isOverLimit ? 'check-alloc-input--error' : ''}`}
                        type="number"
                        min="0.01"
                        max={maxAllocate}
                        step="0.01"
                        placeholder="кг"
                        value={inputVal}
                        onChange={(e) => onInputChange(o.kmd_uuid, e.target.value)}
                      />
                      <button
                        className={`check-alloc-btn ${allocateSuccess[o.kmd_uuid] ? 'check-alloc-btn--ok' : ''}`}
                        disabled={allocating[o.kmd_uuid] || !inputNum || inputNum <= 0 || isOverLimit}
                        onClick={() => onAllocate(o.kmd_uuid)}
                      >
                        {allocating[o.kmd_uuid] ? '...' : allocateSuccess[o.kmd_uuid] ? '✓' : 'Распределить'}
                      </button>
                      {isOverLimit && <span className="check-alloc-err">Макс: {maxAllocate?.toLocaleString('ru-RU')} кг</span>}
                      {allocateError[o.kmd_uuid] && !isOverLimit && <span className="check-alloc-err">{allocateError[o.kmd_uuid]}</span>}
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
