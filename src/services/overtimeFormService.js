import api from '../api';

export const overtimeFormService = {
  getAll: async () => {
    const response = await api.get('/OvertimeForm');
    return response.data;
  },
  getById: async (id) => {
    const response = await api.get(`/OvertimeForm/${id}`);
    return response.data;
  }
};

export const getOvertimeForms = () => overtimeFormService.getAll();
