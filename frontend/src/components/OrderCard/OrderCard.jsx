import './OrderCard.css';

const OrderCard = ({ order, isLastElement, lastElementRef }) => {
  const getStatusColor = (status) => {
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
  };
  return (
    <div
      className="order-card"
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
};

export default OrderCard;
