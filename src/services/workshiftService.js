import api from '../api';

export const getWorkShifts = async () => {
  try {
    const response = await api.get('/WorkShift');
    return response.data;
  } catch (error) {
    console.error('Error fetching work shifts:', error);
    throw error;
  }
};