import React from 'react';
import { getStatusColor } from '../../../utils/statusUtils';

const OrderHeader = ({ order }) => {
  const NumberDisplay = ({ value }) => {
    const formattedNumber = Number(value).toLocaleString('ru-RU');

    return <span className="marks-info-value">{formattedNumber} кг</span>;
  };
  return (
    <>
      <div className="first-r-info">
        <div className="title-date-info">
          <h1 className="title-info">Заказ №{order.internal_num_orders}</h1>
          <p className="date-info">от {order.internal_create_date}</p>
        </div>
        <div
          className="status-info"
          style={{ backgroundColor: getStatusColor(order.status) }}
        >
          {order.status}
        </div>
      </div>

      <p className="name-info">{order.name}</p>
      <div className="order-info-row">
        <div className="order-numbers">
          <p className="num-orders-info">
            Номер заказа: <span>{order.num_orders}</span>
          </p>
          <p className="num-proj-info">
            Номер проекта: <span>{order.num_project}</span>
          </p>
        </div>

        <div className="marks-info">
          <div className="marks-info-item">
            <span className="marks-info-label">Кол-во уникальных марок: </span>
            <span className="marks-info-value">{order.total_marks_count_uq}</span>
          </div>
          <div className="marks-info-item">
            <span className="marks-info-label">Кол-во всех марок: </span>
            <span className="marks-info-value">{order.total_marks_count}</span>
          </div>
          <div className="marks-info-item">
            <span className="marks-info-label">Общий вес марок: </span>
            <NumberDisplay value={order.total_marks_weight} />
          </div>
        </div>
      </div>
    </>
  );
};

export default OrderHeader;
