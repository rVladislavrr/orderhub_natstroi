import { api } from './ordersApi';

export const getMaterialsByOrder = async (uuidOrder, page = 1, limit = 100) => {
  const response = await api.get(`/materials/order/${uuidOrder}`, {
    params: { page, limit, include_deficit: true },
  });
  return response.data;
};

export const getActiveMaterials = async (page = 1, limit = 100) => {
  const response = await api.get('/materials/active', {
    params: { page, limit, include_deficit: true },
  });
  return response.data;
};
