import { FilterProvider, useFilters } from '../../context/FilterContext';
import MultiSelect from '../MultiSelect/MultiSelect';
import './FiltersSidebar.css';

const FiltersSidebarContent = ({ kmdUuids, kmdList, onApply, onReset }) => {
  const kmdNumbers = kmdList?.map((kmd) => ({ value: kmd.num_kmd })) || [];
  const { selectedFilters } = useFilters();

  const filters = [
    {
      label: 'Номер КМД',
      field: 'kmd_num',
      placeholder: 'Выберите номер КМД',
      useLocalOptions: true,
      singleSelect: true,
    },
    { label: 'Номер очереди', field: 'que_num', placeholder: 'Выберите номер очереди' },
    { label: 'Марка стали', field: 'steel_grade', placeholder: 'Выберите марку стали' },
    { label: 'Прокат', field: 'type', placeholder: 'Выберите прокат' },
    { label: 'Типоразмер проката', field: 'size', placeholder: 'Выберите размер' },
    { label: 'Название марки', field: 'mark_name', placeholder: 'Выберите название марки' },
    { label: 'Номер детали', field: 'num_detail', placeholder: 'Выберите номер детали' },
    { label: 'Длина (мм)', field: 'length', placeholder: 'Выберите длину' },
  ];

  return (
    <div className="filters-sidebar">
      <h3>Фильтры</h3>

      {filters.map((filter, index) => (
        <MultiSelect
          key={index}
          label={filter.label}
          placeholder={filter.placeholder}
          filterField={filter.field}
          kmdList={kmdList}
          localOptions={filter.useLocalOptions ? kmdNumbers : null}
          singleSelect={filter.singleSelect}
        />
      ))}

      <div className="filter-buttons">
        <button
          className="apply-btn"
          onClick={() => onApply(selectedFilters)}
        >
          Применить
        </button>
        <button
          className="reset-btn"
          onClick={onReset}
        >
          Сбросить
        </button>
      </div>
    </div>
  );
};

const FiltersSidebar = (props) => {
  return (
    <FilterProvider>
      <FiltersSidebarContent {...props} />
    </FilterProvider>
  );
};

export default FiltersSidebar;
