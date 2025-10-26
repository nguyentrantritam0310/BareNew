import { useState, useEffect } from 'react';
import { getOvertimeTypes } from '../services/overtimeTypeService';

export const useOvertimeType = () => {
  const [overtimeTypes, setOvertimeTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchOvertimeTypes = async () => {
    try {
      setLoading(true);
      const data = await getOvertimeTypes();
      setOvertimeTypes(data);
    } catch (err) {
      console.error("Error fetching overtime types:", JSON.stringify(err, null, 2));
      setError(err.message || 'Không thể tải danh sách loại tăng ca');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOvertimeTypes();
  }, []);

  return { overtimeTypes, loading, error, fetchOvertimeTypes };
};
