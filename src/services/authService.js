import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_CONFIG } from '../config/api';

class AuthService {
  constructor() {
    this.api = axios.create({
      baseURL: `${API_CONFIG.BASE_URL}/api/auth`,
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
              const response = await this.api.post('/refresh-token', {
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
            await this.logout();
          }
        }
        return Promise.reject(error);
      }
    );
  }

  /**
   * Đăng nhập
   * @param {string} email - Email
   * @param {string} password - Mật khẩu
   * @returns {Promise<Object>} Kết quả đăng nhập
   */
  async login(email, password) {
    try {
      console.log('Bắt đầu đăng nhập...');
      console.log('API Base URL:', this.api.defaults.baseURL);
      console.log('Full URL:', `${this.api.defaults.baseURL}/login`);
      
      const response = await this.api.post('/login', { 
        email, 
        password 
      });

      console.log('Login response:', response.data);
      
      // Handle both PascalCase and camelCase response formats
      const responseData = response.data;
      const token = responseData.Token || responseData.token;
      const refreshToken = responseData.RefreshToken || responseData.refreshToken;
      const message = responseData.Message || responseData.message;
      const requiresPasswordChange = responseData.RequiresPasswordChange || responseData.requiresPasswordChange;

      console.log('Extracted values:', { token, refreshToken, message, requiresPasswordChange });

      // Kiểm tra token có tồn tại không
      if (!token) {
        throw new Error('Không nhận được token từ server');
      }

      // Lưu token vào AsyncStorage
      await AsyncStorage.setItem('token', token);
      if (refreshToken) {
        await AsyncStorage.setItem('refreshToken', refreshToken);
      }

      // Lấy thông tin user từ token
      const user = this.getUserFromToken(token);

      return {
        success: true,
        message: message || 'Đăng nhập thành công',
        user,
        requiresPasswordChange: requiresPasswordChange || false
      };
    } catch (error) {
      console.error('Lỗi đăng nhập:', error);
      return {
        success: false,
        message: error.response?.data?.Message || error.response?.data?.message || 'Đăng nhập thất bại'
      };
    }
  }

  /**
   * Đăng ký
   * @param {Object} userData - Dữ liệu người dùng
   * @returns {Promise<Object>} Kết quả đăng ký
   */
  async register(userData) {
    try {
      console.log('Bắt đầu đăng ký...');
      
      const response = await this.api.post('/register', userData);
      
      return {
        success: true,
        message: response.data.Message || response.data.message || 'Đăng ký thành công'
      };
    } catch (error) {
      console.error('Lỗi đăng ký:', error);
      return {
        success: false,
        message: error.response?.data?.Message || error.response?.data?.message || 'Đăng ký thất bại'
      };
    }
  }

  /**
   * Đăng xuất
   * @returns {Promise<void>}
   */
  async logout() {
    try {
      // Gọi API logout nếu cần
      // await this.api.post('/logout');
      
      // Xóa token khỏi AsyncStorage
      await AsyncStorage.removeItem('token');
      await AsyncStorage.removeItem('refreshToken');
      await AsyncStorage.removeItem('user');
      
      console.log('Đăng xuất thành công');
    } catch (error) {
      console.error('Lỗi đăng xuất:', error);
    }
  }

  /**
   * Lấy thông tin user từ token
   * @param {string} token - JWT token
   * @returns {Object|null} Thông tin user
   */
  getUserFromToken(token) {
    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split('')
          .map(function (c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
          })
          .join('')
      );

      const data = JSON.parse(jsonPayload);
      console.log('Token data:', data);

      // Try different role claim keys
      const role = data['http://schemas.microsoft.com/ws/2008/06/identity/claims/role'] ||
        data['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/role'] ||
        data['role'] ||
        data['Role'] ||
        'User';

      return {
        id: data['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier'],
        email: data['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress'],
        fullName: data['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name'],
        role: role
      };
    } catch (error) {
      console.error('Error decoding token:', error);
      return null;
    }
  }

  /**
   * Kiểm tra xem user đã đăng nhập chưa
   * @returns {Promise<Object|null>} Thông tin user hoặc null
   */
  async getCurrentUser() {
    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) return null;

      const user = this.getUserFromToken(token);
      if (user) {
        await AsyncStorage.setItem('user', JSON.stringify(user));
      }
      return user;
    } catch (error) {
      console.error('Lỗi lấy thông tin user:', error);
      return null;
    }
  }

  /**
   * Kiểm tra xem có token hợp lệ không
   * @returns {Promise<boolean>}
   */
  async isAuthenticated() {
    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) return false;

      // Kiểm tra token có hết hạn không
      const user = this.getUserFromToken(token);
      return !!user;
    } catch (error) {
      console.error('Lỗi kiểm tra authentication:', error);
      return false;
    }
  }

  /**
   * Đổi mật khẩu
   * @param {string} currentPassword - Mật khẩu hiện tại
   * @param {string} newPassword - Mật khẩu mới
   * @returns {Promise<Object>} Kết quả đổi mật khẩu
   */
  async changePassword(currentPassword, newPassword) {
    try {
      console.log('Bắt đầu đổi mật khẩu...');
      
      const response = await this.api.post('/change-password', {
        currentPassword,
        newPassword
      });
      
      return {
        success: true,
        message: response.data.Message || response.data.message || 'Đổi mật khẩu thành công'
      };
    } catch (error) {
      console.error('Lỗi đổi mật khẩu:', error);
      return {
        success: false,
        message: error.response?.data?.Message || error.response?.data?.message || 'Đổi mật khẩu thất bại'
      };
    }
  }

  /**
   * Quên mật khẩu
   * @param {string} email - Email
   * @returns {Promise<Object>} Kết quả quên mật khẩu
   */
  async forgotPassword(email) {
    try {
      console.log('Bắt đầu quên mật khẩu...');
      
      const response = await this.api.post('/forgot-password', { email });
      
      return {
        success: true,
        message: response.data.Message || response.data.message || 'Email khôi phục đã được gửi'
      };
    } catch (error) {
      console.error('Lỗi quên mật khẩu:', error);
      return {
        success: false,
        message: error.response?.data?.Message || error.response?.data?.message || 'Gửi email khôi phục thất bại'
      };
    }
  }
}

export default new AuthService();

