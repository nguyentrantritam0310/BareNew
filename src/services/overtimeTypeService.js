import api from '../api';

export const overtimeTypeService = {
  getAll: async () => {
    const response = await api.get('/OvertimeType');
    return response.data;
  },
  getById: async (id) => {
    const response = await api.get(`/OvertimeType/${id}`);
    return response.data;
  }
};

export const getOvertimeTypes = () => overtimeTypeService.getAll();
