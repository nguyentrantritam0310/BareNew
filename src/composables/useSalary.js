import { useState, useEffect } from 'react';
import { salaryService } from '../services/salaryService';

export const useSalary = () => {
  const [salaryData, setSalaryData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);

  const fetchPersonalSalaryData = async (year = selectedYear, month = selectedMonth) => {
    try {
      setLoading(true);
      setError(null);

      const data = await salaryService.getPersonalSalaryData(year, month);
      
      // Validate data structure
      if (data && typeof data === 'object') {
        setSalaryData(data);
      } else {
        setSalaryData(null);
      }
    } catch (err) {
      console.error("Error fetching personal salary data:", JSON.stringify(err, null, 2));
      setError(err.message || 'Không thể tải dữ liệu lương');
      setSalaryData(null);
    } finally {
      setLoading(false);
    }
  };

  const refreshSalaryData = async () => {
    await fetchPersonalSalaryData(selectedYear, selectedMonth);
  };

  const clearError = () => setError(null);

  // Navigation methods
  const goToPreviousMonth = () => {
    if (selectedMonth === 1) {
      setSelectedMonth(12);
      setSelectedYear(selectedYear - 1);
    } else {
      setSelectedMonth(selectedMonth - 1);
    }
  };

  const goToNextMonth = () => {
    if (selectedMonth === 12) {
      setSelectedMonth(1);
      setSelectedYear(selectedYear + 1);
    } else {
      setSelectedMonth(selectedMonth + 1);
    }
  };

  const goToCurrentMonth = () => {
    const now = new Date();
    setSelectedMonth(now.getMonth() + 1);
    setSelectedYear(now.getFullYear());
  };

  // Format money helper
  const formatMoney = (value) => {
    if (value === null || value === undefined) return '0 ₫';
    return value.toLocaleString('vi-VN', { style: 'currency', currency: 'VND' });
  };

  useEffect(() => {
    fetchPersonalSalaryData();
  }, [selectedYear, selectedMonth]);

  return {
    salaryData,
    loading,
    error,
    selectedYear,
    selectedMonth,
    fetchPersonalSalaryData,
    refreshSalaryData,
    clearError,
    goToPreviousMonth,
    goToNextMonth,
    goToCurrentMonth,
    formatMoney,
  };
};
