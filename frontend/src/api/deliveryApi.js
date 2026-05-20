import { api } from './ordersApi';

export const getStock = async () => {
  const response = await api.get('/delivery/stock');
  return response.data;
};

export const checkMetal = async (profile_type, profile_size, steel_grade) => {
  const response = await api.get('/delivery/check', {
    params: { profile_type, profile_size, steel_grade },
  });
  return response.data;
};

export const allocateStock = async (profile_type, profile_size, steel_grade, kmd_uuid, weight) => {
  const response = await api.post('/delivery/stock/allocate', {
    profile_type,
    profile_size,
    steel_grade,
    kmd_uuid,
    weight,
  });
  return response.data;
};

export const getTrucks = async () => {
  const response = await api.get('/delivery/trucks');
  return response.data;
};

export const getTruckById = async (truck_id) => {
  const response = await api.get(`/delivery/trucks/${truck_id}`);
  return response.data;
};

export const createTruck = async (payload) => {
  const response = await api.post('/delivery/trucks', payload);
  return response.data;
};

export const getProfileTypes = async (search = '') => {
  const response = await api.get('/delivery/profile/types', {
    params: search ? { search } : {},
  });
  return response.data;
};

export const getProfileSizes = async (type, search = '') => {
  const response = await api.get('/delivery/profile/sizes', {
    params: search ? { type, search } : { type },
  });
  return response.data;
};

export const getProfileSteels = async (type, size) => {
  const response = await api.get('/delivery/profile/steels', {
    params: { type, size },
  });
  return response.data;
};
