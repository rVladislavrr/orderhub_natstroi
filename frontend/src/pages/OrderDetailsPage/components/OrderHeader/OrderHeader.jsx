import React from 'react';

import './OrderHeader.css';
import { getStatusColor } from '../../../../utils/statusUtils';

const RefreshButton = ({ onClick }) => (
  <button
    className="mat-refresh-btn"
    onClick={onClick}
    title="Обновить"
  >
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="23 4 23 10 17 10" />
      <polyline points="1 20 1 14 7 14" />
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
    </svg>
    Обновить
  </button>
);

const OrderHeader = ({ order, canChanges, onEditClick, onRefresh }) => {
  const formatWeight = (value) => `${Number(value).toLocaleString('ru-RU')} кг`;

  const shippedPercent = order.total_marks_weight > 0 ? Math.min(100, (order.total_shipped_weight / order.total_marks_weight) * 100).toFixed(1) : 0;

  return (
    <>
      <div className="first-r-info">
        <div className="title-date-info">
          <h1 className="title-info">Заказ №{order.internal_num_orders}</h1>
          <p className="date-info">от {order.internal_create_date}</p>
          {canChanges && (
            <button
              className="edit-order-btn"
              onClick={onEditClick}
              title="Редактировать заказ"
            >
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
              Редактировать
            </button>
          )}
        </div>
        <div
          className="status-info"
          style={{ backgroundColor: getStatusColor(order.status) }}
        >
          {order.status}
        </div>
      </div>
      
      <div className="name-and-ref-btn">
        <p className="name-info">{order.name}</p>
        <RefreshButton onClick={onRefresh} />
      </div>

      <div className="order-info-row">
        <div className="order-numbers">
          <p className="num-orders-info">
            Номер заказа: <span>{order.num_orders}</span>
          </p>
          <p className="num-proj-info">
            Номер проекта: <span>{order.num_project}</span>
          </p>
        </div>

        <div className="order-stats-right">
          <div className="marks-info">
            <div className="marks-info-item">
              <span className="marks-info-label">Кол-во уникальных марок:</span>
              <span className="marks-info-value">{order.total_marks_count_uq}</span>
            </div>
            <div className="marks-info-item">
              <span className="marks-info-label">Кол-во всех марок:</span>
              <span className="marks-info-value">{order.total_marks_count}</span>
            </div>
            <div className="marks-info-item">
              <span className="marks-info-label">Общий вес марок:</span>
              <span className="marks-info-value">{formatWeight(order.total_marks_weight)}</span>
            </div>
          </div>

          <div className="stats-divider" />

          <div className="shipped-info">
            <div className="marks-info-item">
              <span className="marks-info-label">Отгружено марок:</span>
              <span className="marks-info-value shipped-value">{order.total_shipped_count}</span>
            </div>
            <div className="marks-info-item">
              <span className="marks-info-label">Вес отгруженных:</span>
              <span className="marks-info-value shipped-value">{formatWeight(order.total_shipped_weight)}</span>
            </div>

            <div className="shipped-progress-wrap">
              <div className="shipped-progress-header">
                <span className="shipped-progress-label">Отгружено по весу</span>
                <span className="shipped-progress-percent">{shippedPercent}%</span>
              </div>
              <div className="shipped-progress-track">
                <div
                  className="shipped-progress-fill"
                  style={{ width: `${shippedPercent}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default OrderHeader;
