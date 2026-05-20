
const ConfirmDeleteModal = ({ isOpen, onClose, onConfirm, fileName, isLoading }) => {
  if (!isOpen) return null;

  return (
    <div
      className="modal-overlay"
      onClick={isLoading ? undefined : onClose}
    >
      <div
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h3>Удаление файла</h3>
          <button
            className="modal-close"
            onClick={onClose}
            disabled={isLoading}
          >
            ×
          </button>
        </div>

        <div className="modal-body">
          <div className="delete-confirm-content">
            <div className="delete-icon-wrapper">
              <svg
                width="48"
                height="48"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                <line
                  x1="10"
                  y1="11"
                  x2="10"
                  y2="17"
                />
                <line
                  x1="14"
                  y1="11"
                  x2="14"
                  y2="17"
                />
              </svg>
            </div>
            <p className="delete-confirm-text">Вы уверены, что хотите удалить файл?</p>
            <p className="delete-file-name">{fileName}</p>
          </div>

          <div className="modal-actions">
            <button
              type="button"
              className="btn-cancel"
              onClick={onClose}
              disabled={isLoading}
            >
              Отмена
            </button>
            <button
              type="button"
              className="btn-delete"
              onClick={onConfirm}
              disabled={isLoading}
            >
              {isLoading ? 'Удаление...' : 'Удалить'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConfirmDeleteModal;
