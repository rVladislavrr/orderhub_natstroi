import { useEffect, useState } from 'react';
import './OrderDetailsPage.css';
import { useLocation } from 'react-router-dom';
import { getOrderInfo } from '../../api/ordersApi';
import LoadingDots from '../../components/LoadingDots/LoadingDots';
import OrderHeader from './components/OrderHeader';
import FileUploadSection from './components/FileUploadSection';
import KmdSection from './components/KmdSection';
import useInfiniteMarks from '../../hooks/useInfiniteMarks';

const OrderDetailsPage = () => {
  const location = useLocation();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedKmd, setSelectedKmd] = useState(null);

  const [sortBy, setSortBy] = useState('title');
  const [orderBy, setOrderBy] = useState('asc');

  const [activeFilters, setActiveFilters] = useState({});

  const { marks, loading: marksLoading, lastElementRef, resetMarks } = useInfiniteMarks(selectedKmd?.uuid, sortBy, orderBy, activeFilters);

  useEffect(() => {
    const fetchOrderInfo = async () => {
      try {
        setLoading(true);
        const uuid = location.state?.uuid;

        const data = await getOrderInfo(uuid);
        console.log('Данные:', data);
        setOrder(data);
      } catch (error) {
        console.error('Ошибка загрузки деталей заказа:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchOrderInfo();
  }, [location.state?.uuid]);

  const handleFileUploaded = (uploadedFile) => {
    setOrder((prevOrder) => ({
      ...prevOrder,
      files: prevOrder.files ? [...prevOrder.files, uploadedFile] : [uploadedFile],
    }));
  };

  const handleKmdClick = (kmd) => {
    if (selectedKmd?.uuid === kmd.uuid) {
      setSelectedKmd(null);
      setActiveFilters({});
      resetMarks();
    } else {
      setSelectedKmd(kmd);
      setActiveFilters({});
    }
  };

  const handleSortChange = async ({ sortBy: newSortBy, orderBy: newOrderBy }) => {
    setSortBy(newSortBy);
    setOrderBy(newOrderBy);
  };

  const handleFilterChange = (newFilters) => {
    setActiveFilters(newFilters || {});
  };

  if (loading) return <LoadingDots />;
  if (!order) return <div>Заказ не найден</div>;

  return (
    <div className="order-details-page">
      <OrderHeader order={order} />

      <FileUploadSection
        orderUuid={location.state?.uuid}
        files={order.files}
        onFileUploaded={handleFileUploaded}
      />

      <KmdSection
        kmdList={order.list_kmd}
        selectedKmd={selectedKmd}
        marks={marks}
        marksLoading={marksLoading}
        onKmdClick={handleKmdClick}
        onSortChange={handleSortChange}
        sortBy={sortBy}
        orderBy={orderBy}
        lastElementRef={lastElementRef}
        onFilterChange={handleFilterChange}
        activeFilters={activeFilters}
      />
    </div>
  );
};

export default OrderDetailsPage;
