import { useState, useEffect } from 'react';
import { overtimeRequestService } from '../services/overtimeRequestService';

export const useOvertimeRequest = () => {
  const [overtimeRequests, setOvertimeRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchOvertimeRequests = async () => {
    try {
      setLoading(true);
      const data = await overtimeRequestService.getAll();
      setOvertimeRequests(data);
    } catch (err) {
      console.error("Error fetching overtime requests:", JSON.stringify(err, null, 2));
      setError(err.message || 'Không thể tải danh sách đơn tăng ca');
    } finally {
      setLoading(false);
    }
  };

  const refreshOvertimeRequests = async () => {
    try {
      const data = await overtimeRequestService.getAll();
      setOvertimeRequests(data);
    } catch (err) {
      console.error("Error refreshing overtime requests:", JSON.stringify(err, null, 2));
      setError(err.message || 'Không thể làm mới danh sách');
    }
  };

  const getOvertimeRequestById = async (id) => {
    try {
      const data = await overtimeRequestService.getById(id);
      return data;
    } catch (err) {
      console.error("Error fetching overtime request by id:", JSON.stringify(err, null, 2));
      throw err;
    }
  };

  const createOvertimeRequest = async (data) => {
    try {
      setLoading(true);
      const result = await overtimeRequestService.create(data);
      await fetchOvertimeRequests(); // Refresh the list
      return result;
    } catch (err) {
      console.error("Error creating overtime request:", JSON.stringify(err, null, 2));
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const updateOvertimeRequest = async (id, data) => {
    try {
      setLoading(true);
      const result = await overtimeRequestService.update(id, data);
      await fetchOvertimeRequests(); // Refresh the list
      return result;
    } catch (err) {
      console.error("Error updating overtime request:", JSON.stringify(err, null, 2));
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const deleteOvertimeRequest = async (id) => {
    try {
      setLoading(true);
      const result = await overtimeRequestService.delete(id);
      await fetchOvertimeRequests(); // Refresh the list
      return result;
    } catch (err) {
      console.error("Error deleting overtime request:", JSON.stringify(err, null, 2));
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const submitForApproval = async (voucherCode, notes) => {
    try {
      setLoading(true);
      setError(null);
      const data = await overtimeRequestService.submitForApproval(voucherCode, notes);
      
      // Cập nhật trong danh sách
      setOvertimeRequests(prev => 
        prev.map(item => 
          item.voucherCode === voucherCode ? { ...item, approveStatus: 'Chờ duyệt' } : item
        )
      );
      
      return data;
    } catch (err) {
      const errorMessage = err.response?.data?.Message || err.response?.data?.message || err.message || 'Có lỗi xảy ra khi gửi duyệt đơn tăng ca';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const approveOvertimeRequest = async (voucherCode, action, notes) => {
    try {
      setLoading(true);
      setError(null);
      
      let data;
      switch (action) {
        case 'approve':
          data = await overtimeRequestService.approve(voucherCode, notes);
          break;
        case 'reject':
          data = await overtimeRequestService.reject(voucherCode, notes);
          break;
        case 'return':
          data = await overtimeRequestService.return(voucherCode, notes);
          break;
        default:
          throw new Error('Invalid approval action');
      }
      
      // Cập nhật trong danh sách
      let newStatus;
      switch (action) {
        case 'approve':
          newStatus = 'Đã duyệt';
          break;
        case 'reject':
          newStatus = 'Từ chối';
          break;
        case 'return':
          newStatus = 'Tạo mới';
          break;
        default:
          newStatus = 'Chờ duyệt';
      }
      
      setOvertimeRequests(prev => 
        prev.map(item => 
          item.voucherCode === voucherCode ? { ...item, approveStatus: newStatus } : item
        )
      );
      
      return data;
    } catch (err) {
      const errorMessage = err.response?.data?.Message || err.response?.data?.message || err.message || 'Có lỗi xảy ra khi duyệt đơn tăng ca';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const clearError = () => {
    setError(null);
  };

  useEffect(() => {
    fetchOvertimeRequests();
  }, []);

  return {
    overtimeRequests,
    loading,
    error,
    fetchOvertimeRequests,
    refreshOvertimeRequests,
    getOvertimeRequestById,
    createOvertimeRequest,
    updateOvertimeRequest,
    deleteOvertimeRequest,
    submitForApproval,
    approveOvertimeRequest,
    clearError
  };
};
