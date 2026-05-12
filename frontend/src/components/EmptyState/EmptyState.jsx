import './EmptyState.css';

const ICONS = {
  orders: (
    <svg
      width="36"
      height="36"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#004e8d"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line
        x1="8"
        y1="13"
        x2="16"
        y2="13"
      />
      <line
        x1="8"
        y1="17"
        x2="12"
        y2="17"
      />
    </svg>
  ),
  marks: (
    <svg
      width="36"
      height="36"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#004e8d"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect
        x="2"
        y="3"
        width="20"
        height="14"
        rx="2"
      />
      <line
        x1="8"
        y1="21"
        x2="16"
        y2="21"
      />
      <line
        x1="12"
        y1="17"
        x2="12"
        y2="21"
      />
      <line
        x1="7"
        y1="8"
        x2="7"
        y2="8"
      />
      <line
        x1="12"
        y1="8"
        x2="17"
        y2="8"
      />
      <line
        x1="7"
        y1="12"
        x2="12"
        y2="12"
      />
    </svg>
  ),
  employees: (
    <svg
      width="36"
      height="36"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#004e8d"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
      <circle
        cx="9"
        cy="7"
        r="4"
      />
      <path d="M23 21v-2a4 4 0 00-3-3.87" />
      <path d="M16 3.13a4 4 0 010 7.75" />
    </svg>
  ),
  error: (
    <svg
      width="36"
      height="36"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#c0392b"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle
        cx="12"
        cy="12"
        r="10"
      />
      <line
        x1="12"
        y1="8"
        x2="12"
        y2="12"
      />
      <line
        x1="12"
        y1="16"
        x2="12.01"
        y2="16"
      />
    </svg>
  ),
};

const EmptyState = ({ type = 'orders', title, subtitle }) => {
  const isError = type === 'error';

  return (
    <div className="empty-state">
      <div className={`empty-state__icon ${isError ? 'empty-state__icon--error' : ''}`}>{ICONS[type]}</div>
      <p className="empty-state__title">{title}</p>
      {subtitle && <p className="empty-state__subtitle">{subtitle}</p>}
    </div>
  );
};

export default EmptyState;
