import { useState } from 'react';
import { createPortal } from 'react-dom';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, useSortable, arrayMove, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { restrictToVerticalAxis, restrictToWindowEdges } from '@dnd-kit/modifiers';
import { CSS } from '@dnd-kit/utilities';
import './ColumnsSelector.css';

const SortableRow = ({ column, onToggle }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: column.id, disabled: column.fixed });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 999 : undefined,
    position: isDragging ? 'relative' : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`cs-row${isDragging ? ' cs-row--dragging' : ''}${!column.visible ? ' cs-row--hidden' : ''}${column.fixed ? ' cs-row--fixed' : ''}`}
    >
      <span
        className="cs-drag-handle"
        {...(column.fixed ? {} : { ...attributes, ...listeners })}
        aria-label="Перетащить"
      >
        {column.fixed ? (
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M3 5h10M3 8h10M3 11h10"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        ) : (
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            aria-hidden="true"
          >
            <circle
              cx="5.5"
              cy="4"
              r="1.2"
              fill="currentColor"
            />
            <circle
              cx="5.5"
              cy="8"
              r="1.2"
              fill="currentColor"
            />
            <circle
              cx="5.5"
              cy="12"
              r="1.2"
              fill="currentColor"
            />
            <circle
              cx="10.5"
              cy="4"
              r="1.2"
              fill="currentColor"
            />
            <circle
              cx="10.5"
              cy="8"
              r="1.2"
              fill="currentColor"
            />
            <circle
              cx="10.5"
              cy="12"
              r="1.2"
              fill="currentColor"
            />
          </svg>
        )}
      </span>

      <input
        type="checkbox"
        className="cs-checkbox"
        checked={column.visible}
        disabled={column.fixed}
        onChange={() => onToggle(column.id)}
        id={`col-chk-${column.id}`}
      />

      <label
        className="cs-label"
        htmlFor={`col-chk-${column.id}`}
      >
        {column.label}
      </label>

      {column.fixed && <span className="cs-fixed-badge">всегда</span>}
    </div>
  );
};

const ColumnsSelector = ({ columns, setColumns }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [localColumns, setLocalColumns] = useState(columns);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));

  const openModal = () => {
    setLocalColumns(columns);
    setIsOpen(true);
  };

  const handleApply = () => {
    setColumns(localColumns);
    setIsOpen(false);
  };

  const handleClose = () => {
    setIsOpen(false);
  };

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) handleClose();
  };

  const handleToggle = (id) => {
    setLocalColumns((prev) => prev.map((col) => (col.id === id ? { ...col, visible: !col.visible } : col)));
  };

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    setLocalColumns((prev) => {
      const oldIndex = prev.findIndex((c) => c.id === active.id);
      const newIndex = prev.findIndex((c) => c.id === over.id);
      return arrayMove(prev, oldIndex, newIndex);
    });
  };

  const handleReset = () => {
    setLocalColumns(columns);
  };

  const visibleCount = columns.filter((c) => c.visible).length;
  const localVisibleCount = localColumns.filter((c) => c.visible).length;

  const sortableIds = localColumns.filter((c) => !c.fixed).map((c) => c.id);

  return (
    <>
      <button
        className="cs-trigger"
        onClick={openModal}
        type="button"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          aria-hidden="true"
        >
          <rect
            x="1"
            y="3"
            width="14"
            height="2"
            rx="1"
            fill="currentColor"
          />
          <rect
            x="1"
            y="7"
            width="14"
            height="2"
            rx="1"
            fill="currentColor"
          />
          <rect
            x="1"
            y="11"
            width="14"
            height="2"
            rx="1"
            fill="currentColor"
          />
          <rect
            x="10"
            y="2"
            width="4"
            height="4"
            rx="1"
            fill="var(--cs-accent)"
          />
          <rect
            x="4"
            y="6"
            width="4"
            height="4"
            rx="1"
            fill="var(--cs-accent)"
          />
          <rect
            x="8"
            y="10"
            width="4"
            height="4"
            rx="1"
            fill="var(--cs-accent)"
          />
        </svg>
        Настройка колонок
        <span className="cs-badge">
          {visibleCount} / {columns.length}
        </span>
      </button>

      {isOpen &&
        createPortal(
          <div
            className="cs-overlay"
            onClick={handleOverlayClick}
            role="dialog"
            aria-modal="true"
            aria-label="Настройка колонок"
          >
            <div className="cs-modal">
              <div className="cs-modal-header">
                <span className="cs-modal-title">Настройка колонок</span>
                <button
                  className="cs-close-btn"
                  onClick={handleClose}
                  type="button"
                  aria-label="Закрыть"
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 16 16"
                    fill="none"
                    aria-hidden="true"
                  >
                    <path
                      d="M3 3l10 10M13 3L3 13"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                    />
                  </svg>
                </button>
              </div>

              <div className="cs-modal-hint">
                <svg
                  width="13"
                  height="13"
                  viewBox="0 0 16 16"
                  fill="none"
                  aria-hidden="true"
                >
                  <circle
                    cx="5.5"
                    cy="4"
                    r="1.2"
                    fill="currentColor"
                  />
                  <circle
                    cx="5.5"
                    cy="8"
                    r="1.2"
                    fill="currentColor"
                  />
                  <circle
                    cx="5.5"
                    cy="12"
                    r="1.2"
                    fill="currentColor"
                  />
                  <circle
                    cx="10.5"
                    cy="4"
                    r="1.2"
                    fill="currentColor"
                  />
                  <circle
                    cx="10.5"
                    cy="8"
                    r="1.2"
                    fill="currentColor"
                  />
                  <circle
                    cx="10.5"
                    cy="12"
                    r="1.2"
                    fill="currentColor"
                  />
                </svg>
                Перетащите строки для изменения порядка
              </div>

              <div className="cs-modal-body">
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                  modifiers={[restrictToVerticalAxis, restrictToWindowEdges]}
                >
                  <SortableContext
                    items={sortableIds}
                    strategy={verticalListSortingStrategy}
                  >
                    {localColumns.map((col) => (
                      <SortableRow
                        key={col.id}
                        column={col}
                        onToggle={handleToggle}
                      />
                    ))}
                  </SortableContext>
                </DndContext>
              </div>

              <div className="cs-modal-footer">
                <span className="cs-footer-count">
                  Видимых: <strong>{localVisibleCount}</strong> из {localColumns.length}
                </span>
                <div className="cs-footer-actions">
                  <button
                    className="cs-btn"
                    onClick={handleReset}
                    type="button"
                  >
                    Сбросить
                  </button>
                  <button
                    className="cs-btn cs-btn--primary"
                    onClick={handleApply}
                    type="button"
                  >
                    Применить
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
};

export default ColumnsSelector;
