import React, { useState } from 'react';

const SORT_FIELDS = [
  { value: 'title', label: 'Названию марки' },
  { value: 'quantity', label: 'Количеству' },
  { value: 'weight', label: 'Весу' },
  { value: 'sum_weight', label: 'Общему весу' },
];

const SortControls = ({ sortBy, orderBy, onSortChange }) => {
  const [isOpen, setIsOpen] = useState(false);

  const handleSelectSort = (value) => {
    onSortChange({ sortBy: value, orderBy });
    setIsOpen(false);
  };

  const toggleOrder = () => {
    onSortChange({ sortBy, orderBy: orderBy === 'desc' ? 'asc' : 'desc' });
  };

  const currentSortLabel = SORT_FIELDS.find((f) => f.value === sortBy)?.label || SORT_FIELDS[0].label;

  return (
    <div className="controls-block">
      <div className="controls-header">
        <span className="sort-label">Сортировать по:</span>
      </div>

      <div className="controls-row">
        <div className="dropdown-filter">
          <button
            className="dropdown-toggle"
            onClick={() => setIsOpen(!isOpen)}
          >
            {currentSortLabel}
            <span className={`dropdown-arrow ${isOpen ? 'open' : ''}`}></span>
          </button>

          {isOpen && (
            <div className="dropdown-menu">
              {SORT_FIELDS.map((field) => (
                <label
                  key={field.value}
                  className="dropdown-option"
                  onClick={() => handleSelectSort(field.value)}
                >
                  <span>{field.label}</span>
                </label>
              ))}
            </div>
          )}
        </div>

        <button
          className="sort-order-button"
          onClick={toggleOrder}
          title={orderBy === 'asc' ? 'По возрастанию ↑' : 'По убыванию ↓'}
        >
          {orderBy === 'asc' ? '↑' : '↓'}
        </button>
      </div>
    </div>
  );
};

export default SortControls;
