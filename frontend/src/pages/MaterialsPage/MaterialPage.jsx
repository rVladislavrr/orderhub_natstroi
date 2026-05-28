import { useState, useEffect, useRef, useCallback } from 'react';
import LoadingDots from '../../components/LoadingDots/LoadingDots';
import { getActiveMaterials, getMaterialsByOrder, getAllActiveMaterials } from '../../api/materialsApi';
import { getOrders } from '../../api/ordersApi';
import { getStatusColor } from '../../utils/statusUtils';
import StockTab from './StockTab/StockTab';
import CreateDeliveryTab from './CreateDeliveryTab/CreateDeliveryTab';
import './MaterialPage.css';
import TrucksTab from './TrucksTab/TrucksTab';

const PAGE_LIMIT = 30;

const TABS = [
  { id: 'active', label: 'Все активные заказы' },
  { id: 'order', label: 'По заказу' },
  { id: 'stock', label: 'Складской остаток' },
  { id: 'create', label: 'Создать поставку' },
  { id: 'trucks', label: 'История поставок' },
];

export default function MaterialsPage() {
  const [mode, setMode] = useState('active');
  const [trucksRefreshKey, setTrucksRefreshKey] = useState(0);
  const [hideZeroDeficit, setHideZeroDeficit] = useState(false);

  const [selectedOrder, setSelectedOrder] = useState(null);
  const [orderDropdownOpen, setOrderDropdownOpen] = useState(false);
  const [orderSearch, setOrderSearch] = useState('');
  const [orders, setOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersHasLoaded, setOrdersHasLoaded] = useState(false);

  const [activeData, setActiveData] = useState(null);
  const [activeRows, setActiveRows] = useState([]);
  const [activePage, setActivePage] = useState(1);
  const [activeHasMore, setActiveHasMore] = useState(false);
  const [activeLoading, setActiveLoading] = useState(false);
  const [activeLoadingMore, setActiveLoadingMore] = useState(false);
  const [activeError, setActiveError] = useState(null);

  const [orderData, setOrderData] = useState(null);
  const [orderRows, setOrderRows] = useState([]);
  const [orderPage, setOrderPage] = useState(1);
  const [orderHasMore, setOrderHasMore] = useState(false);
  const [orderLoading, setOrderLoading] = useState(false);
  const [orderLoadingMore, setOrderLoadingMore] = useState(false);
  const [orderError, setOrderError] = useState(null);

  const [printRows, setPrintRows] = useState(null);
  const [printLoading, setPrintLoading] = useState(false);

  const bottomRef = useRef(null);
  const observerRef = useRef(null);
  const dropdownRef = useRef(null);
  const modeRef = useRef(mode);
  const selectedOrderRef = useRef(selectedOrder);
  const hideZeroDeficitRef = useRef(hideZeroDeficit);

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);
  useEffect(() => {
    selectedOrderRef.current = selectedOrder;
  }, [selectedOrder]);
  useEffect(() => {
    hideZeroDeficitRef.current = hideZeroDeficit;
  }, [hideZeroDeficit]);

  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOrderDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const fetchOrders = useCallback(async () => {
    setOrdersLoading(true);
    try {
      const data = await getOrders(1, 100);
      setOrders(data.orders ?? data.rows ?? []);
    } catch (e) {
      console.error('Ошибка загрузки заказов', e);
    } finally {
      setOrdersLoading(false);
      setOrdersHasLoaded(true);
    }
  }, []);

  const fetchActive = useCallback(async (page = 1, append = false, hide_zero_deficit = false) => {
    if (page === 1) setActiveLoading(true);
    else setActiveLoadingMore(true);
    setActiveError(null);
    try {
      const data = await getActiveMaterials(page, PAGE_LIMIT, hide_zero_deficit);
      setActiveData(data);
      setActiveRows((prev) => (append ? [...prev, ...data.rows] : data.rows));
      setActivePage(page);
      setActiveHasMore(data.pagination?.has_more ?? false);
    } catch (e) {
      setActiveError(e.message);
    } finally {
      setActiveLoading(false);
      setActiveLoadingMore(false);
    }
  }, []);

  const fetchOrder = useCallback(async (uuid, page = 1, append = false, hide_zero_deficit = false) => {
    if (!uuid) return;
    if (page === 1) setOrderLoading(true);
    else setOrderLoadingMore(true);
    setOrderError(null);
    try {
      const data = await getMaterialsByOrder(uuid, page, PAGE_LIMIT, hide_zero_deficit);
      setOrderData(data);
      setOrderRows((prev) => (append ? [...prev, ...data.rows] : data.rows));
      setOrderPage(page);
      setOrderHasMore(data.pagination?.has_more ?? false);
    } catch (e) {
      setOrderError(e.message);
    } finally {
      setOrderLoading(false);
      setOrderLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    if (mode === 'active') fetchActive(1, false, hideZeroDeficit);
  }, [mode]);

  useEffect(() => {
    if (orderDropdownOpen && !ordersHasLoaded) fetchOrders();
  }, [orderDropdownOpen]);

  useEffect(() => {
    if (selectedOrder) {
      setOrderRows([]);
      setOrderData(null);
      setOrderPage(1);
      fetchOrder(selectedOrder.uuid, 1, false, hideZeroDeficit);
    }
  }, [selectedOrder]);

  useEffect(() => {
    if (mode === 'active') {
      setActivePage(1);
      fetchActive(1, false, hideZeroDeficit);
    } else if (mode === 'order' && selectedOrder) {
      setOrderPage(1);
      fetchOrder(selectedOrder.uuid, 1, false, hideZeroDeficit);
    }
  }, [hideZeroDeficit]);

  useEffect(() => {
    if (observerRef.current) observerRef.current.disconnect();
    const isActive = mode === 'active';
    const hasMore = isActive ? activeHasMore : orderHasMore;
    const loadingMore = isActive ? activeLoadingMore : orderLoadingMore;
    if (!hasMore || loadingMore) return;

    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          const currentMode = modeRef.current;
          const currentOrder = selectedOrderRef.current;
          const currentHideDeficit = hideZeroDeficitRef.current;
          if (currentMode === 'active') fetchActive(activePage + 1, true, currentHideDeficit);
          else if (currentOrder?.uuid) fetchOrder(currentOrder.uuid, orderPage + 1, true, currentHideDeficit);
        }
      },
      { threshold: 0.1 },
    );
    if (bottomRef.current) observerRef.current.observe(bottomRef.current);
    return () => {
      if (observerRef.current) observerRef.current.disconnect();
    };
  }, [mode, activeHasMore, activeLoadingMore, activePage, orderHasMore, orderLoadingMore, orderPage, selectedOrder]);

  const handleModeSwitch = (m) => {
    setMode(m);
    if (m === 'active' && !activeData) fetchActive(1, false, hideZeroDeficit);
  };

  const handleToggleDropdown = () => setOrderDropdownOpen((v) => !v);
  const handleSelectOrder = (order) => {
    setSelectedOrder(order);
    setOrderDropdownOpen(false);
    setOrderSearch('');
  };

  const refreshActive = () => {
    setActiveRows([]);
    setActivePage(1);
    fetchActive(1, false, hideZeroDeficit);
  };

  const refreshOrder = () => {
    if (selectedOrder) {
      setOrderRows([]);
      setOrderPage(1);
      fetchOrder(selectedOrder.uuid, 1, false, hideZeroDeficit);
    }
  };

  const handlePrint = async (title) => {
    if (mode === 'active') {
      setPrintLoading(true);
      try {
        const data = await getAllActiveMaterials(hideZeroDeficit);
        setPrintRows(data.rows ?? []);
        const originalTitle = document.title;
        document.title = title;
        setTimeout(() => {
          window.print();
          document.title = originalTitle;
          setPrintRows(null);
          setPrintLoading(false);
        }, 150);
      } catch (e) {
        setPrintLoading(false);
        console.error('Ошибка загрузки для печати', e);
      }
    } else {
      const originalTitle = document.title;
      document.title = title;
      window.print();
      document.title = originalTitle;
    }
  };

  const filteredOrders = orders.filter((o) => {
    const q = orderSearch.toLowerCase();
    return String(o.internal_num_orders ?? '').includes(q) || (o.name ?? '').toLowerCase().includes(q);
  });

  const activeColumns = activeData?.columns ?? [];
  const orderColumns = orderData?.columns ?? [];
  const currentColumns = mode === 'active' ? activeColumns : orderColumns;
  const currentRows = mode === 'active' ? activeRows : orderRows;
  const currentData = mode === 'active' ? activeData : orderData;
  const currentLoading = mode === 'active' ? activeLoading : orderLoading;
  const currentLoadingMore = mode === 'active' ? activeLoadingMore : orderLoadingMore;
  const currentError = mode === 'active' ? activeError : orderError;
  const currentHasMore = mode === 'active' ? activeHasMore : orderHasMore;

  const printColumns = mode === 'active' && printRows ? activeColumns : currentColumns;
  const printData = mode === 'active' ? activeData : orderData;

  const formatNum = (n) => (n == null ? '—' : n === 0 ? <span className="mat-zero">—</span> : n.toLocaleString('ru-RU'));

  const isTableMode = mode === 'active' || mode === 'order';

  const RefreshButton = ({ onClick }) => (
    <button
      className="mat-refresh-btn"
      onClick={onClick}
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
  );

  const Toggle = ({ checked, onChange }) => (
    <label className="mat-toggle-label">
      <span className="mat-toggle-text">Скрыть нулевой дефицит</span>
      <div
        className={`mat-toggle ${checked ? 'mat-toggle--on' : ''}`}
        onClick={() => onChange(!checked)}
      >
        <div className="mat-toggle-thumb" />
      </div>
    </label>
  );

  const OrderDropdown = (
    <div
      className="mat-order-dropdown mat-order-dropdown--inline"
      ref={dropdownRef}
    >
      <button
        className={`mat-order-toggle ${selectedOrder ? 'mat-order-toggle--selected' : ''}`}
        onClick={handleToggleDropdown}
      >
        <span className="mat-order-toggle-text">{selectedOrder ? `№${selectedOrder.internal_num_orders} — ${selectedOrder.name}` : 'Выберите заказ...'}</span>
        <svg
          className={`mat-order-arrow ${orderDropdownOpen ? 'mat-order-arrow--open' : ''}`}
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
        >
          <path
            d="M6 9l6 6 6-6"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {orderDropdownOpen && (
        <div className="mat-order-menu">
          {ordersLoading && <div className="mat-order-loading-bar" />}
          <div className="mat-order-search-wrap">
            <svg
              className="mat-order-search-icon"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
            >
              <circle
                cx="11"
                cy="11"
                r="8"
                strokeWidth="2"
              />
              <path
                d="M21 21l-4.35-4.35"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
            <input
              className="mat-order-search-input"
              type="text"
              placeholder="Поиск по номеру или названию..."
              value={orderSearch}
              onChange={(e) => setOrderSearch(e.target.value)}
              autoFocus
            />
          </div>
          <div className="mat-order-list">
            {!ordersHasLoaded && <div className="mat-order-empty">Загрузка заказов...</div>}
            {ordersHasLoaded && filteredOrders.length === 0 && <div className="mat-order-empty">Заказы не найдены</div>}
            {ordersHasLoaded &&
              filteredOrders.map((order) => (
                <div
                  key={order.uuid}
                  className={`mat-order-option ${selectedOrder?.uuid === order.uuid ? 'mat-order-option--active' : ''}`}
                  style={{ '--status-color': getStatusColor(order.status) }}
                  onClick={() => handleSelectOrder(order)}
                >
                  <span className="mat-order-num">№{order.internal_num_orders}</span>
                  <span className="mat-order-name">{order.name}</span>
                  {order.status && <span className="mat-order-status-badge">{order.status}</span>}
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );

  const TableContent = ({ rows, columns, data }) => (
    <table className="mat-table">
      <thead>
        <tr>
          <th className="mat-th mat-th-sticky mat-th-profile">Профиль</th>
          <th className="mat-th mat-th-sticky mat-th-grade">Марка стали</th>
          {columns.map((col) => (
            <th
              key={col}
              className="mat-th mat-th-col"
            >
              {col}
            </th>
          ))}
          <th className="mat-th mat-th-total">Итого</th>
          <th className="mat-th mat-th-deficit">Дефицит</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr
            key={`${row.profile}-${row.steel_grade}-${i}`}
            className="mat-row"
          >
            <td className="mat-td mat-td-sticky mat-td-profile">{row.profile}</td>
            <td className="mat-td mat-td-sticky mat-td-grade">
              <span className="mat-grade-badge">{row.steel_grade}</span>
            </td>
            {columns.map((col) => (
              <td
                key={col}
                className="mat-td mat-td-num"
              >
                {formatNum(row.totals?.[col])}
              </td>
            ))}
            <td className="mat-td mat-td-num mat-td-grand">{row.grand_total?.toLocaleString('ru-RU')}</td>
            <td className={`mat-td mat-td-num ${(row.deficit ?? 0) > 0 ? 'mat-td-deficit' : 'mat-td-deficit--zero'}`}>{row.deficit != null ? row.deficit.toLocaleString('ru-RU') : '—'}</td>
          </tr>
        ))}
      </tbody>
      {data?.column_totals && (
        <tfoot>
          <tr className="mat-foot-row">
            <td
              className="mat-td mat-td-sticky mat-foot-label"
              colSpan={2}
            >
              Итого
            </td>
            {columns.map((col) => (
              <td
                key={col}
                className="mat-td mat-td-num mat-foot-num"
              >
                {data.column_totals[col]?.toLocaleString('ru-RU') ?? '—'}
              </td>
            ))}
            <td className="mat-td mat-td-num mat-foot-num mat-td-grand">{data.grand_total?.toLocaleString('ru-RU')}</td>
            <td className="mat-td mat-td-num mat-foot-num mat-td-grand">{data.total_deficit?.toLocaleString('ru-RU') ?? '—'}</td>
          </tr>
        </tfoot>
      )}
    </table>
  );

  return (
    <div className="materials-page">
      <div className="mat-header">
        <h1 className="mat-title">Склад материалов</h1>
        <p className="mat-subtitle">Профили и сталь по заказам</p>
      </div>

      <div className="mat-controls">
        <div className="mat-mode-tabs">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              className={`mat-tab ${mode === tab.id ? 'mat-tab--active' : ''}`}
              onClick={() => handleModeSwitch(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {mode === 'stock' && <StockTab />}
      {mode === 'create' && (
        <CreateDeliveryTab
          onCreated={() => {
            setTrucksRefreshKey((k) => k + 1);
          }}
        />
      )}
      {mode === 'trucks' && <TrucksTab refreshKey={trucksRefreshKey} />}

      {isTableMode && (
        <>
          {mode === 'order' && <div className="mat-order-selector-row">{OrderDropdown}</div>}

          {mode === 'order' && orderData && (
            <div className="mat-order-meta">
              {orderData.order && (
                <>
                  <span className="mat-meta-item">
                    <span className="mat-meta-label">Заказ:</span>
                    <span className="mat-meta-value">№{orderData.order.internal_num_orders}</span>
                  </span>
                  <span className="mat-meta-sep" />
                  <span className="mat-meta-item">
                    <span className="mat-meta-label">Название:</span>
                    <span className="mat-meta-value">{orderData.order.name}</span>
                  </span>
                  <span className="mat-meta-sep" />
                  <span className="mat-meta-item">
                    <span className="mat-meta-label">Статус:</span>
                    <span className="mat-meta-value">{orderData.order.status}</span>
                  </span>
                </>
              )}
              <span className="mat-meta-item mat-meta-right">
                <span className="mat-meta-label">Итого:</span>
                <span className="mat-meta-value mat-meta-total">{currentData?.grand_total?.toLocaleString('ru-RU')} кг</span>
              </span>
              <RefreshButton onClick={refreshOrder} />
            </div>
          )}

          {mode === 'active' && activeData && (
            <div className="mat-order-meta">
              <span className="mat-meta-item">
                <span className="mat-meta-label">Активных заказов:</span>
                <span className="mat-meta-value">{activeData.orders_count}</span>
              </span>
              <span className="mat-meta-item mat-meta-right">
                <span className="mat-meta-label">Итого:</span>
                <span className="mat-meta-value mat-meta-total">{currentData?.grand_total?.toLocaleString('ru-RU')} кг</span>
              </span>
              <RefreshButton onClick={refreshActive} />
            </div>
          )}

          {currentError && (
            <div className="mat-error">
              <span>Нет КМД для этого заказа</span>
            </div>
          )}

          {currentLoading && !currentRows.length && <LoadingDots />}

          {currentRows.length > 0 && (
            <>
              <div className="mat-print-bar">
                <Toggle
                  checked={hideZeroDeficit}
                  onChange={setHideZeroDeficit}
                />
                <button
                  className="print-button"
                  onClick={() => handlePrint(mode === 'order' ? `Заказ №${selectedOrder?.internal_num_orders}` : 'Все активные заказы')}
                  disabled={printLoading}
                >
                  {printLoading ? 'Загрузка...' : 'Распечатать'}
                </button>
              </div>

              <div className={`mat-print-container${mode === 'active' && printRows ? ' mat-screen-only' : ''}`}>
                <div
                  className="mat-table-wrapper"
                  style={{ opacity: currentLoading ? 0.5 : 1, transition: 'opacity 0.2s' }}
                >
                  <TableContent
                    rows={currentRows}
                    columns={currentColumns}
                    data={currentData}
                  />
                </div>
              </div>

              {mode === 'active' && printRows && (
                <div className="mat-print-container mat-print-only">
                  <div className="mat-table-wrapper">
                    <TableContent
                      rows={printRows}
                      columns={printColumns}
                      data={printData}
                    />
                  </div>
                </div>
              )}
            </>
          )}

          {!currentLoading && !currentError && currentRows.length === 0 && mode === 'order' && selectedOrder && <div className="mat-empty">Нет данных по этому заказу</div>}
          {!currentLoading && !currentError && currentRows.length === 0 && mode === 'order' && !selectedOrder && <div className="mat-empty">Выберите заказ для просмотра материалов</div>}

          <div
            ref={bottomRef}
            className="mat-bottom-sentinel"
          >
            {currentLoadingMore && <LoadingDots />}
            {!currentLoadingMore && currentHasMore && <div className="mat-load-hint">Загружаем ещё...</div>}
          </div>
        </>
      )}
    </div>
  );
}
