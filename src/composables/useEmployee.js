import { useState, useCallback } from 'react';
import employeeService from '../services/employeeService';

export const useEmployee = () => {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  /**
   * Lấy danh sách nhân viên
   */
  const fetchAllEmployees = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      console.log('Fetching employees...');
      const data = await employeeService.getAllEmployees();
      setEmployees(data);
      console.log('Employees fetched successfully:', data.length);
      return data;
    } catch (err) {
      const errorMessage = err.response?.data?.Message || err.response?.data?.message || err.message || 'Không thể tải danh sách nhân viên';
      setError(errorMessage);
      console.error('Error fetching employees:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Lấy nhân viên theo ID
   */
  const getEmployeeById = useCallback(async (id) => {
    try {
      setLoading(true);
      setError(null);
      console.log('Fetching employee by ID:', id);
      const data = await employeeService.getEmployeeById(id);
      console.log('Employee fetched successfully:', data);
      return data;
    } catch (err) {
      const errorMessage = err.response?.data?.Message || err.response?.data?.message || err.message || 'Không thể tải thông tin nhân viên';
      setError(errorMessage);
      console.error('Error fetching employee:', err);
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
  const refreshEmployees = useCallback(async () => {
    return await fetchAllEmployees();
  }, [fetchAllEmployees]);

  return {
    // State
    employees,
    loading,
    error,
    
    // Actions
    fetchAllEmployees,
    getEmployeeById,
    clearError,
    refreshEmployees
  };
};
