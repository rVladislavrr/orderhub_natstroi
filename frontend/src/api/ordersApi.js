import axios from 'axios';

export const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
  paramsSerializer: {
    indexes: null,
  },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) {
    config.headers['Authorization'] = `Bearer ${token}`;
  }
  return config;
});

let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry && !originalRequest.url.includes('/auth/refresh') && !originalRequest.url.includes('/auth/login')) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers['Authorization'] = `Bearer ${token}`;
            return api(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const response = await api.post('/auth/refresh');
        const { accessToken } = response.data;

        localStorage.setItem('access_token', accessToken);
        api.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;

        processQueue(null, accessToken);

        originalRequest.headers['Authorization'] = `Bearer ${accessToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        localStorage.removeItem('access_token');
        delete api.defaults.headers.common['Authorization'];
        window.location.href = '/';
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  },
);

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
    const { page = 1, limit = 5, sort_by = 'title', order_by = 'asc', filter_name = null, filter_cooperation = null, filter_mounting_part = null, filter_status = null } = params;

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
    if (filter_status && filter_status.length > 0) {
      queryParams.filter_status = filter_status;
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

export const getMarkDetails = async (markId, page = 1, limit = 20) => {
  try {
    const response = await api.get(`/marks/${markId}/details`, {
      params: { page, limit },
    });
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

export const deleteOrderFile = async (fileId) => {
  const response = await api.delete(`/orders/files/${fileId}`);
  return response.data;
};

export const getKmdInfo = async (kmdUuid) => {
  try {
    const response = await api.get(`/kmd/${kmdUuid}`);
    return response.data;
  } catch (error) {
    console.error(`Ошибка при получении информации о КМД ${kmdUuid}:`, error);
    throw error;
  }
};

export const assembleMark = async (markId, data) => {
  const response = await api.post(`/marks/${markId}/assemble`, data);
  return response.data;
};

export const shipMark = async (markId, data) => {
  const response = await api.post(`/marks/${markId}/ship`, data);
  return response.data;
};

export const updateOrder = (uuid, data) => api.put(`/orders/${uuid}`, data).then((res) => res.data);
