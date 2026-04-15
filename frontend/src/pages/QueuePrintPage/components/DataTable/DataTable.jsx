import './DataTable.css';

const DataTable = ({ data, columns, weight, posCount }) => {
  const visibleColumns = columns.filter((col) => col.visible);

  if (data.length === 0) return null;

  const getColumnWidth = (columnId) => {
    const widths = {
      type: '8%',
      steel_grade: '6%',
      mark_name: '8%',
      size: '8%',
      num_detail: '8%',
      mark_title: '8%',
      length: '8%',
      operation: '8%',
      mounting_part: '8%',
      quantity: '4%',
      itemWeight: '8%',
    };
    return widths[columnId] || 'auto';
  };

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
                style={{ width: getColumnWidth(column.id) }}
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
                    style={{ width: getColumnWidth(column.id) }}
                  >
                    {row[column.id] || '-'}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
        {weight && (
          <tfoot style={{ backgroundColor: '#f5f5f5' }}>
            <tr>
              <td
                colSpan={visibleColumns.length - 2}
                style={{ textAlign: 'right', fontWeight: 'bold' }}
              >
                Общий итог:
              </td>
              <td style={{ fontWeight: 'bold' }}>{posCount} шт.</td>
              <td style={{ fontWeight: 'bold' }}>{weight} кг</td>
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
};

export default DataTable;
