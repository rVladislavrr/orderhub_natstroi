import { useLocation } from 'react-router-dom';
import './QueuePrintPage.css';
import FiltersSidebar from './components/FiltersSidebar/FiltersSidebar';
import ColumnsSelector from './components/ColumnsSelector/ColumnsSelector';
import { useRef, useState, useEffect } from 'react';
import { getDynamicHierarchy } from '../../api/graphqlApi';
import DataTable from './components/DataTable/DataTable';
import { toast } from 'react-toastify';
import LoadingDots from '../../components/LoadingDots/LoadingDots';

const initialColumns = [
  { id: 'type', label: 'Прокат', visible: true },
  { id: 'steel_grade', label: 'Марка стали', visible: true },
  { id: 'mark_name', label: 'Наименование марки', visible: true },
  { id: 'size', label: 'Типоразмер проката', visible: true },
  { id: 'num_detail', label: '№ позиции', visible: true },
  { id: 'mark_title', label: 'Марка', visible: true },
  { id: 'length', label: 'Длина, мм', visible: true },
  { id: 'operation', label: 'Операция', visible: true },
  { id: 'mounting_part', label: 'Признак МД', visible: true },
  { id: 'quantity', label: 'Кол-во позиций', visible: true },
  { id: 'itemWeight', label: 'Вес, кг', visible: true },
];

const flattenHierarchy = (data) => {
  const rows = [];
  const traverse = (node, rowData = {}) => {
    const newRowData = { ...rowData };

    if (node.level && node.value) {
      const key = node.level === 'mark_quantity' ? 'quantity' : node.level;
      newRowData[key] = node.value;
    }

    if (node.children && node.children.length > 0) {
      node.children.forEach((child) => {
        traverse(child, newRowData);
      });
    } else {
      const weight = node.totalMarkWeight ?? node.totalWeight;
      if (weight !== undefined) {
        newRowData.itemWeight = weight;
      }
      rows.push(newRowData);
    }
  };

  data.forEach((node) => {
    traverse(node);
  });
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

        return {
          field: fieldId,
          order: index + 1,
        };
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
      setTotalWeight(result.statistics.totalWeight);
      setPosCount(result.statistics.totalQuantity);
    } catch (error) {
      console.error(error);
      toast.error('Ошибка при загрузке данных');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    if (lastFilters) {
      if (loadTimeoutRef.current) {
        clearTimeout(loadTimeoutRef.current);
      }

      loadTimeoutRef.current = setTimeout(() => {
        loadData(lastFilters);
      }, 300);
    }

    return () => {
      if (loadTimeoutRef.current) {
        clearTimeout(loadTimeoutRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [columns]);

  const handleApply = async (filters) => {
    setLastFilters(filters);
    await loadData(filters);
  };

  const handleReset = () => {
    setColumns(initialColumns);
    setTableData([]);
    setLastFilters(null);
    isInitialMount.current = true;
    if (loadTimeoutRef.current) {
      clearTimeout(loadTimeoutRef.current);
    }

    setResetKey((prev) => prev + 1);
  };

  const handlePrint = () => {
    const originalTitle = document.title;
    document.title = `Заказ № ${orderNum}`;

    window.print();

    document.title = originalTitle;
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
          <ColumnsSelector
            columns={columns}
            setColumns={setColumns}
          />

          {loading && <LoadingDots />}

          {!loading && tableData.length === 0 && <div className="no-data">Нет данных</div>}

          {!loading && tableData.length > 0 && (
            <>
              <button
                className="print-button"
                onClick={handlePrint}
              >
                Распечатать
              </button>

              <DataTable
                data={tableData}
                columns={columns}
                weight={totalWeight}
                posCount={posCount}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default QueuePrintPage;
