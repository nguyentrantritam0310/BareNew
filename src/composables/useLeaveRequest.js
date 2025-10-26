import { useState, useCallback } from 'react';
import leaveService from '../services/leaveService';

export const useLeaveRequest = () => {
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  /**
   * Lấy danh sách đơn nghỉ phép
   */
  const fetchLeaveRequests = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      console.log('Fetching leave requests...');
      const data = await leaveService.getAllLeaveRequests();
      setLeaveRequests(data);
      console.log('Leave requests fetched successfully:', data.length);
      return data;
    } catch (err) {
      const errorMessage = err.response?.data?.Message || err.response?.data?.message || err.message || 'Có lỗi xảy ra khi tải danh sách đơn nghỉ phép';
      setError(errorMessage);
      console.error('Error fetching leave requests:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Lấy đơn nghỉ phép theo ID
   */
  const getLeaveRequestById = useCallback(async (voucherCode) => {
    try {
      setLoading(true);
      setError(null);
      console.log('Fetching leave request by ID:', voucherCode);
      const data = await leaveService.getLeaveRequestById(voucherCode);
      console.log('Leave request fetched successfully:', data);
      return data;
    } catch (err) {
      const errorMessage = err.response?.data?.Message || err.response?.data?.message || err.message || 'Có lỗi xảy ra khi tải thông tin đơn nghỉ phép';
      setError(errorMessage);
      console.error('Error fetching leave request:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Tạo đơn nghỉ phép mới
   */
  const createLeaveRequest = useCallback(async (leaveRequestData) => {
    try {
      setLoading(true);
      setError(null);
      console.log('Creating leave request:', leaveRequestData);
      const data = await leaveService.createLeaveRequest(leaveRequestData);
      
      // Thêm vào đầu danh sách
      setLeaveRequests(prev => [data, ...prev]);
      
      console.log('Leave request created successfully:', data);
      return data;
    } catch (err) {
      const errorMessage = err.response?.data?.Message || err.response?.data?.message || err.message || 'Có lỗi xảy ra khi tạo đơn nghỉ phép';
      setError(errorMessage);
      console.error('Error creating leave request:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Cập nhật đơn nghỉ phép
   */
  const updateLeaveRequest = useCallback(async (voucherCode, leaveRequestData) => {
    try {
      setLoading(true);
      setError(null);
      console.log('Updating leave request:', voucherCode, leaveRequestData);
      const data = await leaveService.updateLeaveRequest(voucherCode, leaveRequestData);
      
      // Cập nhật trong danh sách
      setLeaveRequests(prev => 
        prev.map(item => 
          item.voucherCode === voucherCode ? data : item
        )
      );
      
      console.log('Leave request updated successfully:', data);
      return data;
    } catch (err) {
      const errorMessage = err.response?.data?.Message || err.response?.data?.message || err.message || 'Có lỗi xảy ra khi cập nhật đơn nghỉ phép';
      setError(errorMessage);
      console.error('Error updating leave request:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Xóa đơn nghỉ phép
   */
  const deleteLeaveRequest = useCallback(async (voucherCode) => {
    try {
      setLoading(true);
      setError(null);
      console.log('Deleting leave request:', voucherCode);
      await leaveService.deleteLeaveRequest(voucherCode);
      
      // Xóa khỏi danh sách
      setLeaveRequests(prev => 
        prev.filter(item => item.voucherCode !== voucherCode)
      );
      
      console.log('Leave request deleted successfully');
    } catch (err) {
      const errorMessage = err.response?.data?.Message || err.response?.data?.message || err.message || 'Có lỗi xảy ra khi xóa đơn nghỉ phép';
      setError(errorMessage);
      console.error('Error deleting leave request:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Gửi đơn nghỉ phép để duyệt
   */
  const submitForApproval = useCallback(async (voucherCode) => {
    try {
      setLoading(true);
      setError(null);
      console.log('Submitting leave request for approval:', voucherCode);
      const data = await leaveService.submitForApproval(voucherCode);
      
      // Cập nhật trong danh sách
      setLeaveRequests(prev => 
        prev.map(item => 
          item.voucherCode === voucherCode ? { ...item, approveStatus: 'Chờ duyệt' } : item
        )
      );
      
      console.log('Leave request submitted for approval successfully');
      return data;
    } catch (err) {
      const errorMessage = err.response?.data?.Message || err.response?.data?.message || err.message || 'Có lỗi xảy ra khi gửi duyệt đơn nghỉ phép';
      setError(errorMessage);
      console.error('Error submitting for approval:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Duyệt đơn nghỉ phép
   */
  const approveLeaveRequest = useCallback(async (voucherCode, action) => {
    try {
      setLoading(true);
      setError(null);
      console.log('Approving leave request:', voucherCode, 'with action:', action);
      const data = await leaveService.approveLeaveRequest(voucherCode, action);
      
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
      
      setLeaveRequests(prev => 
        prev.map(item => 
          item.voucherCode === voucherCode ? { ...item, approveStatus: newStatus } : item
        )
      );
      
      console.log('Leave request approved successfully');
      return data;
    } catch (err) {
      const errorMessage = err.response?.data?.Message || err.response?.data?.message || err.message || 'Có lỗi xảy ra khi duyệt đơn nghỉ phép';
      setError(errorMessage);
      console.error('Error approving leave request:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Xóa lỗi
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  /**
   * Làm mới danh sách
   */
  const refreshLeaveRequests = useCallback(async () => {
    return await fetchLeaveRequests();
  }, [fetchLeaveRequests]);

  return {
    // State
    leaveRequests,
    loading,
    error,
    
    // Actions
    fetchLeaveRequests,
    getLeaveRequestById,
    createLeaveRequest,
    updateLeaveRequest,
    deleteLeaveRequest,
    submitForApproval,
    approveLeaveRequest,
    clearError,
    refreshLeaveRequests
  };
};
