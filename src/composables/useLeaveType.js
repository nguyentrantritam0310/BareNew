import { useState, useCallback } from 'react';
import leaveTypeService from '../services/leaveTypeService';

export const useLeaveType = () => {
  const [leaveTypes, setLeaveTypes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  /**
   * Lấy danh sách loại nghỉ phép
   */
  const fetchLeaveTypes = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      console.log('Fetching leave types...');
      const data = await leaveTypeService.getAllLeaveTypes();
      setLeaveTypes(data);
      console.log('Leave types fetched successfully:', data.length);
      return data;
    } catch (err) {
      const errorMessage = err.response?.data?.Message || err.response?.data?.message || err.message || 'Không thể tải danh sách loại nghỉ phép';
      setError(errorMessage);
      console.error('Error fetching leave types:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Lấy loại nghỉ phép theo ID
   */
  const getLeaveTypeById = useCallback(async (id) => {
    try {
      setLoading(true);
      setError(null);
      console.log('Fetching leave type by ID:', id);
      const data = await leaveTypeService.getLeaveTypeById(id);
      console.log('Leave type fetched successfully:', data);
      return data;
    } catch (err) {
      const errorMessage = err.response?.data?.Message || err.response?.data?.message || err.message || 'Không thể tải thông tin loại nghỉ phép';
      setError(errorMessage);
      console.error('Error fetching leave type:', err);
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
  const refreshLeaveTypes = useCallback(async () => {
    return await fetchLeaveTypes();
  }, [fetchLeaveTypes]);

  return {
    // State
    leaveTypes,
    loading,
    error,
    
    // Actions
    fetchLeaveTypes,
    getLeaveTypeById,
    clearError,
    refreshLeaveTypes
  };
};
