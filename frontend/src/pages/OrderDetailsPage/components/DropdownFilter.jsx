const DropdownFilter = ({ title, items, selected, onChange, isOpen, onToggle }) => {
  const handleCheckboxChange = (value) => {
    if (selected.includes(value)) {
      onChange(selected.filter((item) => item !== value));
    } else {
      onChange([...selected, value]);
    }
  };

  return (
    <div className="dropdown-filter">
      <button
        className="dropdown-toggle"
        onClick={onToggle}
      >
        {title}
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
