import { api } from './ordersApi';

export const getMaterialsByOrder = async (uuidOrder, page = 1, limit = 100, hide_zero_deficit = false) => {
  const response = await api.get(`/materials/order/${uuidOrder}`, {
    params: {
      page: page,
      limit: limit,
      include_deficit: true,
      hide_zero_deficit: hide_zero_deficit,
    },
  });
  return response.data;
};

export const getActiveMaterials = async (page = 1, limit = 100, hide_zero_deficit = false) => {
  const response = await api.get('/materials/active', {
    params: {
      page: page,
      limit: limit,
      include_deficit: true,
      hide_zero_deficit: hide_zero_deficit,
    },
  });
  return response.data;
};

export const getAllActiveMaterials = async (hide_zero_deficit = false) => {
  const response = await api.get('/materials/active', {
    params: {
      limit: 200,
      include_deficit: true,
      hide_zero_deficit: hide_zero_deficit,
    },
  });
  return response.data;
};
