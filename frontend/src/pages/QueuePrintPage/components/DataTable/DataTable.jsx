import './DataTable.css';

const DataTable = ({ data, columns, weight, posCount }) => {
  const visibleColumns = columns.filter((col) => col.visible);

  if (data.length === 0) return null;

  const shouldMergeCell = (rowIndex, colId, colIndex) => {
    if (rowIndex === 0) return false;

    const currentValue = data[rowIndex][colId];
    const previousValue = data[rowIndex - 1][colId];

    let allPreviousColumnsEqual = true;
    for (let i = 0; i < colIndex; i++) {
      const prevColId = visibleColumns[i].id;
      if (data[rowIndex][prevColId] !== data[rowIndex - 1][prevColId]) {
        allPreviousColumnsEqual = false;
        break;
      }
    }

    return allPreviousColumnsEqual && currentValue === previousValue;
  };

  const getRowSpan = (rowIndex, colId, colIndex) => {
    let span = 1;
    let currentRow = rowIndex;

    const checkPreviousColumns = (currentRow, nextRow) => {
      for (let i = 0; i < colIndex; i++) {
        const prevColId = visibleColumns[i].id;
        if (data[currentRow][prevColId] !== data[nextRow][prevColId]) {
          return false;
        }
      }
      return true;
    };

    while (currentRow + 1 < data.length && data[currentRow + 1][colId] === data[currentRow][colId] && checkPreviousColumns(currentRow, currentRow + 1)) {
      span++;
      currentRow++;
    }

    return span;
  };

  return (
    <div className="data-table-container">
      <table className="data-table">
        <thead>
          <tr>
            {visibleColumns.map((column) => (
              <th
                key={column.id}
                className={`col-${column.id}`}
              >
                {column.label}
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
                    {row[column.id] || '-'}
                  </td>
                );
              })}
            </tr>
          ))}
          {weight !== undefined && weight !== null && (
            <tr style={{ backgroundColor: '#f5f5f5', fontWeight: 'bold', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>
              <td
                colSpan={visibleColumns.length - 2}
                style={{ textAlign: 'right', fontWeight: 'bold' }}
              >
                Общий итог:
              </td>
              <td>{posCount} шт.</td>
              <td>{weight} кг</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

export default DataTable;
