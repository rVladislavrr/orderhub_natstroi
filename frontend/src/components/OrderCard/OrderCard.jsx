import { getStatusColor } from '../../utils/statusUtils';
import './OrderCard.css';

const OrderCard = ({ order, isLastElement, lastElementRef, onClick }) => {
  return (
    <div
      className="order-card"
      ref={isLastElement ? lastElementRef : null}
      onClick={onClick}
    >
      <div
        className="card-status-bar"
        style={{ backgroundColor: getStatusColor(order.status) }}
      ></div>

      <div className="card-content">
        <div className="first-r-order-card">
          <div className="card-left">
            <p className="card-order-num">Заказ №{order.internal_num_orders}</p>
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
