import { api } from './ordersApi';

export const getWorkers = async (page = 1, limit = 50) => {
  const response = await api.get('/work/workers', {
    params: { page, limit },
  });
  return response.data;
};

export const createWorkExecution = async (workData) => {
  const response = await api.post('/work/', workData);
  return response.data;
};

export const getWorkJournal = async (params = {}) => {
  const response = await api.get('/work/', { params });
  return response.data;
};
