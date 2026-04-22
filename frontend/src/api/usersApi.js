import { api } from './ordersApi';

export const getUsers = async (page = 1, limit = 10) => {
  const response = await api.get('/users', {
    params: { page, limit },
  });
  return response.data;
};

export const addUser = async (userData) => {
  const response = await api.post('/users/add_user', userData);
  return response.data;
};

export const updatePermissions = async (userId, permissions) => {
  const response = await api.put(`/users/${userId}/permissions`, permissions);
  return response.data;
};
