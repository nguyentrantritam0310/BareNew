import React, { createContext, useContext, useReducer, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import authService from '../services/authService';

// Initial state
const initialState = {
  user: null,
  isAuthenticated: false,
  isLoading: true,
  error: null,
};

// Action types
const AUTH_ACTIONS = {
  LOGIN_START: 'LOGIN_START',
  LOGIN_SUCCESS: 'LOGIN_SUCCESS',
  LOGIN_FAILURE: 'LOGIN_FAILURE',
  LOGOUT: 'LOGOUT',
  SET_LOADING: 'SET_LOADING',
  SET_ERROR: 'SET_ERROR',
  CLEAR_ERROR: 'CLEAR_ERROR',
  SET_USER: 'SET_USER',
};

// Reducer
const authReducer = (state, action) => {
  switch (action.type) {
    case AUTH_ACTIONS.LOGIN_START:
      return {
        ...state,
        isLoading: true,
        error: null,
      };
    case AUTH_ACTIONS.LOGIN_SUCCESS:
      return {
        ...state,
        user: action.payload.user,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      };
    case AUTH_ACTIONS.LOGIN_FAILURE:
      return {
        ...state,
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: action.payload.error,
      };
    case AUTH_ACTIONS.LOGOUT:
      return {
        ...state,
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
      };
    case AUTH_ACTIONS.SET_LOADING:
      return {
        ...state,
        isLoading: action.payload,
      };
    case AUTH_ACTIONS.SET_ERROR:
      return {
        ...state,
        error: action.payload,
        isLoading: false,
      };
    case AUTH_ACTIONS.CLEAR_ERROR:
      return {
        ...state,
        error: null,
      };
    case AUTH_ACTIONS.SET_USER:
      return {
        ...state,
        user: action.payload,
        isAuthenticated: !!action.payload,
        isLoading: false,
      };
    default:
      return state;
  }
};

// Create context
const AuthContext = createContext();

// AuthProvider component
export const AuthProvider = ({ children }) => {
  const [state, dispatch] = useReducer(authReducer, initialState);

  // Check if user is logged in on app start
  useEffect(() => {
    checkAuthState();
  }, []);

  const checkAuthState = async () => {
    try {
      dispatch({ type: AUTH_ACTIONS.SET_LOADING, payload: true });
      
      const user = await authService.getCurrentUser();
      
      if (user) {
        dispatch({ type: AUTH_ACTIONS.SET_USER, payload: user });
      } else {
        dispatch({ type: AUTH_ACTIONS.SET_USER, payload: null });
      }
    } catch (error) {
      console.error('Error checking auth state:', error);
      dispatch({ type: AUTH_ACTIONS.SET_USER, payload: null });
    }
  };

  const login = async (email, password) => {
    try {
      dispatch({ type: AUTH_ACTIONS.LOGIN_START });
      
      const result = await authService.login(email, password);
      
      if (result.success) {
        dispatch({ 
          type: AUTH_ACTIONS.LOGIN_SUCCESS, 
          payload: { user: result.user } 
        });
        return result;
      } else {
        dispatch({ 
          type: AUTH_ACTIONS.LOGIN_FAILURE, 
          payload: { error: result.message } 
        });
        return result;
      }
    } catch (error) {
      const errorMessage = 'Đăng nhập thất bại';
      dispatch({ 
        type: AUTH_ACTIONS.LOGIN_FAILURE, 
        payload: { error: errorMessage } 
      });
      return { success: false, message: errorMessage };
    }
  };

  const register = async (userData) => {
    try {
      dispatch({ type: AUTH_ACTIONS.SET_LOADING, payload: true });
      
      const result = await authService.register(userData);
      
      if (!result.success) {
        dispatch({ 
          type: AUTH_ACTIONS.SET_ERROR, 
          payload: result.message 
        });
      }
      
      return result;
    } catch (error) {
      const errorMessage = 'Đăng ký thất bại';
      dispatch({ 
        type: AUTH_ACTIONS.SET_ERROR, 
        payload: errorMessage 
      });
      return { success: false, message: errorMessage };
    } finally {
      dispatch({ type: AUTH_ACTIONS.SET_LOADING, payload: false });
    }
  };

  const logout = async () => {
    try {
      await authService.logout();
      dispatch({ type: AUTH_ACTIONS.LOGOUT });
    } catch (error) {
      console.error('Error during logout:', error);
      dispatch({ type: AUTH_ACTIONS.LOGOUT });
    }
  };

  const clearError = () => {
    dispatch({ type: AUTH_ACTIONS.CLEAR_ERROR });
  };

  const changePassword = async (currentPassword, newPassword) => {
    try {
      dispatch({ type: AUTH_ACTIONS.SET_LOADING, payload: true });
      
      const result = await authService.changePassword(currentPassword, newPassword);
      
      if (!result.success) {
        dispatch({ 
          type: AUTH_ACTIONS.SET_ERROR, 
          payload: result.message 
        });
      }
      
      return result;
    } catch (error) {
      const errorMessage = 'Đổi mật khẩu thất bại';
      dispatch({ 
        type: AUTH_ACTIONS.SET_ERROR, 
        payload: errorMessage 
      });
      return { success: false, message: errorMessage };
    } finally {
      dispatch({ type: AUTH_ACTIONS.SET_LOADING, payload: false });
    }
  };

  const forgotPassword = async (email) => {
    try {
      dispatch({ type: AUTH_ACTIONS.SET_LOADING, payload: true });
      
      const result = await authService.forgotPassword(email);
      
      if (!result.success) {
        dispatch({ 
          type: AUTH_ACTIONS.SET_ERROR, 
          payload: result.message 
        });
      }
      
      return result;
    } catch (error) {
      const errorMessage = 'Gửi email khôi phục thất bại';
      dispatch({ 
        type: AUTH_ACTIONS.SET_ERROR, 
        payload: errorMessage 
      });
      return { success: false, message: errorMessage };
    } finally {
      dispatch({ type: AUTH_ACTIONS.SET_LOADING, payload: false });
    }
  };

  // Helper functions for role checking
  const isDirector = () => {
    const role = state.user?.role;
    return role === 'director' || role === 'DIRECTOR' || role === '3';
  };

  const isHRManager = () => {
    const role = state.user?.role;
    return role === 'hr_manager' || role === 'HR_MANAGER' || role === '5';
  };

  const isHREmployee = () => {
    const role = state.user?.role;
    return role === 'hr_employee' || role === 'HR_EMPLOYEE' || role === '6';
  };

  const isHRStaff = () => {
    return isHRManager() || isHREmployee();
  };

  const canManageAll = () => {
    return isHRStaff();
  };

  const canViewAll = () => {
    return isDirector() || isHRStaff();
  };

  const canEdit = () => {
    return isHRStaff() || !canViewAll();
  };

  const value = {
    ...state,
    login,
    register,
    logout,
    clearError,
    changePassword,
    forgotPassword,
    checkAuthState,
    // Role checking functions
    isDirector,
    isHRManager,
    isHREmployee,
    isHRStaff,
    canManageAll,
    canViewAll,
    canEdit,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

// Custom hook to use auth context
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;

