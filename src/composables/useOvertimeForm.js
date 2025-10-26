import { useState, useEffect } from 'react';
import { getOvertimeForms } from '../services/overtimeFormService';

export const useOvertimeForm = () => {
  const [overtimeForms, setOvertimeForms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchOvertimeForms = async () => {
    try {
      setLoading(true);
      const data = await getOvertimeForms();
      setOvertimeForms(data);
    } catch (err) {
      console.error("Error fetching overtime forms:", JSON.stringify(err, null, 2));
      setError(err.message || 'Không thể tải danh sách hình thức tăng ca');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOvertimeForms();
  }, []);

  return { overtimeForms, loading, error, fetchOvertimeForms };
};
