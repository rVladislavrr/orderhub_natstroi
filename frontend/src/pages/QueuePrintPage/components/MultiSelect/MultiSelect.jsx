import { useEffect, useRef, useState } from 'react';
import './MultiSelect.css';
import { getDynamicFilterOptions } from '../../../../api/graphqlApi';
import { useFilters } from '../../context/FilterContext';

const MultiSelect = ({ label, placeholder, filterField, kmdUuids, filters, localOptions, kmdList, singleSelect }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedValues, setSelectedValues] = useState([]);
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef(null);
  const [hasLoaded, setHasLoaded] = useState(false);

  const { selectedFilters, updateFilter } = useFilters();

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    if (localOptions) {
      setOptions(localOptions);
      setHasLoaded(true);
    } else {
      fetchOptions();
    }
    // eslint-disable-next-line
  }, [isOpen, selectedFilters]);

  useEffect(() => {
    const validValues = selectedValues.filter((val) => options.some((opt) => opt.value === val));

    if (validValues.length !== selectedValues.length) {
      setSelectedValues(validValues);
      updateFilter(filterField, validValues);
    }
    // eslint-disable-next-line
  }, [options]);

  const fetchOptions = async () => {
    setLoading(true);
    try {
      const filtersWithoutCurrent = { ...selectedFilters };
      delete filtersWithoutCurrent[filterField];

      const result = await getDynamicFilterOptions(filterField, kmdUuids, filtersWithoutCurrent, kmdList);
      setOptions(result);
    } catch (error) {
      console.error('Ошибка загрузки опций', error);
    } finally {
      setLoading(false);
      setHasLoaded(true);
    }
  };

  const handleCheckboxChange = (value) => {
    const newSelectedValues = singleSelect ? (selectedValues.includes(value) ? [] : [value]) : selectedValues.includes(value) ? selectedValues.filter((v) => v !== value) : [...selectedValues, value];

    setSelectedValues(newSelectedValues);
    updateFilter(filterField, newSelectedValues);
  };

  const getDisplayText = () => {
    if (selectedValues.length === 0) return placeholder || 'Выберите...';
    if (selectedValues.length === 1) return selectedValues[0];
    return `Выбрано: ${selectedValues.length}`;
  };

  return (
    <div
      className="multi-select"
      ref={dropdownRef}
    >
      <label>{label}</label>
      <div
        className="multi-select-trigger"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span>{getDisplayText()}</span>
        <span className={`dropdown-arrow ${isOpen ? 'open' : ''}`}></span>
      </div>

      {isOpen && (
        <div className="multi-select-dropdown">
          {!hasLoaded ? null : options.length === 0 ? (
            <div className="no-options">Нет данных</div>
          ) : (
            options.map((option, index) => (
              <label
                key={index}
                className="multi-select-option"
              >
                <input
                  type="checkbox"
                  checked={selectedValues.includes(option.value)}
                  onChange={() => handleCheckboxChange(option.value)}
                />
                <span>
                  {option.value} {option.totalQuantity ? `(${option.totalQuantity})` : ''}
                </span>
              </label>
            ))
          )}

          {loading && <div className="loading-overlay" />}
        </div>
      )}
    </div>
  );
};

export default MultiSelect;
