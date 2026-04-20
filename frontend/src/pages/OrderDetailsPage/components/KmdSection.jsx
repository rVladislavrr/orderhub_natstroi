import { useEffect, useState } from 'react';
import LoadingDots from '../../../components/LoadingDots/LoadingDots';
import MarksList from './MarksList';
import SortControls from './SortControls';
import { getMarksFilters } from '../../../api/ordersApi';
import DropdownFilter from './DropdownFilter';

const KmdSection = ({ kmdList, selectedKmd, marks, marksLoading, onKmdClick, onSortChange, sortBy, orderBy, lastElementRef, onFilterChange, activeFilters = {} }) => {
  const [filters, setFilters] = useState({
    names: [],
    cooperations: [],
    mountingParts: [],
  });
  const [localFilters, setLocalFilters] = useState(activeFilters);

  const [openDropdowns, setOpenDropdowns] = useState({
    names: false,
    cooperations: false,
    mountingParts: false,
  });

  const toggleDropdown = (dropdownName) => {
    setOpenDropdowns((prev) => ({
      ...prev,
      [dropdownName]: !prev[dropdownName],
    }));
  };

  const closeAllDropdowns = () => {
    setOpenDropdowns({
      names: false,
      cooperations: false,
      mountingParts: false,
    });
  };

  const handleApplyFilters = () => {
    onFilterChange(localFilters);
    closeAllDropdowns();
  };

  useEffect(() => {
    if (!selectedKmd) return;

    const loadFilters = async () => {
      try {
        const names = await getMarksFilters(selectedKmd.uuid, 'name');
        const coops = await getMarksFilters(selectedKmd.uuid, 'cooperation');
        console.log(coops);
        const parts = await getMarksFilters(selectedKmd.uuid, 'mounting_part');
        console.log(parts);

        const normalize = (data, key) => {
          if (!data || !Array.isArray(data)) return [];

          return data.map((item) => ({
            value: item[key],
            count: item.count,
          }));
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
  }, [selectedKmd]);

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
      )}

      {marksLoading && <LoadingDots />}
      <MarksList
        marks={marks}
        selectedKmd={selectedKmd}
        marksLoading={marksLoading}
        lastElementRef={lastElementRef}
      />
    </>
  );
};

export default KmdSection;
