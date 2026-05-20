import { useState, useRef, useEffect, useCallback } from 'react';
import './AutoCompleteInput.css';

export default function AutocompleteInput({ value, onChange, fetchOptions, placeholder, disabled, className = '' }) {
  const [inputVal, setInputVal] = useState(value ?? '');
  const [options, setOptions] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);

  const containerRef = useRef(null);
  const debounceRef = useRef(null);
  const selectedRef = useRef(false); // флаг: значение выбрано из списка

  // Синхронизация при внешнем сбросе value
  useEffect(() => {
    setInputVal(value ?? '');
    if (!value) {
      setOptions([]);
      setOpen(false);
    }
  }, [value]);

  // Клик вне — закрыть
  useEffect(() => {
    const handler = (e) => {
      if (!containerRef.current?.contains(e.target)) {
        setOpen(false);
        // если пользователь напечатал что-то, но не выбрал — откатить к текущему value
        if (!selectedRef.current) setInputVal(value ?? '');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [value]);

  const search = useCallback(
    (q) => {
      clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(async () => {
        if (disabled) return;
        setLoading(true);
        try {
          const res = await fetchOptions(q);
          setOptions(res ?? []);
          setOpen(true);
          setActiveIdx(-1);
        } catch {
          setOptions([]);
        } finally {
          setLoading(false);
        }
      }, 180);
    },
    [fetchOptions, disabled],
  );

  const handleChange = (e) => {
    const v = e.target.value;
    selectedRef.current = false;
    setInputVal(v);
    onChange(''); // сбрасываем «выбранное» значение при ручном вводе
    search(v);
  };

  const handleFocus = () => {
    if (!disabled && !options.length) search(inputVal);
    else setOpen(true);
  };

  const handleSelect = (opt) => {
    selectedRef.current = true;
    setInputVal(opt);
    onChange(opt);
    setOpen(false);
    setOptions([]);
  };

  const handleKeyDown = (e) => {
    if (!open) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, options.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && activeIdx >= 0) {
      e.preventDefault();
      handleSelect(options[activeIdx]);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  return (
    <div
      ref={containerRef}
      className={`ac-wrap ${className}`}
    >
      <div className="ac-input-row">
        <input
          className="cd-input ac-input"
          value={inputVal}
          onChange={handleChange}
          onFocus={handleFocus}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          autoComplete="off"
        />
        {loading && <span className="ac-spinner" />}
        {value && !disabled && (
          <button
            className="ac-clear-btn"
            onMouseDown={(e) => {
              e.preventDefault();
              selectedRef.current = false;
              setInputVal('');
              onChange('');
              setOptions([]);
              setOpen(false);
            }}
            tabIndex={-1}
          >
            <svg
              width="10"
              height="10"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
            >
              <line
                x1="18"
                y1="6"
                x2="6"
                y2="18"
              />
              <line
                x1="6"
                y1="6"
                x2="18"
                y2="18"
              />
            </svg>
          </button>
        )}
      </div>

      {open && options.length > 0 && (
        <ul className="ac-dropdown">
          {options.map((opt, i) => (
            <li
              key={opt}
              className={`ac-option ${i === activeIdx ? 'ac-option--active' : ''}`}
              onMouseDown={(e) => {
                e.preventDefault();
                handleSelect(opt);
              }}
              onMouseEnter={() => setActiveIdx(i)}
            >
              {opt}
            </li>
          ))}
        </ul>
      )}

      {open && !loading && options.length === 0 && inputVal && <div className="ac-dropdown ac-dropdown--empty">Ничего не найдено</div>}
    </div>
  );
}
