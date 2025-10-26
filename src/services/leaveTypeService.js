import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_CONFIG } from '../config/api';

class LeaveTypeService {
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
   * Lấy danh sách tất cả loại nghỉ phép
   * @returns {Promise<Array>} Danh sách loại nghỉ phép
   */
  async getAllLeaveTypes() {
    try {
      console.log('Fetching leave types...');
      const response = await this.api.get('/LeaveType');
      console.log('Leave types response:', response.data);
      return response.data;
    } catch (error) {
      console.error('Error fetching leave types:', error);
      throw error;
    }
  }

  /**
   * Lấy loại nghỉ phép theo ID
   * @param {number} id - ID loại nghỉ phép
   * @returns {Promise<Object>} Thông tin loại nghỉ phép
   */
  async getLeaveTypeById(id) {
    try {
      console.log('Fetching leave type by ID:', id);
      const response = await this.api.get(`/LeaveType/${id}`);
      console.log('Leave type response:', response.data);
      return response.data;
    } catch (error) {
      console.error('Error fetching leave type:', error);
      throw error;
    }
  }
}

export default new LeaveTypeService();
