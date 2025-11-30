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
  },

  // Gửi đơn tăng ca để duyệt
  submitForApproval: async (voucherCode, notes) => {
    const response = await api.put(`/EmployeeRequest/overtime/${voucherCode}/submit`, {
      notes: notes || null
    });
    return response.data;
  },

  // Duyệt đơn tăng ca
  approve: async (voucherCode, notes) => {
    const response = await api.put(`/EmployeeRequest/overtime/${voucherCode}/approve`, {
      notes: notes || null
    });
    return response.data;
  },

  // Từ chối đơn tăng ca
  reject: async (voucherCode, notes) => {
    const response = await api.put(`/EmployeeRequest/overtime/${voucherCode}/reject`, {
      notes: notes || null
    });
    return response.data;
  },

  // Trả lại đơn tăng ca
  return: async (voucherCode, notes) => {
    const response = await api.put(`/EmployeeRequest/overtime/${voucherCode}/return`, {
      notes: notes || null
    });
    return response.data;
  }
};
