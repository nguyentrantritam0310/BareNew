import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_CONFIG } from '../config/api';

class AttendanceDataService {
  constructor() {
    this.api = axios.create({
      baseURL: `${API_CONFIG.BASE_URL}${API_CONFIG.API_PATH}`,
      timeout: API_CONFIG.TIMEOUT,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor để tự động thêm token vào header
    this.api.interceptors.request.use(
      async (config) => {
        const token = await AsyncStorage.getItem('token');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Response interceptor để xử lý errors
    this.api.interceptors.response.use(
      (response) => response,
      async (error) => {
        if (error.response?.status === 401) {
          await AsyncStorage.removeItem('token');
          await AsyncStorage.removeItem('user');
        }
        return Promise.reject(error);
      }
    );
  }

  /**
   * Transform API response data to format expected by screens
   * API returns records with both CheckInTime and CheckOutTime in the same record
   * We need to split them into separate records for check-in and check-out
   * @param {Array} apiData - Data from API
   * @returns {Array} Transformed data
   */
  transformAttendanceData(apiData) {
    if (!Array.isArray(apiData)) return [];

    const transformedRecords = [];

    apiData.forEach(item => {
      const workDate = item.workDate || item.WorkDate;
      
      // Helper function to create datetime from workDate and time string
      const createDateTime = (timeStr) => {
        if (!timeStr) return null;
        try {
          const date = new Date(workDate);
          if (isNaN(date.getTime())) return null;
          
          // Handle TimeSpan format (HH:mm:ss or HH:mm)
          const timeParts = timeStr.split(':').map(Number);
          if (timeParts.length >= 2) {
            date.setHours(timeParts[0], timeParts[1], timeParts[2] || 0, 0);
            return date.toISOString();
          }
          return null;
        } catch {
          return null;
        }
      };

      // Create check-in record if CheckInTime exists
      const checkInTime = item.checkInTime || item.CheckInTime;
      if (checkInTime) {
        const scanTime = createDateTime(checkInTime);
        if (scanTime) {
          // Determine type based on status
          let type = 'ĐiLam';
          const status = item.status || item.Status;
          const checkInOutType = item.checkInOutType || item.CheckInOutType;
          
          if (status === 'Late' || checkInOutType === 'Late') {
            type = 'Đi trễ';
          }
          
          transformedRecords.push({
            date: workDate,
            scanTime: scanTime,
            type: type,
            shiftName: item.shiftName || item.ShiftName || 'N/A',
            employeeName: item.employeeName || item.EmployeeName || 'N/A',
            employeeCode: item.employeeCode || item.EmployeeCode || '',
            location: item.location || item.Location || 'N/A',
            refCode: item.refCode || item.RefCode || '',
            machineName: item.machineName || item.MachineName || 'N/A',
            workShiftID: item.workShiftID || item.WorkShiftID || null,
            status: status || item.Status || null
          });
        }
      }

      // Create check-out record if CheckOutTime exists
      const checkOutTime = item.checkOutTime || item.CheckOutTime;
      if (checkOutTime) {
        const scanTime = createDateTime(checkOutTime);
        if (scanTime) {
          // Determine type based on status
          let type = 'Về';
          const status = item.status || item.Status;
          const checkInOutType = item.checkInOutType || item.CheckInOutType;
          
          if (status === 'EarlyLeave' || checkInOutType === 'EarlyLeave') {
            type = 'Về sớm';
          }
          
          transformedRecords.push({
            date: workDate,
            scanTime: scanTime,
            type: type,
            shiftName: item.shiftName || item.ShiftName || 'N/A',
            employeeName: item.employeeName || item.EmployeeName || 'N/A',
            employeeCode: item.employeeCode || item.EmployeeCode || '',
            location: item.location || item.Location || 'N/A',
            refCode: item.refCode || item.RefCode || '',
            machineName: item.machineName || item.MachineName || 'N/A',
            workShiftID: item.workShiftID || item.WorkShiftID || null,
            status: status || item.Status || null
          });
        }
      }

      // If no time data, create a fallback record
      if (!checkInTime && !checkOutTime && workDate) {
        transformedRecords.push({
          date: workDate,
          scanTime: workDate,
          type: item.checkInOutType || item.CheckInOutType || item.status || item.Status || 'Đi làm',
          shiftName: item.shiftName || item.ShiftName || 'N/A',
          employeeName: item.employeeName || item.EmployeeName || 'N/A',
          employeeCode: item.employeeCode || item.EmployeeCode || '',
          location: item.location || item.Location || 'N/A',
          refCode: item.refCode || item.RefCode || '',
          machineName: item.machineName || item.MachineName || 'N/A',
          workShiftID: item.workShiftID || item.WorkShiftID || null,
          status: item.status || item.Status || null
        });
      }
    });

    // Sort by date and time
    return transformedRecords.sort((a, b) => {
      try {
        const dateA = new Date(a.scanTime || a.date);
        const dateB = new Date(b.scanTime || b.date);
        if (isNaN(dateA.getTime()) || isNaN(dateB.getTime())) return 0;
        return dateB - dateA; // Descending order (newest first)
      } catch {
        return 0;
      }
    });
  }

  /**
   * Lấy tất cả dữ liệu chấm công
   * @returns {Promise<Array>} Danh sách dữ liệu chấm công
   */
  async getAllAttendanceData() {
    try {
      const response = await this.api.get('/AttendanceData');
      const transformedData = this.transformAttendanceData(response.data || []);
      return transformedData;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Lấy dữ liệu chấm công theo nhân viên
   * @param {string} employeeCode - Mã nhân viên
   * @returns {Promise<Array>} Danh sách dữ liệu chấm công
   */
  async getAttendanceDataByEmployee(employeeCode) {
    try {
      const response = await this.api.get(`/AttendanceData/employee/${employeeCode}`);
      const transformedData = this.transformAttendanceData(response.data || []);
      return transformedData;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Lấy dữ liệu chấm công theo nhân viên và ngày
   * @param {string} employeeCode - Mã nhân viên
   * @param {string} date - Ngày (YYYY-MM-DD)
   * @returns {Promise<Array>} Danh sách dữ liệu chấm công
   */
  async getAttendanceDataByEmployeeAndDate(employeeCode, date) {
    try {
      const response = await this.api.get('/AttendanceData/employee/date', {
        params: {
          employeeCode: employeeCode,
          date: date
        }
      });
      const transformedData = this.transformAttendanceData(response.data || []);
      return transformedData;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Lấy dữ liệu chấm công theo khoảng thời gian
   * @param {string} startDate - Ngày bắt đầu (YYYY-MM-DD)
   * @param {string} endDate - Ngày kết thúc (YYYY-MM-DD)
   * @returns {Promise<Array>} Danh sách dữ liệu chấm công
   */
  async getAttendanceDataByDateRange(startDate, endDate) {
    try {
      const response = await this.api.get('/AttendanceData/daterange', {
        params: {
          startDate: startDate,
          endDate: endDate
        }
      });
      const transformedData = this.transformAttendanceData(response.data || []);
      return transformedData;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Lấy dữ liệu chấm công theo tuần
   * @param {string} week - Tuần (YYYY-WW)
   * @returns {Promise<Array>} Danh sách dữ liệu chấm công
   */
  async getAttendanceDataByWeek(week) {
    try {
      const response = await this.api.get('/AttendanceData/week', {
        params: {
          week: week
        }
      });
      const transformedData = this.transformAttendanceData(response.data || []);
      return transformedData;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Lấy dữ liệu chấm công theo tháng
   * @param {number} year - Năm
   * @param {number} month - Tháng (1-12)
   * @returns {Promise<Array>} Danh sách dữ liệu chấm công
   */
  async getAttendanceDataByMonth(year, month) {
    try {
      const response = await this.api.get('/AttendanceData/month', {
        params: {
          year: year,
          month: month
        }
      });
      const transformedData = this.transformAttendanceData(response.data || []);
      return transformedData;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Test API connection
   * @returns {Promise<boolean>} Connection status
   */
  async testConnection() {
    try {
      await this.api.get('/AttendanceData/debug');
      return true;
    } catch (error) {
      return false;
    }
  }
}

export const attendanceDataService = new AttendanceDataService();