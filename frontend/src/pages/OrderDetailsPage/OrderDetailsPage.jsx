import { useEffect, useState } from 'react';
import './OrderDetailsPage.css';
import { useLocation } from 'react-router-dom';
import { getOrderInfo, getOrderMarks } from '../../api/ordersApi';
import LoadingDots from '../../components/LoadingDots/LoadingDots';

import { toast } from 'react-toastify';
import OrderHeader from './components/OrderHeader';
import FileUploadSection from './components/FileUploadSection';
import KmdSection from './components/KmdSection';

const OrderDetailsPage = () => {
  const location = useLocation();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);

  const [selectedKmd, setSelectedKmd] = useState(null);
  const [marks, setMarks] = useState([]);
  const [marksLoading, setMarksLoading] = useState(false);

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

  const handleKmdClick = async (kmd) => {
    if (selectedKmd?.uuid === kmd.uuid) {
      setSelectedKmd(null);
      setMarks([]);
      return;
    }

    try {
      setSelectedKmd(kmd);
      setMarksLoading(true);

      const marksData = await getOrderMarks(kmd.uuid, 1, 20);

      setMarks(marksData.marks || []);
    } catch (error) {
      console.error('Ошибка загрузки марок:', error);
      toast.error('Ошибка при загрузке марок');
    } finally {
      setMarksLoading(false);
    }
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
      />
    </div>
  );
};

export default OrderDetailsPage;
