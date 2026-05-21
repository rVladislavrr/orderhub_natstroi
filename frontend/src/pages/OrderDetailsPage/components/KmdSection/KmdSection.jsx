import { useEffect, useState } from 'react';
import { getMarksFilters, getKmdInfo } from '../../../../api/ordersApi';
import './KmdSection.css';
import DropdownFilter from '../DropdownFilter/DropdownFilter';
import SortControls from '../SortControls/SortControls';
import MarksList from '../MarksList/MarksList';
import { getStatusColor } from '../../../../utils/statusUtils';

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

const KmdInfoCard = ({ kmd, loading, onRefresh }) => {
  const fmt = (n) => (n != null ? Number(n).toLocaleString('ru-RU') : '—');
  const fmtWeight = (n) => (n != null ? Number(n).toLocaleString('ru-RU', { maximumFractionDigits: 1 }) + ' кг' : '—');

  if (loading) return <div className="kmd-info-card kmd-info-card--loading">Загрузка...</div>;

  return (
    <div className="kmd-info-card">
      <div className="kmd-info-group">
        <div className="kmd-info-item">
          <span className="kmd-info-label">Статус</span>
          <span
            className="status-badge"
            style={{ backgroundColor: getStatusColor(kmd?.status) }}
          >
            {kmd?.status ?? '—'}
          </span>
        </div>
      </div>

      <div className="kmd-info-divider" />

      <div className="kmd-info-group">
        <div className="kmd-info-item">
          <span className="kmd-info-label">Уникальных марок</span>
          <span className="kmd-info-value">{fmt(kmd?.count_marks_uq)}</span>
        </div>
        <div className="kmd-info-item">
          <span className="kmd-info-label">Всего марок</span>
          <span className="kmd-info-value">{fmt(kmd?.count_marks)}</span>
        </div>
        <div className="kmd-info-item">
          <span className="kmd-info-label">Общий вес</span>
          <span className="kmd-info-value">{fmtWeight(kmd?.marks_weight)}</span>
        </div>
      </div>

      <div className="kmd-info-divider" />

      <div className="kmd-info-group">
        <div className="kmd-info-item">
          <span className="kmd-info-label">Отгружено марок</span>
          <span className="kmd-info-value">{fmt(kmd?.shipped_marks_count)}</span>
        </div>
        <div className="kmd-info-item">
          <span className="kmd-info-label">Вес отгруженных</span>
          <span className="kmd-info-value">{fmtWeight(kmd?.shipped_marks_weight)}</span>
        </div>
      </div>

      <div className="kmd-info-refresh">
        <RefreshButton onClick={onRefresh} />
      </div>
    </div>
  );
};

const KmdSection = ({ kmdList, selectedKmd, marks, marksLoading, onKmdClick, onSortChange, sortBy, orderBy, lastElementRef, onFilterChange, activeFilters = {}, canChanges }) => {
  const [kmdInfo, setKmdInfo] = useState(null);
  const [kmdInfoLoading, setKmdInfoLoading] = useState(false);

  const [filters, setFilters] = useState({ names: [], cooperations: [], mountingParts: [] });
  const [localFilters, setLocalFilters] = useState(activeFilters);
  const [openDropdowns, setOpenDropdowns] = useState({ names: false, cooperations: false, mountingParts: false });

  const [localMarks, setLocalMarks] = useState([]);

  const toggleDropdown = (name) => setOpenDropdowns((prev) => ({ ...prev, [name]: !prev[name] }));
  const closeAllDropdowns = () => setOpenDropdowns({ names: false, cooperations: false, mountingParts: false });

  const handleApplyFilters = () => {
    onFilterChange(localFilters);
    closeAllDropdowns();
  };

  const handleMarkUpdate = (markId, updates) => {
    setLocalMarks((prevMarks) => prevMarks.map((m) => (m.id === markId ? { ...m, ...updates } : m)));
  };

  const refreshKmdInfo = async () => {
    if (!selectedKmd) return;
    setKmdInfoLoading(true);
    try {
      const data = await getKmdInfo(selectedKmd.uuid);
      setKmdInfo(data);
    } catch (e) {
      console.error('Ошибка загрузки информации о КМД', e);
    } finally {
      setKmdInfoLoading(false);
    }
  };

  useEffect(() => {
    if (marks) {
      setLocalMarks(marks);
    }
  }, [marks]);

  useEffect(() => {
    if (!selectedKmd) {
      setKmdInfo(null);
      return;
    }
    refreshKmdInfo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedKmd?.uuid]);

  useEffect(() => {
    if (!selectedKmd) return;

    const loadFilters = async () => {
      try {
        const names = await getMarksFilters(selectedKmd.uuid, 'name');
        const coops = await getMarksFilters(selectedKmd.uuid, 'cooperation');
        const parts = await getMarksFilters(selectedKmd.uuid, 'mounting_part');

        const normalize = (data, key) => {
          if (!data || !Array.isArray(data)) return [];
          return data.map((item) => ({ value: item[key], count: item.count }));
        };

        setFilters({
          names: normalize(names, 'name'),
          cooperations: normalize(coops, 'name'),
          mountingParts: normalize(parts, 'name'),
        });
      } catch (e) {
        console.error('Ошибка загрузки фильтров', e);
      }
    };

    loadFilters();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedKmd?.uuid]);

  useEffect(() => {
    setLocalFilters(activeFilters || {});
  }, [selectedKmd, activeFilters]);

  if (!kmdList || kmdList.length === 0) return null;

  return (
    <>
      <div className="kmd-section">
        <h2>КМД</h2>
        <div className="kmd-buttons">
          {kmdList.map((kmd) => (
            <button
              key={kmd.uuid}
              className={`kmd-button ${selectedKmd?.uuid === kmd.uuid ? 'active' : ''}`}
              onClick={() => onKmdClick(kmd)}
            >
              {kmd.num_kmd}
            </button>
          ))}
        </div>
      </div>

      {selectedKmd && (
        <>
          <KmdInfoCard
            kmd={kmdInfo}
            loading={kmdInfoLoading}
            onRefresh={refreshKmdInfo}
          />

          <div className="marks-controls">
            <div className="controls-left">
              <SortControls
                sortBy={sortBy}
                orderBy={orderBy}
                onSortChange={onSortChange}
              />
            </div>

            <div className="controls-divider" />

            <div className="controls-right">
              <div className="filters-inline">
                <span className="filters-label">Фильтровать по: </span>

                <DropdownFilter
                  title="Название"
                  items={filters.names}
                  selected={localFilters.filter_name || []}
                  onChange={(values) => setLocalFilters({ ...localFilters, filter_name: values })}
                  isOpen={openDropdowns.names}
                  onToggle={() => toggleDropdown('names')}
                />
                <DropdownFilter
                  title="Кооперация"
                  items={filters.cooperations}
                  selected={localFilters.filter_cooperation || []}
                  onChange={(values) => setLocalFilters({ ...localFilters, filter_cooperation: values })}
                  isOpen={openDropdowns.cooperations}
                  onToggle={() => toggleDropdown('cooperations')}
                />
                <DropdownFilter
                  title="Монтажная деталь"
                  items={filters.mountingParts}
                  selected={localFilters.filter_mounting_part || []}
                  onChange={(values) => setLocalFilters({ ...localFilters, filter_mounting_part: values })}
                  isOpen={openDropdowns.mountingParts}
                  onToggle={() => toggleDropdown('mountingParts')}
                />

                <button
                  className="apply-filters-btn"
                  onClick={handleApplyFilters}
                >
                  Применить
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      <MarksList
        marks={localMarks}
        onMarkUpdate={handleMarkUpdate}
        selectedKmd={selectedKmd}
        marksLoading={marksLoading}
        lastElementRef={lastElementRef}
        canChanges={canChanges}
      />
    </>
  );
};

export default KmdSection;
