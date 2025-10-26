import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_CONFIG } from '../config/api';
import { mockAttendanceData } from '../data/mockData';

class AttendanceDataService {
  constructor() {
    this.api = axios.create({
      baseURL: `${API_CONFIG.BASE_URL}${API_CONFIG.API_PATH}`,
      timeout: API_CONFIG.TIMEOUT,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Thêm interceptor để tự động thêm token vào header
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

    // Xử lý response errors
    this.api.interceptors.response.use(
      (response) => response,
      async (error) => {
        if (error.response?.status === 401) {
          // Token expired, clear storage and redirect to login
          await AsyncStorage.removeItem('token');
          await AsyncStorage.removeItem('user');
        }
        return Promise.reject(error);
      }
    );
  }

  /**
   * Check if API is available
   * @returns {Promise<boolean>} API availability status
   */
  async isAPIAvailable() {
    try {
      await this.api.get('/');
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Lấy tất cả dữ liệu chấm công
   * @returns {Promise<Array>} Danh sách dữ liệu chấm công
   */
  async getAllAttendanceData() {
    try {
      console.log('Fetching all attendance data...');
      
      // Check if API is available
      const isAPI = await this.isAPIAvailable();
      if (!isAPI) {
        console.log('API not available, using mock data');
        return mockAttendanceData;
      }
      
      const response = await this.api.get('/attendance');
      console.log('Attendance data response:', response.data);
      return response.data || [];
    } catch (error) {
      console.error('Error fetching attendance data:', error);
      
      // If API fails, return mock data as fallback
      if (error.response?.status === 404) {
        console.log('API endpoint not found, using mock data');
        return mockAttendanceData;
      }
      
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
      console.log('Fetching attendance data for employee:', employeeCode);
      const response = await this.api.get(`/attendance/employee/${employeeCode}`);
      console.log('Employee attendance response:', response.data);
      return response.data || [];
    } catch (error) {
      console.error('Error fetching employee attendance:', error);
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
      console.log('Fetching attendance data for employee and date:', employeeCode, date);
      const response = await this.api.get(`/attendance/employee/${employeeCode}/date/${date}`);
      console.log('Employee date attendance response:', response.data);
      return response.data || [];
    } catch (error) {
      console.error('Error fetching employee date attendance:', error);
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
      console.log('Fetching attendance data by date range:', startDate, 'to', endDate);
      const response = await this.api.get(`/attendance/range?startDate=${startDate}&endDate=${endDate}`);
      console.log('Date range attendance response:', response.data);
      return response.data || [];
    } catch (error) {
      console.error('Error fetching date range attendance:', error);
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
      console.log('Fetching attendance data by week:', week);
      const response = await this.api.get(`/attendance/week/${week}`);
      console.log('Week attendance response:', response.data);
      return response.data || [];
    } catch (error) {
      console.error('Error fetching week attendance:', error);
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
      console.log('Fetching attendance data by month:', year, month);
      
      // Check if API is available
      const isAPI = await this.isAPIAvailable();
      if (!isAPI) {
        console.log('API not available, using mock data for month:', year, month);
        // Filter mock data by month (assuming current month for demo)
        const currentDate = new Date();
        const currentYear = currentDate.getFullYear();
        const currentMonth = currentDate.getMonth() + 1;
        
        if (year === currentYear && month === currentMonth) {
          return mockAttendanceData;
        } else {
          // Return empty array for other months
          return [];
        }
      }
      
      const response = await this.api.get(`/attendance/month/${year}/${month}`);
      console.log('Month attendance response:', response.data);
      return response.data || [];
    } catch (error) {
      console.error('Error fetching month attendance:', error);
      
      // If API fails, return mock data as fallback
      if (error.response?.status === 404) {
        console.log('API endpoint not found, using mock data for month:', year, month);
        const currentDate = new Date();
        const currentYear = currentDate.getFullYear();
        const currentMonth = currentDate.getMonth() + 1;
        
        if (year === currentYear && month === currentMonth) {
          return mockAttendanceData;
        } else {
          return [];
        }
      }
      
      throw error;
    }
  }

  /**
   * Tạo dữ liệu chấm công mới
   * @param {Object} attendanceData - Dữ liệu chấm công
   * @returns {Promise<Object>} Kết quả tạo
   */
  async createAttendanceData(attendanceData) {
    try {
      console.log('Creating attendance data:', attendanceData);
      const response = await this.api.post('/attendance', attendanceData);
      console.log('Create attendance response:', response.data);
      return response.data;
    } catch (error) {
      console.error('Error creating attendance data:', error);
      throw error;
    }
  }

  /**
   * Cập nhật dữ liệu chấm công
   * @param {string} id - ID dữ liệu chấm công
   * @param {Object} attendanceData - Dữ liệu chấm công
   * @returns {Promise<Object>} Kết quả cập nhật
   */
  async updateAttendanceData(id, attendanceData) {
    try {
      console.log('Updating attendance data:', id, attendanceData);
      const response = await this.api.put(`/attendance/${id}`, attendanceData);
      console.log('Update attendance response:', response.data);
      return response.data;
    } catch (error) {
      console.error('Error updating attendance data:', error);
      throw error;
    }
  }

  /**
   * Xóa dữ liệu chấm công
   * @param {string} id - ID dữ liệu chấm công
   * @returns {Promise<Object>} Kết quả xóa
   */
  async deleteAttendanceData(id) {
    try {
      console.log('Deleting attendance data:', id);
      const response = await this.api.delete(`/attendance/${id}`);
      console.log('Delete attendance response:', response.data);
      return response.data;
    } catch (error) {
      console.error('Error deleting attendance data:', error);
      throw error;
    }
  }

  /**
   * Test API connection
   * @returns {Promise<boolean>} Connection status
   */
  async testConnection() {
    try {
      console.log('Testing API connection...');
      // Try a simple GET request to a basic endpoint
      const response = await this.api.get('/');
      console.log('API connection test successful:', response.status);
      return true;
    } catch (error) {
      console.error('API connection test failed:', error);
      // If the basic endpoint fails, try the attendance endpoint
      try {
        const response = await this.api.get('/attendance');
        console.log('API connection test successful (attendance endpoint):', response.status);
        return true;
      } catch (attendanceError) {
        console.error('Attendance endpoint also failed:', attendanceError);
        return false;
      }
    }
  }
}

export const attendanceDataService = new AttendanceDataService();