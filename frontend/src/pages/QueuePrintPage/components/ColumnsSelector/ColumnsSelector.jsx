import { DndContext, closestCenter } from '@dnd-kit/core';
import { SortableContext, horizontalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable';
import { restrictToHorizontalAxis, restrictToParentElement } from '@dnd-kit/modifiers';
import { CSS } from '@dnd-kit/utilities';
import './ColumnsSelector.css';

const SortableItem = ({ column, toggle }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: column.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    ...(isDragging && {
      opacity: 1,
      zIndex: 9999,
      position: 'relative',
      cursor: 'grabbing',
    }),
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`column-chip ${isDragging ? 'dragging' : ''}`}
    >
      <input
        type="checkbox"
        checked={column.visible}
        onChange={() => toggle(column.id)}
      />
      <span
        {...attributes}
        {...listeners}
        className="chip-label"
        data-tooltip={column.label}
      >
        {column.label}
      </span>
    </div>
  );
};

const ColumnsSelector = ({ columns, setColumns }) => {
  const sortableColumns = columns.filter((col) => col.id !== 'itemWeight');
  const weightColumn = columns.find((col) => col.id === 'itemWeight');

  const toggleColumn = (id) => {
    setColumns((prev) => prev.map((col) => (col.id === id ? { ...col, visible: !col.visible } : col)));
  };

  const handleDragEnd = (event) => {
    const { active, over } = event;

    if (!over || active.id === over.id) return;

    const oldIndex = columns.findIndex((c) => c.id === active.id);
    const newIndex = columns.findIndex((c) => c.id === over.id);

    const newSortableColumns = arrayMove(sortableColumns, oldIndex, newIndex);

    const newColumns = [...newSortableColumns];
    if (weightColumn) {
      newColumns.push(weightColumn);
    }

    setColumns(newColumns);
  };

  return (
    <div className="columns-bar">
      <h3>Настройка колонок</h3>

      <div className="test">
        <DndContext
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
          modifiers={[restrictToHorizontalAxis, restrictToParentElement]}
        >
          <SortableContext
            items={sortableColumns.map((c) => c.id)}
            strategy={horizontalListSortingStrategy}
          >
            <div className="columns-row">
              {sortableColumns.map((col) => (
                <SortableItem
                  key={col.id}
                  column={col}
                  toggle={toggleColumn}
                />
              ))}

              {weightColumn && (
                <>
                  <div className="chips-divider" />
                  <div className="weight-column-chip">
                    <input
                      type="checkbox"
                      checked={weightColumn.visible}
                      onChange={() => toggleColumn(weightColumn.id)}
                    />
                    <span title={weightColumn.fullLabel}>{weightColumn.label}</span>
                  </div>
                </>
              )}
            </div>
          </SortableContext>
        </DndContext>
      </div>
    </div>
  );
};

export default ColumnsSelector;
