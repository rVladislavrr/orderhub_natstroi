import { useState } from 'react';
import { createOrder } from '../../../api/ordersApi';
import { toast } from 'react-toastify';
import './CreateOrderModal.css';

const CreateOrderModal = ({ onClose, onCreated }) => {
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  const validate = (formData) => {
    const errs = {};

    const internalNum = formData.get('internalNumOrders');
    if (!internalNum?.trim()) {
      errs.internalNumOrders = 'Внутренний номер заказа обязателен';
    } else if (isNaN(internalNum) || Number(internalNum) <= 0) {
      errs.internalNumOrders = 'Введите положительное число';
    }

    const date = formData.get('internalCreateDate');
    if (!date || date.trim() === '') {
      errs.internalCreateDate = 'Дата обязательна';
    }

    const name = formData.get('orderName');
    if (!name?.trim()) {
      errs.orderName = 'Название заказа обязательно';
    } else if (name.trim().length < 3) {
      errs.orderName = 'Название должно содержать минимум 3 символа';
    }

    const numOrders = formData.get('numOrders');
    if (!numOrders?.trim()) {
      errs.numOrders = 'Номер заказа обязателен';
    } else if (isNaN(numOrders) || Number(numOrders) <= 0) {
      errs.numOrders = 'Введите положительное число';
    }

    const numProject = formData.get('numProject');
    if (!numProject?.trim()) {
      errs.numProject = 'Номер проекта обязателен';
    }

    return errs;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const validationErrors = validate(formData);

    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setErrors({});
    setLoading(true);

    try {
      const result = await createOrder({
        internal_num_orders: parseInt(formData.get('internalNumOrders')),
        internal_create_date: formData.get('internalCreateDate'),
        name: formData.get('orderName'),
        num_orders: formData.get('numOrders').trim(),
        num_project: formData.get('numProject').trim(),
      });
      toast.success('Заказ успешно создан!');
      onCreated(result);
    } catch (error) {
      const status = error?.response?.status;
      if (status === 409) {
        toast.error('Заказ с таким номером уже существует');
      } else {
        toast.error(error?.response?.data?.detail || 'Ошибка при создании заказа');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="co-modal-overlay">
      <div
        className="co-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="co-modal-header">
          <h2 className="co-modal-title">Новый заказ</h2>
          <button
            className="co-modal-close"
            onClick={onClose}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="co-modal-body">
            <div className="co-form-grid">
              <div className="co-form-field">
                <label
                  className="co-form-label"
                  htmlFor="internalNumOrders"
                >
                  Внутренний номер заказа
                </label>
                <input
                  className={`co-form-input${errors.internalNumOrders ? ' co-form-input--error' : ''}`}
                  type="number"
                  id="internalNumOrders"
                  name="internalNumOrders"
                  placeholder="Например: 646"
                />
                {errors.internalNumOrders && <span className="co-form-error">{errors.internalNumOrders}</span>}
              </div>

              <div className="co-form-field">
                <label
                  className="co-form-label"
                  htmlFor="internalCreateDate"
                >
                  Дата
                </label>
                <input
                  className={`co-form-input${errors.internalCreateDate ? ' co-form-input--error' : ''}`}
                  type="date"
                  id="internalCreateDate"
                  name="internalCreateDate"
                  defaultValue={new Date().toISOString().split('T')[0]}
                />
                {errors.internalCreateDate && <span className="co-form-error">{errors.internalCreateDate}</span>}
              </div>

              <div className="co-form-field">
                <label
                  className="co-form-label"
                  htmlFor="numOrders"
                >
                  Номер заказа
                </label>
                <input
                  className={`co-form-input${errors.numOrders ? ' co-form-input--error' : ''}`}
                  type="number"
                  id="numOrders"
                  name="numOrders"
                  placeholder="Например: 361070"
                />
                {errors.numOrders && <span className="co-form-error">{errors.numOrders}</span>}
              </div>

              <div className="co-form-field">
                <label
                  className="co-form-label"
                  htmlFor="numProject"
                >
                  Номер проекта
                </label>
                <input
                  className={`co-form-input${errors.numProject ? ' co-form-input--error' : ''}`}
                  type="text"
                  id="numProject"
                  name="numProject"
                  placeholder="Например: 2260-60(1)-23-КМД"
                />
                {errors.numProject && <span className="co-form-error">{errors.numProject}</span>}
              </div>

              <div className="co-form-field co-form-field--full">
                <label
                  className="co-form-label"
                  htmlFor="orderName"
                >
                  Название проекта
                </label>
                <input
                  className={`co-form-input${errors.orderName ? ' co-form-input--error' : ''}`}
                  type="text"
                  id="orderName"
                  name="orderName"
                  placeholder="Введите название проекта"
                />
                {errors.orderName && <span className="co-form-error">{errors.orderName}</span>}
              </div>
            </div>
          </div>

          <div className="co-modal-footer">
            <button
              type="button"
              className="co-btn co-btn--ghost"
              onClick={onClose}
              disabled={loading}
            >
              Отмена
            </button>
            <button
              type="submit"
              className="co-btn co-btn--primary"
              disabled={loading}
            >
              {loading ? 'Создание…' : 'Создать'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateOrderModal;
