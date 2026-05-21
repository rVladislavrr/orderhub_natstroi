import { useEffect, useState } from 'react';
import './OrderDetailsPage.css';
import { useLocation, useNavigate } from 'react-router-dom';

import LoadingDots from '../../components/LoadingDots/LoadingDots';

import KmdSection from './components/KmdSection/KmdSection';
import useInfiniteMarks from '../../hooks/useInfiniteMarks';
import usePermission from '../../hooks/usePermissions';
import OrderHeader from './components/OrderHeader/OrderHeader';
import FileUploadSection from './components/FileUploadSection/FileUploadSection';
import EditOrderModal from '../OrdersPage/CreateOrderModal/EditOrderModal';
import { getOrderInfo } from '../../api/ordersApi';
import { useAuth } from '../../context/AuthContext';

const OrderDetailsPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedKmd, setSelectedKmd] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);

  const [sortBy, setSortBy] = useState('title');
  const [orderBy, setOrderBy] = useState('asc');

  const [activeFilters, setActiveFilters] = useState({});

  const { marks, loading: marksLoading, lastElementRef, resetMarks } = useInfiniteMarks(selectedKmd?.uuid, sortBy, orderBy, activeFilters);

  const hasPermission = usePermission();
  const { loading: authLoading } = useAuth();
  const canChanges = hasPermission('order', 2);
  const canPrintQueue = hasPermission('queues', 2);

  const fetchOrderInfo = async () => {
    try {
      setLoading(true);
      const uuid = location.state?.uuid;
      const data = await getOrderInfo(uuid);
      setOrder(data);
    } catch (error) {
      console.error('Ошибка загрузки деталей заказа:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrderInfo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state?.uuid]);

  const refreshOrder = async () => {
    try {
      const uuid = location.state?.uuid;
      const data = await getOrderInfo(uuid);
      setOrder(data);
    } catch (error) {
      console.error('Ошибка обновления заказа:', error);
    }
  };

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

  const handleOpenPrintQueue = () => {
    navigate('/print-queue', {
      state: {
        kmdList: order.list_kmd,
        orderNum: order.internal_num_orders,
      },
    });
  };

  const handleFileDeleted = (updatedFiles) => {
    setOrder((prevOrder) => ({
      ...prevOrder,
      files: updatedFiles,
    }));
  };

  const handleOrderUpdated = (updatedOrder) => {
    setShowEditModal(false);
    setOrder((prev) => ({ ...prev, ...updatedOrder }));

    if (updatedOrder.internal_num_orders !== order.internal_num_orders) {
      navigate(`/orders/${updatedOrder.internal_num_orders}`, {
        replace: true,
        state: { uuid: location.state?.uuid },
      });
    }
  };

  if (authLoading) {
    return <LoadingDots />;
  }

  if (loading) return <LoadingDots />;
  if (!order) return <div>Заказ не найден</div>;

  return (
    <div className="order-details-page">
      <OrderHeader
        order={order}
        canChanges={canChanges}
        onEditClick={() => setShowEditModal(true)}
        onRefresh={refreshOrder}
      />

      {canPrintQueue && (
        <div className="print-queue-button-container">
          <button
            className="print-queue-button"
            onClick={handleOpenPrintQueue}
          >
            Составить очередь на печать
          </button>
        </div>
      )}

      {canChanges && (
        <FileUploadSection
          orderUuid={location.state?.uuid}
          files={order.files}
          onFileUploaded={handleFileUploaded}
          onFileDeleted={handleFileDeleted}
        />
      )}

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
        canChanges={canChanges}
      />

      {showEditModal && (
        <EditOrderModal
          order={order}
          onClose={() => setShowEditModal(false)}
          onUpdated={handleOrderUpdated}
        />
      )}
    </div>
  );
};

export default OrderDetailsPage;
