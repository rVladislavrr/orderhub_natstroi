import { api } from './ordersApi';

export const loginRequest = async (username, password) => {
  const response = await api.post('/auth/login', { username, password });
  return response.data;
};

export const logoutRequest = async () => {
  await api.post('/auth/logout');
};

export const refreshRequest = async () => {
  const response = await api.post('/auth/refresh');
  return response.data;
};
