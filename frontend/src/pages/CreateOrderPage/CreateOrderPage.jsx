import { useNavigate } from 'react-router-dom';
import './CreateOrderPage.css';
import { createOrder } from '../../api/ordersApi';
import { useState } from 'react';
import { toast } from 'react-toastify';

const CreateOrderPage = () => {
  const navigate = useNavigate();
  const [errors, setErrors] = useState({});

  const validateForm = (formData) => {
    const errors = {};

    const internalNum = formData.get('internalNumOrders');
    if (!internalNum?.trim()) {
      errors.internalNumOrders = 'Внутренний номер заказа обязателен';
    } else if (isNaN(internalNum) || Number(internalNum) <= 0) {
      errors.internalNumOrders = 'Введите положительное число';
    }

    const date = formData.get('internalCreateDate');
    if (!date || date.trim() === '') {
      errors.internalCreateDate = 'Дата обязательна';
    }

    const name = formData.get('orderName');
    if (!name?.trim()) {
      errors.orderName = 'Название заказа обязательно';
    } else if (name.trim().length < 3) {
      errors.orderName = 'Название должно содержать минимум 3 символа';
    }

    const numOrders = formData.get('numOrders');
    if (!numOrders?.trim()) {
      errors.numOrders = 'Номер заказа обязателен';
    } else if (isNaN(numOrders) || Number(numOrders) <= 0) {
      errors.numOrders = 'Введите положительное число';
    }

    const numProject = formData.get('numProject');
    if (!numProject?.trim()) {
      errors.numProject = 'Номер проекта обязателен';
    }

    return errors;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const formData = new FormData(e.target);
    const validationErrors = validateForm(formData);

    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setErrors({});

    const orderData = {
      internal_num_orders: parseInt(formData.get('internalNumOrders')),
      internal_create_date: formData.get('internalCreateDate'),
      name: formData.get('orderName'),
      num_orders: parseInt(formData.get('numOrders')),
      num_project: formData.get('numProject'),
    };

    try {
      await createOrder(orderData);
      toast.success('Заказ успешно создан!');
      navigate('/orders');
    } catch (error) {
      console.error('Ошибка при добавлении заказа', error);
    }
  };

  return (
    <div className="create-order-page">
      <h1 className="create-order-title">Добавление нового заказа</h1>

      <form
        onSubmit={handleSubmit}
        className="create-order-form"
      >
        <div className="form-grid">
          <div className="form-group">
            <label htmlFor="internal_num_orders">Внутренний номер заказа</label>
            <input
              type="number"
              id="internal_num_orders"
              name="internalNumOrders"
              placeholder="Например: 646"
              className={errors.internalNumOrders ? 'error' : ''}
            />
            {errors.internalNumOrders && <span className="error-message">{errors.internalNumOrders}</span>}
          </div>

          <div className="form-group form-group--date">
            <label htmlFor="internal_create_date">Дата</label>
            <input
              type="date"
              id="internal_create_date"
              name="internalCreateDate"
              defaultValue={new Date().toISOString().split('T')[0]}
              className={errors.internalCreateDate ? 'error' : ''}
            />
            {errors.internalCreateDate && <span className="error-message">{errors.internalCreateDate}</span>}
          </div>

          <div className="form-group">
            <label htmlFor="num_orders">Номер заказа</label>
            <input
              type="number"
              id="num_orders"
              name="numOrders"
              placeholder="Например: 361070"
              className={errors.numOrders ? 'error' : ''}
            />
            {errors.numOrders && <span className="error-message">{errors.numOrders}</span>}
          </div>

          <div className="form-group">
            <label htmlFor="num_project">Номер проекта</label>
            <input
              type="text"
              id="num_project"
              name="numProject"
              placeholder="Например: 2260-60(1)-23-КМД"
              className={errors.numProject ? 'error' : ''}
            />
            {errors.numProject && <span className="error-message">{errors.numProject}</span>}
          </div>

          <div className="form-group form-group--full">
            <label htmlFor="order_name">Название проекта</label>
            <input
              type="text"
              id="order_name"
              name="orderName"
              placeholder="Введите название проекта"
              className={errors.orderName ? 'error' : ''}
            />
            {errors.orderName && <span className="error-message">{errors.orderName}</span>}
          </div>
        </div>

        <div className="form-actions">
          <button
            type="submit"
            className="btn-create-order-submit"
          >
            Добавить заказ
          </button>
          <button
            type="button"
            className="btn-create-order-cancel"
            onClick={() => navigate('/orders')}
          >
            Отмена
          </button>
        </div>
      </form>
    </div>
  );
};

export default CreateOrderPage;
