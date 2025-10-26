import axios from 'axios';
import { API_URLS } from '../config/api';

const faceRecognitionService = {
  // Chấm công với nhận dạng khuôn mặt
  async checkIn(checkInData) {
    try {
      console.log('📤 Sending check-in request to:', API_URLS.CHECK_IN);
      console.log('📦 Check-in data:', {
        EmployeeId: checkInData.EmployeeId,
        ImageSize: checkInData.ImageBase64?.length,
        Latitude: checkInData.Latitude,
        Longitude: checkInData.Longitude,
        Location: checkInData.Location,
        CheckInDateTime: checkInData.CheckInDateTime
      });
      
      // Thử endpoint chính trước
      let response;
      try {
        response = await axios.post(API_URLS.CHECK_IN, checkInData);
        console.log('📥 Check-in response:', response.data);
        return response.data;
      } catch (firstError) {
        if (firstError.response?.status === 404) {
          console.log('🔄 Endpoint /checkin not found, trying /check-in...');
          response = await axios.post(API_URLS.CHECK_IN_ALT, checkInData);
          console.log('📥 Check-in response (alt):', response.data);
          return response.data;
        }
        throw firstError;
      }
    } catch (error) {
      console.error('Check-in error:', error);
      
      if (error.response) {
        console.error('Response status:', error.response.status);
        console.error('Response data:', error.response.data);
        console.error('Response headers:', error.response.headers);
      } else if (error.request) {
        console.error('Request error:', error.request);
      } else {
        console.error('Error message:', error.message);
      }
      
      throw error;
    }
  },

  // Đăng ký khuôn mặt
  async registerFace(employeeId, imageBase64) {
    try {
      // Kiểm tra kích thước ảnh
      const imageSize = imageBase64.length;
      console.log(`📏 Face registration image size: ${imageSize} characters (${Math.round(imageSize/1024)}KB)`);
      
      if (imageSize > 50000) { // > 50KB
        throw new Error(`Image too large: ${imageSize} characters. Max allowed: 50KB`);
      }
      
      const response = await axios.post(API_URLS.REGISTER_FACE, {
        employeeId,
        imageBase64
      });
      return response.data;
    } catch (error) {
      console.error('Face registration error:', error);
      throw error;
    }
  },

  // Phát hiện khuôn mặt
  async detectFace(imageBase64) {
    try {
      // Kiểm tra kích thước ảnh
      const imageSize = imageBase64.length;
      console.log(`📏 Face detection image size: ${imageSize} characters (${Math.round(imageSize/1024)}KB)`);
      
      if (imageSize > 50000) { // > 50KB
        throw new Error(`Image too large: ${imageSize} characters. Max allowed: 50KB`);
      }
      
      const response = await axios.post(API_URLS.DETECT_FACE, {
        imageBase64
      });
      return response.data;
    } catch (error) {
      console.error('Face detection error:', error);
      throw error;
    }
  },

  // Nhận dạng khuôn mặt
  async recognizeFace(imageBase64) {
    try {
      const response = await axios.post(API_URLS.RECOGNIZE_FACE, {
        imageBase64
      });
      return response.data;
    } catch (error) {
      console.error('Face recognition error:', error);
      throw error;
    }
  }
};

export default faceRecognitionService;