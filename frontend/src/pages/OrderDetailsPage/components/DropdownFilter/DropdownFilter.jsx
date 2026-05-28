import { useEffect, useRef } from 'react';

const DropdownFilter = ({ title, items, selected, onChange, isOpen, onToggle, disabled }) => {
  const ref = useRef(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onToggle();
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onToggle]);

  const handleCheckboxChange = (value) => {
    onChange(selected.includes(value) ? selected.filter((i) => i !== value) : [...selected, value]);
  };

  return (
    <div
      className="dropdown-filter"
      ref={ref}
    >
      <button
        type="button"
        className={`dropdown-toggle ${selected.length > 0 ? 'dropdown-toggle--active' : ''}`}
        onClick={onToggle}
        disabled={disabled}
      >
        {title}
        {selected.length > 0 && <span className="dropdown-count">{selected.length}</span>}
        <span className={`dropdown-arrow ${isOpen ? 'open' : ''}`}></span>
      </button>
      {isOpen && (
        <div className="dropdown-menu">
          {items.map((item) => (
            <label
              key={item.value}
              className="dropdown-option"
            >
              <input
                type="checkbox"
                checked={selected.includes(item.value)}
                onChange={() => handleCheckboxChange(item.value)}
              />
              <span>
                {item.value} ({item.count})
              </span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
};

export default DropdownFilter;
