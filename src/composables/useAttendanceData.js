import { useState, useEffect, useCallback } from 'react';
import { attendanceDataService } from '../services/attendanceDataService';

export const useAttendanceData = () => {
  const [attendanceData, setAttendanceData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('unknown');

  const testConnection = async () => {
    try {
      const isConnected = await attendanceDataService.testConnection();
      setConnectionStatus(isConnected ? 'connected' : 'disconnected');
      return isConnected;
    } catch (err) {
      console.error('Connection test failed:', err);
      setConnectionStatus('disconnected');
      return false;
    }
  };

  const fetchAttendanceData = async (params = {}) => {
    try {
      setLoading(true);
      setError(null);
      
      let data;
      if (params.employeeCode && params.date) {
        data = await attendanceDataService.getAttendanceDataByEmployeeAndDate(params.employeeCode, params.date);
      } else if (params.employeeCode) {
        data = await attendanceDataService.getAttendanceDataByEmployee(params.employeeCode);
      } else if (params.startDate && params.endDate) {
        data = await attendanceDataService.getAttendanceDataByDateRange(params.startDate, params.endDate);
      } else if (params.week) {
        data = await attendanceDataService.getAttendanceDataByWeek(params.week);
      } else if (params.year && params.month) {
        data = await attendanceDataService.getAttendanceDataByMonth(params.year, params.month);
      } else {
        data = await attendanceDataService.getAllAttendanceData();
      }
      
      // Validate and clean data
      const validatedData = Array.isArray(data) ? data.filter(item => {
        // Basic validation for required fields
        return item && typeof item === 'object' && item.date;
      }) : [];
      
      setAttendanceData(validatedData);
      setConnectionStatus('connected');
    } catch (err) {
      let errorMessage = 'Không thể tải dữ liệu chấm công';
      
      if (err.response?.status === 401) {
        errorMessage = 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.';
      } else if (err.response?.status === 404) {
        errorMessage = 'Không tìm thấy dữ liệu chấm công.';
      } else if (err.response?.status === 500) {
        errorMessage = 'Lỗi server. Vui lòng thử lại sau.';
      } else if (err.message?.includes('Network Error') || err.message?.includes('timeout')) {
        errorMessage = 'Không thể kết nối đến server. Vui lòng kiểm tra kết nối mạng.';
      } else if (err.response?.data?.message) {
        errorMessage = err.response.data.message;
      } else if (err.message) {
        errorMessage = err.message;
      }
      
      setError(errorMessage);
      setAttendanceData([]);
      setConnectionStatus('disconnected');
    } finally {
      setLoading(false);
    }
  };

  const refreshAttendanceData = async (params = {}) => {
    try {
      const data = await attendanceDataService.getAllAttendanceData();
      setAttendanceData(data);
    } catch (err) {
      console.error("Error refreshing attendance data:", err);
      setError(err.message || 'Không thể làm mới dữ liệu');
    }
  };

  const clearError = () => setError(null);

  useEffect(() => {
    fetchAttendanceData();
  }, []);

  return {
    attendanceData,
    loading,
    error,
    connectionStatus,
    fetchAttendanceData,
    refreshAttendanceData,
    clearError,
    testConnection,
  };
};