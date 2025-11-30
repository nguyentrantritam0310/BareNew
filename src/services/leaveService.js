import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_CONFIG } from '../config/api';

class LeaveService {
  constructor() {
    this.api = axios.create({
      baseURL: `${API_CONFIG.BASE_URL}/api`,
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

    // Xử lý refresh token
    this.api.interceptors.response.use(
      response => response,
      async error => {
        const originalRequest = error.config;
        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true;
          try {
            const token = await AsyncStorage.getItem('token');
            const refreshToken = await AsyncStorage.getItem('refreshToken');
            
            if (token && refreshToken) {
              const response = await axios.post(`${API_CONFIG.BASE_URL}/api/auth/refresh-token`, {
                Token: token,
                RefreshToken: refreshToken
              });
              
              const { Token: newToken, RefreshToken: newRefreshToken } = response.data;
              
              if (newToken) {
                await AsyncStorage.setItem('token', newToken);
                originalRequest.headers.Authorization = `Bearer ${newToken}`;
              }
              
              if (newRefreshToken) {
                await AsyncStorage.setItem('refreshToken', newRefreshToken);
              }
              
              return this.api(originalRequest);
            }
          } catch (refreshError) {
            // Logout user if refresh fails
            await AsyncStorage.removeItem('token');
            await AsyncStorage.removeItem('refreshToken');
            await AsyncStorage.removeItem('user');
          }
        }
        return Promise.reject(error);
      }
    );
  }

  /**
   * Lấy danh sách tất cả đơn nghỉ phép
   * @returns {Promise<Array>} Danh sách đơn nghỉ phép
   */
  async getAllLeaveRequests() {
    try {
      console.log('Fetching leave requests...');
      const response = await this.api.get('/EmployeeRequest/leave');
      console.log('Leave requests response:', response.data);
      return response.data;
    } catch (error) {
      console.error('Error fetching leave requests:', error);
      throw error;
    }
  }

  /**
   * Lấy đơn nghỉ phép theo mã phiếu
   * @param {string} voucherCode - Mã phiếu
   * @returns {Promise<Object>} Thông tin đơn nghỉ phép
   */
  async getLeaveRequestById(voucherCode) {
    try {
      console.log('Fetching leave request by ID:', voucherCode);
      const response = await this.api.get(`/EmployeeRequest/leave/${voucherCode}`);
      console.log('Leave request response:', response.data);
      return response.data;
    } catch (error) {
      console.error('Error fetching leave request:', error);
      throw error;
    }
  }

  /**
   * Tạo đơn nghỉ phép mới
   * @param {Object} leaveRequestData - Dữ liệu đơn nghỉ phép
   * @returns {Promise<Object>} Kết quả tạo đơn nghỉ phép
   */
  async createLeaveRequest(leaveRequestData) {
    try {
      console.log('Creating leave request:', leaveRequestData);
      const response = await this.api.post('/EmployeeRequest/leave', leaveRequestData);
      console.log('Create leave request response:', response.data);
      return response.data;
    } catch (error) {
      console.error('Error creating leave request:', error);
      throw error;
    }
  }

  /**
   * Cập nhật đơn nghỉ phép
   * @param {string} voucherCode - Mã phiếu
   * @param {Object} leaveRequestData - Dữ liệu cập nhật
   * @returns {Promise<Object>} Kết quả cập nhật
   */
  async updateLeaveRequest(voucherCode, leaveRequestData) {
    try {
      console.log('Updating leave request:', voucherCode, leaveRequestData);
      const response = await this.api.put(`/EmployeeRequest/leave/${voucherCode}`, leaveRequestData);
      console.log('Update leave request response:', response.data);
      return response.data;
    } catch (error) {
      console.error('Error updating leave request:', error);
      throw error;
    }
  }

  /**
   * Xóa đơn nghỉ phép
   * @param {string} voucherCode - Mã phiếu
   * @returns {Promise<Object>} Kết quả xóa
   */
  async deleteLeaveRequest(voucherCode) {
    try {
      console.log('Deleting leave request:', voucherCode);
      const response = await this.api.delete(`/EmployeeRequest/leave/${voucherCode}`);
      console.log('Delete leave request response:', response.data);
      return response.data;
    } catch (error) {
      console.error('Error deleting leave request:', error);
      throw error;
    }
  }

  /**
   * Gửi đơn nghỉ phép để duyệt
   * @param {string} voucherCode - Mã phiếu
   * @param {string} notes - Ghi chú
   * @returns {Promise<Object>} Kết quả gửi duyệt
   */
  async submitForApproval(voucherCode, notes) {
    try {
      console.log('Submitting leave request for approval:', voucherCode, 'with notes:', notes);
      const response = await this.api.put(`/EmployeeRequest/leave/${voucherCode}/submit`, {
        notes: notes || null
      });
      console.log('Submit for approval response:', response.data);
      return response.data;
    } catch (error) {
      console.error('Error submitting for approval:', error);
      throw error;
    }
  }

  /**
   * Duyệt đơn nghỉ phép
   * @param {string} voucherCode - Mã phiếu
   * @param {string} action - Hành động (approve, reject, return)
   * @param {string} notes - Ghi chú
   * @returns {Promise<Object>} Kết quả duyệt
   */
  async approveLeaveRequest(voucherCode, action, notes) {
    try {
      console.log('Approving leave request:', voucherCode, 'with action:', action, 'and notes:', notes);
      
      let endpoint;
      switch (action) {
        case 'approve':
          endpoint = `/EmployeeRequest/leave/${voucherCode}/approve`;
          break;
        case 'reject':
          endpoint = `/EmployeeRequest/leave/${voucherCode}/reject`;
          break;
        case 'return':
          endpoint = `/EmployeeRequest/leave/${voucherCode}/return`;
          break;
        default:
          throw new Error('Invalid approval action');
      }

      const response = await this.api.put(endpoint, {
        notes: notes || null
      });
      console.log('Approve leave request response:', response.data);
      return response.data;
    } catch (error) {
      console.error('Error approving leave request:', error);
      throw error;
    }
  }
}

export default new LeaveService();
