import { useLocation } from 'react-router-dom';
import './QueuePrintPage.css';
import FiltersSidebar from './components/FiltersSidebar/FiltersSidebar';
import ColumnsSelector from './components/ColumnsSelector/ColumnsSelector';

const QueuePrintPage = () => {
  const location = useLocation();
  const { kmdList } = location.state || {};

  const kmdUuids = kmdList?.map((kmd) => kmd.uuid) || [];

  return (
    <div className="queue-print-page">
      <FiltersSidebar
        kmdUuids={kmdUuids}
        kmdList={kmdList}
      />
      <div className="main-content">
        <ColumnsSelector />
      </div>
    </div>
  );
};

export default QueuePrintPage;
