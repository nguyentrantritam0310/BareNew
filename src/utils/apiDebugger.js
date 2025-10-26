import axios from 'axios';
import { API_CONFIG } from '../config/api';

class APIDebugger {
  constructor() {
    this.api = axios.create({
      baseURL: `${API_CONFIG.BASE_URL}/api`,
      timeout: API_CONFIG.TIMEOUT,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Test all possible API endpoints
   */
  async testAllEndpoints() {
    const results = {
      baseUrl: `${API_CONFIG.BASE_URL}/api`,
      timestamp: new Date().toISOString(),
      tests: []
    };

    const endpoints = [
      { path: '/', method: 'GET', description: 'Root endpoint' },
      { path: '/health', method: 'GET', description: 'Health check' },
      { path: '/attendance', method: 'GET', description: 'All attendance data' },
      { path: '/attendance/month/2025/1', method: 'GET', description: 'Monthly attendance' },
      { path: '/employees', method: 'GET', description: 'All employees' },
      { path: '/auth/login', method: 'POST', description: 'Login endpoint' },
    ];

    for (const endpoint of endpoints) {
      try {
        console.log(`Testing ${endpoint.method} ${endpoint.path}...`);
        const response = await this.api.request({
          method: endpoint.method,
          url: endpoint.path,
          data: endpoint.method === 'POST' ? { test: true } : undefined
        });
        
        results.tests.push({
          endpoint: endpoint.path,
          method: endpoint.method,
          description: endpoint.description,
          status: response.status,
          success: true,
          responseSize: JSON.stringify(response.data).length,
          error: null
        });
        
        console.log(`✅ ${endpoint.path}: ${response.status}`);
      } catch (error) {
        results.tests.push({
          endpoint: endpoint.path,
          method: endpoint.method,
          description: endpoint.description,
          status: error.response?.status || 'Network Error',
          success: false,
          responseSize: 0,
          error: error.message
        });
        
        console.log(`❌ ${endpoint.path}: ${error.response?.status || error.message}`);
      }
    }

    return results;
  }

  /**
   * Test server connectivity
   */
  async testConnectivity() {
    try {
      console.log('Testing server connectivity...');
      const response = await axios.get(`${API_CONFIG.BASE_URL}`, {
        timeout: 5000
      });
      
      return {
        success: true,
        status: response.status,
        message: 'Server is reachable',
        responseTime: response.headers['x-response-time'] || 'Unknown'
      };
    } catch (error) {
      return {
        success: false,
        status: error.response?.status || 'Network Error',
        message: error.message,
        responseTime: 'N/A'
      };
    }
  }

  /**
   * Get server information
   */
  async getServerInfo() {
    try {
      const response = await axios.get(`${API_CONFIG.BASE_URL}`, {
        timeout: 5000
      });
      
      return {
        headers: response.headers,
        status: response.status,
        data: response.data
      };
    } catch (error) {
      return {
        error: error.message,
        status: error.response?.status
      };
    }
  }
}

export const apiDebugger = new APIDebugger();
