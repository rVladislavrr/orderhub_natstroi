import axios from 'axios';

export const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  paramsSerializer: {
    indexes: null,
  },
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

export const getOrderMarks = async (kmdUuid, params = {}) => {
  try {
    const { page = 1, limit = 5, sort_by = 'title', order_by = 'asc', filter_name = null, filter_cooperation = null, filter_mounting_part = null } = params;

    const queryParams = {
      page,
      limit,
      sort_by,
      order_by,
    };

    if (filter_name && filter_name.length > 0) {
      queryParams.filter_name = filter_name;
    }
    if (filter_cooperation && filter_cooperation.length > 0) {
      queryParams.filter_cooperation = filter_cooperation;
    }
    if (filter_mounting_part && filter_mounting_part.length > 0) {
      queryParams.filter_mounting_part = filter_mounting_part;
    }

    const response = await api.get(`/kmd/${kmdUuid}/marks`, {
      params: queryParams,
    });
    return response.data;
  } catch (error) {
    console.error(`Ошибка при получении марок для заказа ${kmdUuid}:`, error);
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

export const getMarksFilters = async (kmdUuid, column) => {
  try {
    const response = await api.get(`/kmd/${kmdUuid}/filters`, {
      params: {
        column: column,
      },
    });
    return response.data;
  } catch (error) {
    console.error(`Ошибка при получении фильтров для КМД ${kmdUuid}:`, error);
    throw error;
  }
};
