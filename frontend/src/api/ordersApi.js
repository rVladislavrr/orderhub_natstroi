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

export const uploadFile = async (file) => {
  try {
    const response = await axios.post('/orders/upload');
    return response.data;
  } catch (error) {
    console.error('error', error);
  }
}
