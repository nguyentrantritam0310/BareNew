import { useState, useEffect } from 'react';
import { overtimeRequestService } from '../services/overtimeRequestService';

export const useOvertimeRequest = () => {
  const [overtimeRequests, setOvertimeRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchOvertimeRequests = async () => {
    try {
      setLoading(true);
      const data = await overtimeRequestService.getAll();
      setOvertimeRequests(data);
    } catch (err) {
      console.error("Error fetching overtime requests:", JSON.stringify(err, null, 2));
      setError(err.message || 'Không thể tải danh sách đơn tăng ca');
    } finally {
      setLoading(false);
    }
  };

  const refreshOvertimeRequests = async () => {
    try {
      const data = await overtimeRequestService.getAll();
      setOvertimeRequests(data);
    } catch (err) {
      console.error("Error refreshing overtime requests:", JSON.stringify(err, null, 2));
      setError(err.message || 'Không thể làm mới danh sách');
    }
  };

  const getOvertimeRequestById = async (id) => {
    try {
      const data = await overtimeRequestService.getById(id);
      return data;
    } catch (err) {
      console.error("Error fetching overtime request by id:", JSON.stringify(err, null, 2));
      throw err;
    }
  };

  const createOvertimeRequest = async (data) => {
    try {
      setLoading(true);
      const result = await overtimeRequestService.create(data);
      await fetchOvertimeRequests(); // Refresh the list
      return result;
    } catch (err) {
      console.error("Error creating overtime request:", JSON.stringify(err, null, 2));
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const updateOvertimeRequest = async (id, data) => {
    try {
      setLoading(true);
      const result = await overtimeRequestService.update(id, data);
      await fetchOvertimeRequests(); // Refresh the list
      return result;
    } catch (err) {
      console.error("Error updating overtime request:", JSON.stringify(err, null, 2));
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const deleteOvertimeRequest = async (id) => {
    try {
      setLoading(true);
      const result = await overtimeRequestService.delete(id);
      await fetchOvertimeRequests(); // Refresh the list
      return result;
    } catch (err) {
      console.error("Error deleting overtime request:", JSON.stringify(err, null, 2));
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const clearError = () => {
    setError(null);
  };

  useEffect(() => {
    fetchOvertimeRequests();
  }, []);

  return {
    overtimeRequests,
    loading,
    error,
    fetchOvertimeRequests,
    refreshOvertimeRequests,
    getOvertimeRequestById,
    createOvertimeRequest,
    updateOvertimeRequest,
    deleteOvertimeRequest,
    clearError
  };
};
