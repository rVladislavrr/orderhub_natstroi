import './OrdersPage.css';
import useInfiniteOrders from '../../hooks/useInfiniteOrders';

const OrdersPage = () => {
  const { orders, loading, lastElementRef, hasMore } = useInfiniteOrders();

  function getStatusColor(status) {
    switch (status) {
      case 'В разработке':
        return '#004e8d';
      case 'Новый':
        return '#009ED8';
      case 'Отменен':
        return '#000000';
      case 'Завершен':
        return '#A3ABB2';
      default:
        return '#009ED8';
    }
  }

  return (
    <div className="orders-page">
      {orders.length === 0 && !loading && <p>Заказов пока нет</p>}

      {orders.map((order, index) => {
        const isLastElement = index === orders.length - 1;

        return (
          <div
            className="order-card"
            key={order.uuid}
            ref={isLastElement ? lastElementRef : null}
          >
            <div
              className="card-status-bar"
              style={{ backgroundColor: getStatusColor(order.status) }}
            ></div>

            <div className="card-content">
              <div className="first-r-order-card">
                <div className="card-left">
                  <h1 className="card-order-num">Заказ №{order.internal_num_orders}</h1>
                  <p className="card-date">от {order.internal_create_date}</p>
                </div>
                <p className="card-name">{order.name}</p>
              </div>

              <div className="card-inner-order-num">
                <p>
                  <span className="label">Номер заказа:</span> {order.num_orders}
                </p>
                <p>
                  <span className="label">Номер проекта:</span> {order.num_project}
                </p>
              </div>

              <div
                className="order-status"
                style={{ backgroundColor: getStatusColor(order.status) }}
              >
                {order.status}
              </div>
            </div>
          </div>
        );
      })}

      {loading && <p className="orders-loading-text">Загрузка...</p>}

      {!loading && hasMore && orders.length > 0 && (
        <div
          ref={lastElementRef}
          style={{ height: '10px' }}
        />
      )}
    </div>
  );
};

export default OrdersPage;
