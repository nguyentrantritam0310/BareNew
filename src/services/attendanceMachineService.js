import api from '../api';

export const getAttendanceMachines = async () => {
  try {
    const response = await api.get('/AttendanceMachine');
    return response.data;
  } catch (error) {
    console.error('Error fetching attendance machines:', error);
    throw error;
  }
};