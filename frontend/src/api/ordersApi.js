import axios from 'axios';

export const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000,
});

export const getOrders = async (page, limit = 5) => {
  const response = await api.get('/orders', {
    params: { page, limit },
  });
  return response.data;
};

export const createOrder = async (orderData) => {
  try {
    const response = await api.post('/orders', orderData);
    return response.data;
  } catch (error) {
    console.error('Ошибка при создании заказа', error);
    throw error;
  }
};

export const uploadOrderFile = async (orderId, file) => {
  try {
    const formData = new FormData();
    formData.append('file', file);

    const response = await api.post(`/orders/${orderId}/upload`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  } catch (error) {
    console.error('error', error);
    throw error;
  }
};

export const getOrderInfo = async (uuid) => {
  try {
    const response = await api.get(`/orders/${uuid}`);
    return response.data;
  } catch (error) {
    console.error(`Ошибка при получении заказа ${uuid}:`, error);
    throw error;
  }
};

export const getOrderMarks = async (uuid, page, limit = 200) => {
  try {
    const response = await api.get(`/kmd/${uuid}/marks`, {
      params: { page, limit },
    });
    return response.data;
  } catch (error) {
    console.error(`Ошибка при получении марок для заказа ${uuid}:`, error);
    throw error;
  }
};

export const getMarkDetails = async (markId) => {
  try {
    const response = await api.get(`/marks/${markId}/details`);
    return response.data;
  } catch (error) {
    console.error(`Ошибка при получении деталей марки ${markId}:`, error);
    throw error;
  }
};
