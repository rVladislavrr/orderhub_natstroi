import axios from 'axios';

const api = axios.create({
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
