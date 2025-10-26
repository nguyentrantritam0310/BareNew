import api from '../api';

export const overtimeRequestService = {
  getAll: async () => {
    const response = await api.get('/EmployeeRequest/overtime');
    return response.data;
  },
  getById: async (id) => {
    const response = await api.get(`/EmployeeRequest/overtime/${id}`);
    return response.data;
  },
  create: async (data) => {
    const response = await api.post('/EmployeeRequest/overtime', data);
    return response.data;
  },
  update: async (id, data) => {
    const response = await api.put(`/EmployeeRequest/overtime/${id}`, data);
    return response.data;
  },
  delete: async (id) => {
    const response = await api.delete(`/EmployeeRequest/overtime/${id}`);
    return response.data;
  }
};
