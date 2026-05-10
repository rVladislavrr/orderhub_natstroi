import './OrdersPage.css';
import useInfiniteOrders from '../../hooks/useInfiniteOrders';
import LoadingDots from '../../components/LoadingDots/LoadingDots';
import OrderCard from '../../components/OrderCard/OrderCard';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import CreateOrderModal from './CreateOrderModal/CreateOrderModal';
import usePermission from '../../hooks/usePermissions';

const OrdersPage = () => {
  const { orders, loading, lastElementRef, hasMore, error, prependOrder } = useInfiniteOrders();
  const navigate = useNavigate();
  const [showModal, setShowModal] = useState(false);
  const [newOrderUuid, setNewOrderUuid] = useState(null);
  const hasPermission = usePermission();
  const canCreateOrder = hasPermission('order', 2);

  const handleOrderClick = (order) => {
    navigate(`/orders/${order.internal_num_orders}`, {
      state: { uuid: order.uuid },
    });
  };

  const handleCreated = (newOrder) => {
    setShowModal(false);
    prependOrder(newOrder);
    setNewOrderUuid(newOrder.uuid);
    setTimeout(() => setNewOrderUuid(null), 3000);
  };

  return (
    <div className="orders-page">
      <div className="orders-container">
        {canCreateOrder && (
          <div className="orders-actions">
            <button
              className="create-order"
              onClick={() => setShowModal(true)}
            >
              Добавить заказ
            </button>
          </div>
        )}

        {!loading && error ? <p className="nan-orders">Что-то пошло не так O_o</p> : orders.length === 0 && !loading && !error ? <p className="nan-orders">Заказов пока нет</p> : null}

        {orders.map((order, index) => {
          const isLastElement = index === orders.length - 1;
          return (
            <OrderCard
              key={order.uuid}
              order={order}
              isLastElement={isLastElement}
              lastElementRef={lastElementRef}
              onClick={() => handleOrderClick(order)}
              isNew={order.uuid === newOrderUuid}
            />
          );
        })}

        {loading && <LoadingDots />}

        {!loading && hasMore && orders.length > 0 && (
          <div
            ref={lastElementRef}
            style={{ height: '10px' }}
          />
        )}
      </div>

      {showModal && (
        <CreateOrderModal
          onClose={() => setShowModal(false)}
          onCreated={handleCreated}
        />
      )}
    </div>
  );
};

export default OrdersPage;
