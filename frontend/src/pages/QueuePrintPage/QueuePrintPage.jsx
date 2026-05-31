import { useLocation } from 'react-router-dom';
import './QueuePrintPage.css';
import FiltersSidebar from './components/FiltersSidebar/FiltersSidebar';
import ColumnsSelector from './components/ColumnsSelector/ColumnsSelector';
import { useRef, useState } from 'react';
import { getDynamicHierarchy } from '../../api/graphqlApi';
import DataTable from './components/DataTable/DataTable';
import { toast } from 'react-toastify';
import LoadingDots from '../../components/LoadingDots/LoadingDots';

export const initialColumns = [
  { id: 'type', label: 'Прокат', printLabel: 'Прокат', visible: true },
  { id: 'steel_grade', label: 'Марка стали', printLabel: 'М.стали', visible: true },
  { id: 'mark_name', label: 'Наименование марки', printLabel: 'Наим.марки', visible: true },
  { id: 'size', label: 'Типоразмер проката', printLabel: 'Типоразм.', visible: true },
  { id: 'width', label: 'Ширина, мм', printLabel: 'Шир.,мм', visible: false },
  { id: 'length', label: 'Длина, мм', printLabel: 'Дл.,мм', visible: true },
  { id: 'num_detail', label: '№ позиции', printLabel: '№ поз.', visible: true },
  { id: 'mark_title', label: 'Марка', printLabel: 'Марка', visible: true },
  { id: 'operation', label: 'Операция', printLabel: 'Опер.', visible: true },
  { id: 'que_num', label: '№ очереди', printLabel: '№ оч.', visible: false },
  { id: 'mounting_part', label: 'Признак МД', printLabel: 'МД', visible: true },
  { id: 'cooperation', label: 'Кооперация', printLabel: 'Кооп.', visible: false },
  { id: 'quantity', label: 'Кол-во позиций', printLabel: 'Кол-во', visible: true },
  { id: 'mark_quantity', label: 'Кол-во марок', printLabel: 'Кол.марок', visible: false },
  { id: 'weight', label: 'Вес детали, кг', printLabel: 'Вес дет.', visible: false },
  { id: 'mark_weight', label: 'Вес марки, кг', printLabel: 'Вес марки', visible: false },
  { id: 'total_weight_details', label: 'Суммарный вес позиций', printLabel: 'Σ вес поз.', visible: false },
  { id: 'total_weight_marks', label: 'Суммарный вес марок', printLabel: 'Σ вес мар.', visible: false },
];

const flattenHierarchy = (data) => {
  const rows = [];

  const traverse = (node, rowData = {}) => {
    const newRowData = { ...rowData };

    if (node.level != null && node.value != null) {
      newRowData[node.level] = node.value;
    }

    if (node.children && node.children.length > 0) {
      node.children.forEach((child) => traverse(child, newRowData));
    } else {
      rows.push(newRowData);
    }
  };

  data.forEach((node) => traverse(node));
  return rows;
};

const QueuePrintPage = () => {
  const location = useLocation();
  const { kmdList, orderNum } = location.state || {};

  const [columns, setColumns] = useState(initialColumns);
  const [tableData, setTableData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [lastFilters, setLastFilters] = useState(null);
  const isInitialMount = useRef(true);
  const loadTimeoutRef = useRef(null);
  const [resetKey, setResetKey] = useState(0);
  const [totalWeight, setTotalWeight] = useState(0);
  const [posCount, setPosCount] = useState(0);

  const kmdUuids = kmdList?.map((kmd) => kmd.uuid) || [];

  const loadData = async (filters) => {
    if (!filters) return;

    if (!filters.kmd_num || filters.kmd_num.length === 0) {
      toast.error('Выберите номер КМД');
      return;
    }

    const selectedKmdUuids = kmdList?.filter((kmd) => filters.kmd_num.includes(kmd.num_kmd)).map((kmd) => kmd.uuid) || [];

    if (selectedKmdUuids.length === 0) {
      toast.error('Не найдены UUID для выбранных КМД');
      return;
    }

    const cleanFilters = { ...filters };
    delete cleanFilters.kmd_num;

    const isNumDetailVisible = columns.some((c) => c.id === 'num_detail' && c.visible);

    const groupBy = columns
      .filter((c) => c.visible)
      .map((col, index) => {
        let fieldId = col.id;
        if (col.id === 'quantity' && !isNumDetailVisible) {
          fieldId = 'mark_quantity';
        }
        return { field: fieldId, order: index + 1 };
      });

    setLoading(true);

    try {
      const result = await getDynamicHierarchy({
        groupBy,
        kmdUuids: selectedKmdUuids,
        filters: cleanFilters,
        isNumDetailVisible,
      });
      const flattenData = flattenHierarchy(result.nodes);
      setTableData(flattenData);
      setTotalWeight(isNumDetailVisible ? (result.statistics.totalWeightDetails ?? result.statistics.totalWeightMarks) : (result.statistics.totalWeightMarks ?? result.statistics.totalWeightDetails));
      setPosCount(isNumDetailVisible ? result.statistics.detailQuantity : result.statistics.markQuantity);
    } catch (error) {
      console.error(error);
      toast.error('Ошибка при загрузке данных');
    } finally {
      setLoading(false);
    }
  };

  const handleColumnsChange = (newColumns) => {
    setColumns(newColumns);

    if (lastFilters && !isInitialMount.current) {
      if (loadTimeoutRef.current) clearTimeout(loadTimeoutRef.current);
      loadTimeoutRef.current = setTimeout(() => loadData(lastFilters), 300);
    }
  };

  const handleApply = async (filters) => {
    isInitialMount.current = false;
    setLastFilters(filters);
    await loadData(filters);
  };

  const handleReset = () => {
    setColumns(initialColumns);
    setTableData([]);
    setLastFilters(null);
    isInitialMount.current = true;
    if (loadTimeoutRef.current) clearTimeout(loadTimeoutRef.current);
    setResetKey((prev) => prev + 1);
  };

  const handlePrint = () => {
    const printWindow = window.open('', '_blank', 'width=1200,height=800,toolbar=yes,scrollbars=yes,menubar=yes');

    if (!printWindow) {
      toast.error('Пожалуйста, разрешите всплывающие окна для печати');
      return;
    }

    const visibleCols = columns.filter((c) => c.visible);

    const generateRows = () => {
      const rows = [];
      for (let rowIndex = 0; rowIndex < tableData.length; rowIndex++) {
        const row = tableData[rowIndex];

        const shouldMerge = (colIndex, colId) => {
          if (rowIndex === 0) return false;
          const prevRow = tableData[rowIndex - 1];
          for (let i = 0; i < colIndex; i++) {
            if (row[visibleCols[i].id] !== prevRow[visibleCols[i].id]) return false;
          }
          return row[colId] === prevRow[colId];
        };

        const getRowSpan = (colIndex, colId) => {
          let span = 1;
          let nextIdx = rowIndex + 1;
          while (nextIdx < tableData.length) {
            const nextRow = tableData[nextIdx];
            let same = true;
            for (let i = 0; i < colIndex; i++) {
              if (nextRow[visibleCols[i].id] !== row[visibleCols[i].id]) {
                same = false;
                break;
              }
            }
            if (same && nextRow[colId] === row[colId]) {
              span++;
              nextIdx++;
            } else break;
          }
          return span;
        };

        rows.push('<tr>');
        for (let colIndex = 0; colIndex < visibleCols.length; colIndex++) {
          const col = visibleCols[colIndex];
          if (shouldMerge(colIndex, col.id)) continue;
          const rowSpan = getRowSpan(colIndex, col.id);
          const value = row[col.id] ?? '-';
          rows.push(`<td${rowSpan > 1 ? ` rowspan="${rowSpan}"` : ''}>${value}</td>`);
        }
        rows.push('</tr>');
      }
      return rows.join('');
    };

    const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Заказ № ${orderNum}</title>
        <meta charset="utf-8">
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          
          body {
            font-family: 'Inter', 'Segoe UI', Arial, sans-serif;
            margin: 0;
            padding: 20px 0;
            background: white;
          }
          
          .print-container {
            padding: 0;
          }
          
          table {
            width: 100%;
            border-collapse: collapse;
            font-size: 9px;
            table-layout: fixed;
          }
          
          th, td {
            border: 0.5px solid #999;
            padding: 5px 4px;
            text-align: left;
            vertical-align: top;
            word-break: break-word;
          }
          
          th {
            background: #e8e8e8;
            font-size: 8px;
            font-weight: 700;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          
          tfoot td {
            background: #e8e8e8;
            font-weight: 700;
            text-align: right;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          
          @page {
            size: A4 landscape;
            margin: 8mm 10mm;
            
            @top-center {
              content: "Заказ № ${orderNum}";
              font-family: 'Inter', 'Segoe UI', Arial, sans-serif;
              font-size: 10px;
              font-weight: 600;
            }
            
            @bottom-center {
              content: "Страница " counter(page);
              font-family: 'Inter', 'Segoe UI', Arial, sans-serif;
              font-size: 8px;
            }
          }
          
          @media print {
            body {
              margin: 0;
              padding: 0;
            }
            
            thead {
              display: table-header-group;
            }
            
            tbody {
              display: table-row-group;
            }
            
            tfoot {
              display: table-footer-group;
            }
            
            tr {
              break-inside: avoid;
              page-break-inside: avoid;
            }
          }
        </style>
      </head>
      <body>
        <div class="print-container">
          <table>
            <thead>
              <tr>
                ${visibleCols.map((c) => `<th>${c.label}</th>`).join('')}
              </tr>
            </thead>
            <tbody>
              ${generateRows()}
            </tbody>
            ${
              totalWeight !== undefined && totalWeight !== null
                ? `
              <tfoot>
                <tr>
                  <td colspan="${visibleCols.length}" style="text-align: right">
                    Общий итог: ${posCount} шт. / ${totalWeight} кг
                  </td>
                </tr>
              </tfoot>
            `
                : ''
            }
          </table>
        </div>
        
        <script>
          window.onload = () => {
            setTimeout(() => {
              window.print();
            }, 100);
          };
          
          window.onafterprint = () => {
            window.close();
          };
        </script>
      </body>
    </html>
  `;

    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
  };
  return (
    <div className="queue-print-page">
      <div className="print-page-info">
        <p className="title-info">Заказ № {orderNum}</p>
      </div>

      <div className="main-content-wrapper">
        <FiltersSidebar
          key={resetKey}
          kmdUuids={kmdUuids}
          kmdList={kmdList}
          onApply={handleApply}
          onReset={handleReset}
        />

        <div className="main-content">
          <div className="main-content-toolbar">
            <ColumnsSelector
              columns={columns}
              setColumns={handleColumnsChange}
            />
            {!loading && tableData.length > 0 && (
              <button
                className="print-button"
                onClick={handlePrint}
                type="button"
              >
                <svg
                  width="15"
                  height="15"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <polyline points="6 9 6 2 18 2 18 9" />
                  <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                  <rect
                    x="6"
                    y="14"
                    width="12"
                    height="8"
                  />
                </svg>
                Распечатать
              </button>
            )}
          </div>

          {loading && <LoadingDots />}

          {!loading && tableData.length === 0 && <div className="no-data">Нет данных</div>}

          {!loading && tableData.length > 0 && (
            <DataTable
              data={tableData}
              columns={columns}
              weight={totalWeight}
              posCount={posCount}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default QueuePrintPage;
