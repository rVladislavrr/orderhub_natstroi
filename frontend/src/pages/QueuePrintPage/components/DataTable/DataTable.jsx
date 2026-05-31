import { useEffect, useRef } from 'react';
import './DataTable.css';

const DataTable = ({ data, columns, weight, posCount }) => {
  const visibleColumns = columns.filter((col) => col.visible);

  const topScrollRef = useRef(null);
  const topInnerRef = useRef(null);
  const tableContainerRef = useRef(null);

  useEffect(() => {
    const top = topScrollRef.current;
    const container = tableContainerRef.current;
    if (!top || !container) return;

    const onTopScroll = () => {
      container.scrollLeft = top.scrollLeft;
    };
    const onContainerScroll = () => {
      top.scrollLeft = container.scrollLeft;
    };

    top.addEventListener('scroll', onTopScroll);
    container.addEventListener('scroll', onContainerScroll);
    return () => {
      top.removeEventListener('scroll', onTopScroll);
      container.removeEventListener('scroll', onContainerScroll);
    };
  }, [data]);

  useEffect(() => {
    const container = tableContainerRef.current;
    const inner = topInnerRef.current;
    if (!container || !inner) return;

    const update = () => {
      inner.style.width = container.scrollWidth + 'px';
    };

    update();
    const ro = new ResizeObserver(update);
    ro.observe(container);
    return () => ro.disconnect();
  }, [data, columns]);

  if (data.length === 0) return null;

  const shouldMergeCell = (rowIndex, colId, colIndex) => {
    if (rowIndex === 0) return false;
    const currentValue = data[rowIndex][colId];
    const previousValue = data[rowIndex - 1][colId];
    for (let i = 0; i < colIndex; i++) {
      const prevColId = visibleColumns[i].id;
      if (data[rowIndex][prevColId] !== data[rowIndex - 1][prevColId]) return false;
    }
    return currentValue === previousValue;
  };

  const getRowSpan = (rowIndex, colId, colIndex) => {
    let span = 1;
    let currentRow = rowIndex;
    const checkPrev = (cur, next) => {
      for (let i = 0; i < colIndex; i++) {
        const prevColId = visibleColumns[i].id;
        if (data[cur][prevColId] !== data[next][prevColId]) return false;
      }
      return true;
    };
    while (currentRow + 1 < data.length && data[currentRow + 1][colId] === data[currentRow][colId] && checkPrev(currentRow, currentRow + 1)) {
      span++;
      currentRow++;
    }
    return span;
  };

  return (
    <div className="data-table-wrapper">
      <div
        className="data-table-scroll-top"
        ref={topScrollRef}
      >
        <div
          className="data-table-scroll-top-inner"
          ref={topInnerRef}
        />
      </div>

      <div
        className="data-table-container"
        ref={tableContainerRef}
      >
        <table className="data-table">
          <thead>
            <tr>
              {visibleColumns.map((column) => (
                <th
                  key={column.id}
                  className={`col-${column.id}`}
                >
                  <span className="th-screen">{column.label}</span>
                  <span className="th-print">{column.printLabel || column.label}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row, rowIndex) => (
              <tr key={rowIndex}>
                {visibleColumns.map((column, colIndex) => {
                  const shouldMerge = shouldMergeCell(rowIndex, column.id, colIndex);
                  if (shouldMerge) return null;
                  const rowSpan = getRowSpan(rowIndex, column.id, colIndex);
                  return (
                    <td
                      key={column.id}
                      rowSpan={rowSpan > 1 ? rowSpan : undefined}
                      className={`col-${column.id}`}
                    >
                      {row[column.id] ?? '-'}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
          {weight !== undefined && weight !== null && (
            <tfoot>
              <tr>
                <td
                  colSpan={visibleColumns.length}
                  style={{ textAlign: 'right' }}
                >
                  Общий итог: {posCount} шт. / {weight} кг
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
};

export default DataTable;
