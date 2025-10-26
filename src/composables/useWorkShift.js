import { useState, useEffect } from 'react';
import { getWorkShifts } from '../services/workshiftService';

export const useWorkShift = () => {
  const [workShifts, setWorkShifts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchWorkShifts = async () => {
    try {
      setLoading(true);
      const data = await getWorkShifts();
      setWorkShifts(data);
    } catch (err) {
      console.error("Error fetching work shifts:", JSON.stringify(err, null, 2));
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkShifts();
  }, []);

  return { workShifts, loading, error, fetchWorkShifts };
};