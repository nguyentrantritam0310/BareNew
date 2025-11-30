import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View, TouchableOpacity, ActivityIndicator, Alert, Modal } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useSalary } from '../composables/useSalary';
import { useLeaveRequest } from '../composables/useLeaveRequest';
import { useOvertimeRequest } from '../composables/useOvertimeRequest';
import { useWorkShift } from '../composables/useWorkShift';
import { useAuth } from '../contexts/AuthContext';
import api from '../api';
import CustomHeader from '../components/CustomHeader';

export default function PayslipScreen() {
  const { user } = useAuth();
  const {
    salaryData,
    loading,
    error,
    selectedYear,
    selectedMonth,
    refreshSalaryData,
    clearError,
    goToPreviousMonth,
    goToNextMonth,
    goToCurrentMonth,
    formatMoney,
  } = useSalary();

  const { leaveRequests, fetchLeaveRequests } = useLeaveRequest();
  const { overtimeRequests, fetchOvertimeRequests } = useOvertimeRequest();
  const { workShifts, fetchWorkShifts } = useWorkShift();

  const [showOvertimeModal, setShowOvertimeModal] = useState(false);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [leaveDetails, setLeaveDetails] = useState([]);
  const [overtimeDetails, setOvertimeDetails] = useState([]);
  const [shiftAssignments, setShiftAssignments] = useState([]);
  const [contracts, setContracts] = useState([]);

  useEffect(() => {
    if (error) {
      Alert.alert('Lỗi', error, [
        { text: 'Thử lại', onPress: refreshSalaryData },
        { text: 'Hủy', onPress: clearError }
      ]);
    }
  }, [error]);

  // Fetch additional data on mount and when month/year changes
  useEffect(() => {
    const loadData = async () => {
      try {
        await Promise.all([
          fetchLeaveRequests(),
          fetchOvertimeRequests(),
          fetchWorkShifts(),
          fetchShiftAssignments(),
          fetchContracts()
        ]);
        console.log('✅ All data loaded, contracts:', contracts.length);
      } catch (err) {
        console.error('Error loading data:', err);
      }
    };
    loadData();
  }, [selectedYear, selectedMonth]); // Reload when month/year changes

  const fetchShiftAssignments = async () => {
    try {
      const response = await api.get('/ShiftAssignment');
      setShiftAssignments(response.data || []);
    } catch (err) {
      console.error('Error fetching shift assignments:', err);
      setShiftAssignments([]);
    }
  };

  const fetchContracts = async () => {
    try {
      const response = await api.get('/Contract');
      const contractsData = response.data || [];
      setContracts(contractsData);
      console.log('📄 Fetched contracts:', contractsData.length, contractsData);
    } catch (err) {
      console.error('❌ Error fetching contracts:', err);
      setContracts([]);
    }
  };

  // Helper function để kiểm tra hợp đồng không xác định thời hạn
  const isIndeterminateTermContract = (endDate) => {
    if (!endDate || endDate === null || endDate === undefined || endDate === '') {
      return true;
    }
    
    if (typeof endDate === 'string' && (
      endDate.includes('0001-01-01') || 
      endDate.startsWith('0001-')
    )) {
      return true;
    }
    
    try {
      const date = new Date(endDate);
      if (isNaN(date.getTime()) || date.getFullYear() <= 1 || date.getFullYear() < 1900) {
        return true;
      }
    } catch (error) {
      return true;
    }
    
    return false;
  };

  // Helper function để kiểm tra trạng thái duyệt
  const isApproved = (approveStatus) => {
    if (!approveStatus) return false;
    if (typeof approveStatus === 'string') {
      return approveStatus === 'Đã duyệt' || approveStatus === 'Approved';
    }
    if (typeof approveStatus === 'number') {
      return approveStatus === 2;
    }
    return false;
  };

  // Helper function để lấy khoảng thời gian hợp đồng trong tháng
  const getContractPeriodInMonth = (employeeId, year, month) => {
    const monthStartDate = new Date(year, month - 1, 1);
    monthStartDate.setHours(0, 0, 0, 0);
    const monthEndDate = new Date(year, month, 0);
    monthEndDate.setHours(23, 59, 59, 999);
    
    console.log('🔍 getContractPeriodInMonth - Debug:', {
      employeeId,
      year,
      month,
      contractsCount: contracts.length,
      contracts: contracts.map(c => ({
        id: c.id,
        employeeID: c.employeeID,
        employeeIDType: typeof c.employeeID,
        approveStatus: c.approveStatus,
        approveStatusType: typeof c.approveStatus,
        startDate: c.startDate,
        endDate: c.endDate
      }))
    });
    
    // Tìm hợp đồng đã duyệt của nhân viên trong tháng
    const employeeContracts = contracts.filter(contract => {
      const contractEmployeeId = String(contract.employeeID || '');
      const empId = String(employeeId || '');
      
      console.log('  📋 Checking contract:', {
        contractId: contract.id,
        contractEmployeeId,
        empId,
        match: contractEmployeeId === empId,
        approveStatus: contract.approveStatus,
        isApproved: isApproved(contract.approveStatus)
      });
      
      if (contractEmployeeId !== empId) {
        console.log('    ❌ Employee ID mismatch');
        return false;
      }
      
      if (!isApproved(contract.approveStatus)) {
        console.log('    ❌ Not approved:', contract.approveStatus);
        return false;
      }
      
      const contractStartDate = new Date(contract.startDate);
      contractStartDate.setHours(0, 0, 0, 0);
      
      if (contractStartDate > monthEndDate) {
        console.log('    ❌ Contract starts after month end');
        return false;
      }
      
      if (!isIndeterminateTermContract(contract.endDate)) {
        const contractEndDate = new Date(contract.endDate);
        contractEndDate.setHours(23, 59, 59, 999);
        if (contractEndDate < monthStartDate) {
          console.log('    ❌ Contract ends before month start');
          return false;
        }
      }
      
      console.log('    ✅ Contract matches!');
      return true;
    });
    
    console.log('📊 Found contracts:', employeeContracts.length);
    
    if (employeeContracts.length === 0) {
      console.warn('⚠️ No approved contracts found for employee', employeeId, 'in month', month, '/', year);
      // Không có hợp đồng, trả về toàn bộ tháng
      return {
        periodStart: monthStartDate,
        periodEnd: monthEndDate
      };
    }
    
    // Lấy hợp đồng đầu tiên (hoặc có thể xử lý nhiều hợp đồng)
    const contract = employeeContracts[0];
    const contractStartDate = new Date(contract.startDate);
    contractStartDate.setHours(0, 0, 0, 0);
    
    let contractEndDate;
    if (!isIndeterminateTermContract(contract.endDate)) {
      contractEndDate = new Date(contract.endDate);
      contractEndDate.setHours(23, 59, 59, 999);
    } else {
      contractEndDate = monthEndDate;
    }
    
    const periodStart = contractStartDate > monthStartDate ? contractStartDate : monthStartDate;
    const periodEnd = contractEndDate < monthEndDate ? contractEndDate : monthEndDate;
    
    return {
      periodStart,
      periodEnd
    };
  };

  const renderSalaryCard = (title, icon, items) => (
    <View style={styles.salaryCard}>
      <View style={styles.cardHeader}>
        <Icon name={icon} size={20} color="#3498db" />
        <Text style={styles.cardTitle}>{title}</Text>
      </View>
      <View style={styles.cardBody}>
        {items.map((item, index) => (
          <View key={index} style={styles.salaryItem}>
            <Text style={styles.salaryLabel}>{item.label}:</Text>
            {typeof item.value === 'string' ? (
              <Text style={styles.salaryValue}>{item.value}</Text>
            ) : (
              item.value
            )}
          </View>
        ))}
      </View>
    </View>
  );

  const renderFinalSummary = () => {
    const safeData = salaryData || {};
    return (
      <View style={styles.finalSummaryCard}>
        <View style={styles.cardHeader}>
          <Icon name="trophy" size={20} color="white" />
          <Text style={styles.cardTitleWhite}>Tổng kết</Text>
        </View>
        <View style={styles.cardBody}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Tổng thu nhập:</Text>
            <Text style={styles.summaryValueIncome}>{formatMoney(safeData.totalIncome || 0)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Tổng các khoản trừ:</Text>
            <Text style={styles.summaryValueDeduction}>{formatMoney(safeData.totalDeduction || 0)}</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.finalRow}>
            <Text style={styles.summaryLabel}>Thực lãnh:</Text>
            <Text style={styles.summaryValueNet}>{formatMoney(safeData.netSalary || 0)}</Text>
          </View>
        </View>
      </View>
    );
  };

  const openOvertimeModal = async () => {
    setShowOvertimeModal(true);
    
    if (!user?.id) {
      return;
    }

    try {
      await fetchOvertimeRequests();
      await fetchContracts();
      
      const employeeId = String(user.id || '');
      const month = selectedMonth;
      const year = selectedYear;
      
      // Lấy khoảng thời gian hợp đồng trong tháng
      const contractPeriod = getContractPeriodInMonth(employeeId, year, month);
      const periodStartDate = contractPeriod.periodStart;
      const periodEndDate = contractPeriod.periodEnd;
      
      // Lọc đơn tăng ca đã duyệt trong khoảng thời gian hợp đồng
      const approvedOvertimes = overtimeRequests.filter(request => {
        if (!request || !request.startDateTime) return false;
        
        // So sánh employeeID bằng string để đảm bảo khớp
        const requestEmployeeId = String(request.employeeID || '');
        if (requestEmployeeId !== employeeId) return false;
        
        // Kiểm tra trạng thái duyệt
        if (!isApproved(request.approveStatus)) return false;
        
        const start = new Date(request.startDateTime);
        const end = new Date(request.endDateTime);
        
        // Kiểm tra xem đơn tăng ca có nằm trong khoảng thời gian của hợp đồng không
        return start <= periodEndDate && end >= periodStartDate;
      });
      
      // Format dữ liệu để hiển thị - CHỈ tính phần trong khoảng thời gian hợp đồng
      const details = approvedOvertimes.map(request => {
        const start = new Date(request.startDateTime);
        const end = new Date(request.endDateTime);
        
        // Chỉ tính phần thời gian nằm trong khoảng thời gian hợp đồng (giống logic salaryByDays)
        const actualStart = start > periodStartDate ? start : periodStartDate;
        const actualEnd = end < periodEndDate ? end : periodEndDate;
        
        // Nếu không có phần nào nằm trong period, bỏ qua
        if (actualStart > actualEnd) {
          return null;
        }
        
        // Tính số giờ tăng ca (chỉ tính phần trong period)
        const hours = Math.max(0, (actualEnd - actualStart) / (1000 * 60 * 60));
        
        // Format ngày giờ để hiển thị
        const formatDateTime = (date) => {
          const dateStr = date.toLocaleDateString('vi-VN');
          const timeStr = date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
          return `${dateStr} ${timeStr}`;
        };
        
        // Tính số ngày (1 ngày = 8 giờ) - chỉ tính phần trong period
        const hoursPerDay = 8;
        const days = Math.round((hours / hoursPerDay) * 10) / 10;
        
        return {
          voucherCode: request.voucherCode,
          startDate: formatDateTime(start), // Hiển thị thời gian bắt đầu thực tế của đơn
          endDate: formatDateTime(end), // Hiển thị thời gian kết thúc thực tế của đơn
          hours: Math.round(hours * 10) / 10, // Số giờ đã tính theo period
          days: days, // Số ngày đã tính theo period
          coefficient: request.coefficient || 1,
          overtimeTypeName: request.overtimeTypeName || 'Tăng ca',
          notes: request.notes || ''
        };
      }).filter(item => item !== null); // Loại bỏ các item null (không có phần nào trong period)
      
      setOvertimeDetails(details);
    } catch (error) {
      console.error('Error fetching overtime details:', error);
      setOvertimeDetails([]);
    }
  };

  const closeOvertimeModal = () => {
    setShowOvertimeModal(false);
    setOvertimeDetails([]);
  };

  const openLeaveModal = async () => {
    setShowLeaveModal(true);
    
    if (!user?.id) {
      setLeaveDetails([]);
      return;
    }

    try {
      await fetchLeaveRequests();
      await fetchContracts();
      
      const employeeId = String(user.id);
      const month = selectedMonth;
      const year = selectedYear;
      
      // Lấy khoảng thời gian hợp đồng trong tháng
      const contractPeriod = getContractPeriodInMonth(employeeId, year, month);
      const periodStartDate = contractPeriod.periodStart;
      const periodEndDate = contractPeriod.periodEnd;
      
      // Lọc đơn nghỉ phép đã duyệt trong khoảng thời gian hợp đồng
      const approvedLeaves = leaveRequests.filter(request => {
        if (!request || !request.startDateTime) return false;
        
        // So sánh employeeID bằng string để đảm bảo khớp
        const requestEmployeeId = String(request.employeeID || '');
        if (requestEmployeeId !== employeeId) return false;
        
        // Kiểm tra trạng thái duyệt
        if (!isApproved(request.approveStatus)) return false;
        
        // Kiểm tra loại nghỉ phép
        if (!request.leaveTypeName || !request.leaveTypeName.toLowerCase().includes('phép')) return false;
        
        const leaveStartDate = new Date(request.startDateTime);
        const leaveEndDate = new Date(request.endDateTime);
        
        // Kiểm tra xem đơn nghỉ phép có nằm trong khoảng thời gian của hợp đồng không
        return leaveStartDate <= periodEndDate && leaveEndDate >= periodStartDate;
      });
      
      // Tính số giờ nghỉ và quy đổi thành số ngày (chỉ tính phần trong khoảng thời gian hợp đồng - giống logic salaryByDays)
      const details = approvedLeaves.map(request => {
        const startDate = new Date(request.startDateTime);
        const endDate = new Date(request.endDateTime);
        
        // Chỉ tính phần thời gian nằm trong khoảng thời gian hợp đồng (giống logic salaryByDays)
        const actualStart = startDate > periodStartDate ? startDate : periodStartDate;
        const actualEnd = endDate < periodEndDate ? endDate : periodEndDate;
        
        if (actualStart > actualEnd) {
          // Không có phần nào nằm trong period, bỏ qua
          return null;
        }
        
        // Tính tổng số giờ nghỉ (chỉ tính phần trong period) - chỉ để hiển thị
        const totalHoursDiff = (actualEnd - actualStart) / (1000 * 60 * 60);
        
        // Tính số ngày nghỉ phép (đếm số ngày, không tính giờ)
        // Logic này khớp với useSalary.js - chỉ đếm số ngày trong period
        const periodStartDay = new Date(actualStart.getFullYear(), actualStart.getMonth(), actualStart.getDate());
        const periodEndDay = new Date(actualEnd.getFullYear(), actualEnd.getMonth(), actualEnd.getDate());
        
        // Đếm số ngày nghỉ (tương tự useSalary.js)
        const daysDiff = Math.ceil((periodEndDay - periodStartDay) / (1000 * 60 * 60 * 24)) + 1;
        
        // Tính số giờ nghỉ trưa cần trừ (lấy từ shift details trong DB) - chỉ để hiển thị số giờ
        let lunchBreakHours = 0;
        const startDay = new Date(actualStart.getFullYear(), actualStart.getMonth(), actualStart.getDate());
        const endDay = new Date(actualEnd.getFullYear(), actualEnd.getMonth(), actualEnd.getDate());
        
        // Helper function to parse time
        const parseTime = (timeStr) => {
          if (!timeStr || timeStr === '00:00:00') return null;
          const parts = timeStr.split(':');
          return { hour: parseInt(parts[0]), minute: parseInt(parts[1]) || 0 };
        };
        
        // Helper function to get lunch break from DB or use default
        const getLunchBreak = (currentDay) => {
          const dayStr = currentDay.toISOString().split('T')[0];
          const employeeId = String(user.id);
          
          // Find shift assignment for this day
          const shiftAssignment = shiftAssignments.find(sa => {
            const saDate = new Date(sa.workDate).toISOString().split('T')[0];
            return String(sa.employeeID) === employeeId && saDate === dayStr;
          });
          
          if (shiftAssignment && shiftAssignment.workShiftID) {
            // Find shift details from workShiftID
            const workShift = workShifts.find(ws => ws.id === shiftAssignment.workShiftID);
            
            if (workShift && workShift.shiftDetails) {
              // Get dayOfWeek from current day (0 = Sunday, 1 = Monday, ...)
              const dayOfWeek = currentDay.getDay();
              const dayNames = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];
              const dayName = dayNames[dayOfWeek];
              
              // Find shift detail for this day
              const shiftDetail = workShift.shiftDetails.find(sd => sd.dayOfWeek === dayName);
              
              if (shiftDetail && shiftDetail.breakStart && shiftDetail.breakEnd) {
                const breakStart = parseTime(shiftDetail.breakStart);
                const breakEnd = parseTime(shiftDetail.breakEnd);
                
                if (breakStart && breakEnd) {
                  return {
                    start: breakStart.hour + breakStart.minute / 60,
                    end: breakEnd.hour + breakEnd.minute / 60,
                    duration: (breakEnd.hour + breakEnd.minute / 60) - (breakStart.hour + breakStart.minute / 60)
                  };
                }
              }
            }
          }
          
          // Fallback: default lunch break 12:00-13:00
          return {
            start: 12,
            end: 13,
            duration: 1
          };
        };
        
        // Iterate through each day in the leave period to subtract lunch break hours (chỉ để tính số giờ hiển thị)
        for (let d = new Date(startDay); d <= endDay; d.setDate(d.getDate() + 1)) {
          const currentDay = new Date(d);
          const isFirstDay = currentDay.getTime() === startDay.getTime();
          const isLastDay = currentDay.getTime() === endDay.getTime();
          
          // Get lunch break (from DB or default)
          const lunchBreak = getLunchBreak(currentDay);
          
          // Determine leave time in the day
          let dayStartDecimal, dayEndDecimal;
          
          if (isFirstDay && isLastDay) {
            // Cùng ngày: dùng thời gian thực tế trong period
            dayStartDecimal = actualStart.getHours() + actualStart.getMinutes() / 60;
            dayEndDecimal = actualEnd.getHours() + actualEnd.getMinutes() / 60;
          } else if (isFirstDay) {
            // Ngày đầu: từ giờ bắt đầu nghỉ trong period đến cuối ca (17:00 hoặc từ shift detail)
            dayStartDecimal = actualStart.getHours() + actualStart.getMinutes() / 60;
            dayEndDecimal = 17; // Mặc định, có thể lấy từ shift detail nếu cần
          } else if (isLastDay) {
            // Ngày cuối: từ đầu ca (8:00 hoặc từ shift detail) đến giờ kết thúc nghỉ trong period
            dayStartDecimal = 8; // Mặc định, có thể lấy từ shift detail nếu cần
            dayEndDecimal = actualEnd.getHours() + actualEnd.getMinutes() / 60;
          } else {
            // Middle days: subtract entire lunch break
            lunchBreakHours += lunchBreak.duration;
            continue;
          }
          
          // Calculate overlap with lunch break
          if (dayStartDecimal < lunchBreak.end && dayEndDecimal > lunchBreak.start) {
            const overlapStart = Math.max(dayStartDecimal, lunchBreak.start);
            const overlapEnd = Math.min(dayEndDecimal, lunchBreak.end);
            if (overlapEnd > overlapStart) {
              lunchBreakHours += (overlapEnd - overlapStart);
            }
          }
        }
        
        // Số giờ nghỉ thực tế = tổng giờ - giờ nghỉ trưa (chỉ để hiển thị, không dùng để tính số ngày)
        const hours = Math.max(0, Math.round((totalHoursDiff - lunchBreakHours) * 10) / 10);
        
        // Số ngày nghỉ phép = số ngày đã đếm (không tính từ giờ)
        const days = daysDiff;
        
        // Format ngày giờ để hiển thị
        const formatDateTime = (date) => {
          const dateStr = date.toLocaleDateString('vi-VN');
          const timeStr = date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
          return `${dateStr} ${timeStr}`;
        };
        
        return {
          voucherCode: request.voucherCode,
          startDate: formatDateTime(startDate), // Hiển thị thời gian bắt đầu thực tế của đơn
          endDate: formatDateTime(endDate), // Hiển thị thời gian kết thúc thực tế của đơn
          days: days, // Số ngày đã tính theo period (chỉ trong khoảng thời gian hợp đồng)
          hours: hours, // Số giờ đã tính theo period (chỉ trong khoảng thời gian hợp đồng)
          leaveTypeName: request.leaveTypeName || 'Nghỉ phép',
          notes: request.notes || ''
        };
      }).filter(item => item !== null); // Loại bỏ các item null (không có phần nào trong period)
      
      setLeaveDetails(details);
    } catch (error) {
      console.error('Error fetching leave details:', error);
      setLeaveDetails([]);
    }
  };

  const closeLeaveModal = () => {
    setShowLeaveModal(false);
    setLeaveDetails([]);
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <CustomHeader title="Phiếu lương" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3498db" />
          <Text style={styles.loadingText}>Đang tải dữ liệu lương...</Text>
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <CustomHeader title="Phiếu lương" />
        <View style={styles.errorContainer}>
          <Icon name="alert-circle" size={48} color="#e74c3c" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={refreshSalaryData}>
            <Text style={styles.retryButtonText}>Thử lại</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Không hiển thị màn hình "Không có dữ liệu" nữa, vẫn hiển thị màn hình với giá trị mặc định
  // Nếu không có salaryData, tạo object rỗng để tránh lỗi
  const safeSalaryData = salaryData || {};

  return (
      <View style={styles.container}>
        <CustomHeader title="Phiếu lương" />
        
        {/* Month Navigation */}
        <View style={styles.monthNavigation}>
          <TouchableOpacity style={styles.navButton} onPress={goToPreviousMonth}>
            <Icon name="chevron-left" size={24} color="white" />
          </TouchableOpacity>
          <Text style={styles.monthText}>
            Tháng {selectedMonth}/{selectedYear}
          </Text>
          <TouchableOpacity style={styles.navButton} onPress={goToNextMonth}>
            <Icon name="chevron-right" size={24} color="white" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.currentButton} onPress={goToCurrentMonth}>
            <Icon name="calendar-today" size={20} color="white" />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Employee Info Header */}
          <View style={styles.employeeHeader}>
            <View style={styles.employeeInfo}>
              <Text style={styles.employeeName}>{safeSalaryData?.empName || user?.fullName || 'N/A'}</Text>
              <Text style={styles.employeeCode}>Mã NV: {safeSalaryData?.empId || user?.id || 'N/A'}</Text>
              <Text style={styles.employeePosition}>Chức vụ: {safeSalaryData?.title || 'N/A'}</Text>
            </View>
            <View style={styles.netSalaryDisplay}>
              <Text style={styles.netSalaryLabel}>Thực lãnh</Text>
              <Text style={styles.netSalaryAmount}>{formatMoney(safeSalaryData?.netSalary || 0)}</Text>
            </View>

          </View>

        {/* Basic Salary Information */}
        {renderSalaryCard(
          'Thông tin lương cơ bản',
          'file-invoice-dollar',
          [
            { label: 'Lương hợp đồng', value: formatMoney(safeSalaryData?.contractSalary || 0) },
            { label: 'Lương bảo hiểm', value: formatMoney(safeSalaryData?.insuranceSalary || 0) },
            { label: 'Tổng lương theo hợp đồng', value: formatMoney(safeSalaryData?.totalContractSalary || 0) },
            { label: 'Tổng ngày công chuẩn', value: `${safeSalaryData?.standardDays || 0} ngày` },
            { label: 'Tổng ngày công', value: `${safeSalaryData?.totalDays || 0} ngày` },
            { label: 'Lương theo ngày công', value: formatMoney(safeSalaryData?.salaryByDays || 0) },
          ]
        )}

        {/* Overtime Information */}
        {renderSalaryCard(
          'Thông tin tăng ca',
          'business-time',
          [
            { 
              label: 'Số ngày tăng ca', 
              value: (
                <TouchableOpacity onPress={openOvertimeModal}>
                  <Text style={styles.linkText}>{safeSalaryData?.otDays || 0} ngày</Text>
                </TouchableOpacity>
              )
            },
            { label: 'Số ngày có hệ số', value: `${safeSalaryData?.otDaysWithCoeff || 0} ngày` },
            { label: 'Lương tăng ca', value: formatMoney(safeSalaryData?.otSalary || 0) },
            { label: 'Tổng lương thực tế', value: formatMoney(safeSalaryData?.actualSalary || 0) },
          ]
        )}

        {/* Leave Information */}
        {renderSalaryCard(
          'Thông tin nghỉ phép',
          'calendar-check',
          [
            { 
              label: 'Tổng nghỉ có lương', 
              value: (
                <TouchableOpacity onPress={openLeaveModal}>
                  <Text style={styles.linkText}>{safeSalaryData?.paidLeaveDays || 0} ngày</Text>
                </TouchableOpacity>
              )
            },
            { label: 'Tổng lương phép', value: formatMoney(safeSalaryData?.leaveSalary || 0) },
          ]
        )}

        {/* Allowances */}
        {renderSalaryCard(
          'Các khoản phụ cấp',
          'plus-circle',
          [
            { label: 'Phụ cấp ăn ca', value: formatMoney(safeSalaryData?.mealAllowance || 0) },
            { label: 'Phụ cấp xăng xe', value: formatMoney(safeSalaryData?.fuelAllowance || 0) },
            { label: 'Phụ cấp trách nhiệm', value: formatMoney(safeSalaryData?.responsibilityAllowance || 0) },
            { label: 'Tổng các khoản hỗ trợ', value: formatMoney(safeSalaryData?.totalSupport || 0) },
          ]
        )}

        {/* Deductions */}
        {renderSalaryCard(
          'Các khoản trừ',
          'minus-circle',
          [
            { label: 'Bảo hiểm NV đóng', value: formatMoney(safeSalaryData?.insuranceEmployee || 0) },
            { label: 'Đoàn phí', value: formatMoney(safeSalaryData?.unionFee || 0) },
            { label: 'Các khoản trừ khác', value: formatMoney(safeSalaryData?.adjustmentDeductions || 0) },
            { label: 'Giảm trừ bản thân', value: formatMoney(safeSalaryData?.personalDeduction || 0) },
            { label: 'Số người phụ thuộc', value: `${safeSalaryData?.dependents || 0} người` },
            { label: 'Giảm trừ người phụ thuộc', value: formatMoney(safeSalaryData?.dependentDeduction || 0) },
            { label: 'Tổng các khoản trừ', value: formatMoney(safeSalaryData?.totalDeduction || 0) },
          ]
        )}

        {/* Tax Information */}
        {renderSalaryCard(
          'Thông tin thuế',
          'calculator',
          [
            { label: 'Tổng thu nhập', value: formatMoney(safeSalaryData?.totalIncome || 0) },
            { label: 'Tổng thu nhập chịu thuế', value: formatMoney(safeSalaryData?.taxableIncome || 0) },
            { label: 'Khen thưởng', value: formatMoney(safeSalaryData?.bonus || 0) },
            { label: 'Thu nhập khác', value: formatMoney(safeSalaryData?.otherIncome || 0) },
            { label: 'Tổng thu nhập tính thuế PIT', value: formatMoney(safeSalaryData?.pitIncome || 0) },
            { label: 'Thuế TNCN', value: formatMoney(safeSalaryData?.pitTax || 0) },
          ]
        )}

        {/* Final Summary */}
        {renderFinalSummary()}
      </ScrollView>

      {/* Overtime Detail Modal */}
      <Modal
        visible={showOvertimeModal}
        animationType="slide"
        transparent={true}
        onRequestClose={closeOvertimeModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Chi tiết tăng ca</Text>
              <TouchableOpacity onPress={closeOvertimeModal}>
                <Icon name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.modalBody}>
              {/* Employee Info */}
              <View style={styles.modalEmpHeader}>
                <View style={styles.modalEmpInfo}>
                  <Text style={styles.empName}>{safeSalaryData?.empName || user?.fullName || 'N/A'}</Text>
                  <Text style={styles.empId}>Mã NV: {safeSalaryData?.empId || user?.id || 'N/A'}</Text>
                  <Text style={styles.empPos}>Chức vụ: {safeSalaryData?.title || 'N/A'}</Text>
                </View>
                <View style={styles.modalEmpDate}>
                  <Text style={styles.dateLabel}>Tháng: </Text>
                  <Text style={styles.dateValue}>{selectedMonth}/{selectedYear}</Text>
                </View>
              </View>

              {/* Overtime Summary */}
              <View style={styles.summaryCard}>
                <Text style={styles.summaryCardTitle}>Tổng hợp tăng ca tháng</Text>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryLabel}>Số ngày tăng ca:</Text>
                  <Text style={styles.summaryValue}>
                    {overtimeDetails.reduce((sum, ot) => sum + (ot.days || 0), 0).toFixed(1)} ngày
                  </Text>
                </View>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryLabel}>Số ngày có hệ số:</Text>
                  <Text style={styles.summaryValue}>
                    {overtimeDetails.reduce((sum, ot) => sum + ((ot.days || 0) * (ot.coefficient || 1)), 0).toFixed(1)} ngày
                  </Text>
                </View>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryLabel}>Lương tăng ca:</Text>
                  <Text style={styles.summaryValue}>
                    {formatMoney(
                      safeSalaryData?.contractSalary && safeSalaryData?.standardDays
                        ? (overtimeDetails.reduce((sum, ot) => sum + ((ot.days || 0) * (ot.coefficient || 1)), 0) * safeSalaryData.contractSalary / safeSalaryData.standardDays)
                        : 0
                    )}
                  </Text>
                </View>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryLabel}>Lương hợp đồng:</Text>
                  <Text style={styles.summaryValue}>{formatMoney(safeSalaryData?.contractSalary || 0)}</Text>
                </View>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryLabel}>Tổng ngày công chuẩn:</Text>
                  <Text style={styles.summaryValue}>{safeSalaryData?.standardDays || 0} ngày</Text>
                </View>
              </View>

              {/* Overtime Details List */}
              {overtimeDetails.length > 0 ? (
                <View style={styles.detailsList}>
                  <Text style={styles.detailsListTitle}>Danh sách đơn tăng ca</Text>
                  <View style={styles.table}>
                    <View style={styles.tableHeader}>
                      <Text style={[styles.tableCell, styles.tableHeaderCell, { flex: 1.2 }]}>Mã phiếu</Text>
                      <Text style={[styles.tableCell, styles.tableHeaderCell, { flex: 1.5 }]}>Từ ngày</Text>
                      <Text style={[styles.tableCell, styles.tableHeaderCell, { flex: 1.5 }]}>Đến ngày</Text>
                      <Text style={[styles.tableCell, styles.tableHeaderCell, { flex: 1 }]}>Số giờ</Text>
                      <Text style={[styles.tableCell, styles.tableHeaderCell, { flex: 1 }]}>Số ngày</Text>
                      <Text style={[styles.tableCell, styles.tableHeaderCell, { flex: 0.8 }]}>Hệ số</Text>
                      <Text style={[styles.tableCell, styles.tableHeaderCell, { flex: 1.3 }]}>Loại tăng ca</Text>
                    </View>
                    {overtimeDetails.map((overtime, index) => (
                      <View key={index} style={styles.tableRow}>
                        <Text style={[styles.tableCell, { flex: 1.2 }]}>{overtime.voucherCode}</Text>
                        <Text style={[styles.tableCell, { flex: 1.5 }]}>{overtime.startDate}</Text>
                        <Text style={[styles.tableCell, { flex: 1.5 }]}>{overtime.endDate}</Text>
                        <Text style={[styles.tableCell, styles.tableCellBold, { flex: 1 }]}>{overtime.hours} giờ</Text>
                        <Text style={[styles.tableCell, styles.tableCellBold, { flex: 1 }]}>{overtime.days} ngày</Text>
                        <Text style={[styles.tableCell, styles.tableCellBold, { flex: 0.8 }]}>{overtime.coefficient}x</Text>
                        <Text style={[styles.tableCell, { flex: 1.3 }]}>{overtime.overtimeTypeName}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              ) : (
                <View style={styles.noDataContainer}>
                  <Icon name="information-outline" size={24} color="#666" />
                  <Text style={styles.noDataText}>
                    Không có đơn tăng ca đã duyệt trong tháng {selectedMonth}/{selectedYear}
                  </Text>
                </View>
              )}

              {/* Calculation Formula */}
              <View style={styles.formulaCard}>
                <Text style={styles.formulaTitle}>Công thức tính lương tăng ca</Text>
                <View style={styles.formulaContent}>
                  <Text style={styles.formulaText}>
                    Lương tăng ca = Công tăng ca × Lương hợp đồng × Hệ số / Tổng ngày công chuẩn
                  </Text>
                  <Text style={styles.formulaBreakdown}>
                    = {overtimeDetails.reduce((sum, ot) => sum + ((ot.days || 0) * (ot.coefficient || 1)), 0).toFixed(1)} × {formatMoney(safeSalaryData?.contractSalary || 0)} / {safeSalaryData?.standardDays || 0}
                    {'\n'}
                    = {formatMoney(
                      safeSalaryData?.contractSalary && safeSalaryData?.standardDays
                        ? (overtimeDetails.reduce((sum, ot) => sum + ((ot.days || 0) * (ot.coefficient || 1)), 0) * safeSalaryData.contractSalary / safeSalaryData.standardDays)
                        : 0
                    )}
                  </Text>
                </View>
              </View>

                <View style={styles.noteContainer}>
                  <Icon name="information" size={16} color="#666" />
                  <Text style={styles.noteText}>
                    Hệ số tăng ca được tính từ các đơn tăng ca đã được duyệt trong tháng {selectedMonth}/{selectedYear}
                  </Text>
                </View>
              </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Leave Detail Modal */}
      <Modal
        visible={showLeaveModal}
        animationType="slide"
        transparent={true}
        onRequestClose={closeLeaveModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Chi tiết nghỉ phép</Text>
              <TouchableOpacity onPress={closeLeaveModal}>
                <Icon name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.modalBody}>
              {/* Employee Info */}
              <View style={styles.modalEmpHeader}>
                <View style={styles.modalEmpInfo}>
                  <Text style={styles.empName}>{safeSalaryData?.empName || user?.fullName || 'N/A'}</Text>
                  <Text style={styles.empId}>Mã NV: {safeSalaryData?.empId || user?.id || 'N/A'}</Text>
                  <Text style={styles.empPos}>Chức vụ: {safeSalaryData?.title || 'N/A'}</Text>
                </View>
                <View style={styles.modalEmpDate}>
                  <Text style={styles.dateLabel}>Tháng: </Text>
                  <Text style={styles.dateValue}>{selectedMonth}/{selectedYear}</Text>
                </View>
              </View>

              {/* Leave Summary */}
              <View style={styles.summaryCard}>
                <Text style={styles.summaryCardTitle}>Tổng hợp nghỉ phép tháng</Text>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryLabel}>Tổng nghỉ có lương:</Text>
                  <Text style={styles.summaryValue}>{safeSalaryData?.paidLeaveDays || 0} ngày</Text>
                </View>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryLabel}>Tổng lương phép:</Text>
                  <Text style={styles.summaryValue}>{formatMoney(safeSalaryData?.leaveSalary || 0)}</Text>
                </View>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryLabel}>Lương hợp đồng:</Text>
                  <Text style={styles.summaryValue}>{formatMoney(safeSalaryData?.contractSalary || 0)}</Text>
                </View>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryLabel}>Tổng ngày công chuẩn:</Text>
                  <Text style={styles.summaryValue}>{safeSalaryData?.standardDays || 0} ngày</Text>
                </View>
              </View>

                {/* Leave Details List */}
                {leaveDetails.length > 0 ? (
                  <View style={styles.detailsList}>
                    <Text style={styles.detailsListTitle}>Danh sách ngày nghỉ</Text>
                    <View style={styles.table}>
                      <View style={styles.tableHeader}>
                        <Text style={[styles.tableCell, styles.tableHeaderCell, { flex: 1.2 }]}>Mã phiếu</Text>
                        <Text style={[styles.tableCell, styles.tableHeaderCell, { flex: 1.5 }]}>Từ ngày</Text>
                        <Text style={[styles.tableCell, styles.tableHeaderCell, { flex: 1.5 }]}>Đến ngày</Text>
                        <Text style={[styles.tableCell, styles.tableHeaderCell, { flex: 1 }]}>Số ngày</Text>
                        <Text style={[styles.tableCell, styles.tableHeaderCell, { flex: 1 }]}>Số giờ</Text>
                        <Text style={[styles.tableCell, styles.tableHeaderCell, { flex: 1.3 }]}>Loại nghỉ</Text>
                      </View>
                      {leaveDetails.map((leave, index) => (
                        <View key={index} style={styles.tableRow}>
                          <Text style={[styles.tableCell, { flex: 1.2 }]}>{leave.voucherCode}</Text>
                          <Text style={[styles.tableCell, { flex: 1.5 }]}>{leave.startDate}</Text>
                          <Text style={[styles.tableCell, { flex: 1.5 }]}>{leave.endDate}</Text>
                          <Text style={[styles.tableCell, styles.tableCellBold, { flex: 1 }]}>{leave.days} ngày</Text>
                          <Text style={[styles.tableCell, styles.tableCellBold, { flex: 1 }]}>{leave.hours} giờ</Text>
                          <Text style={[styles.tableCell, { flex: 1.3 }]}>{leave.leaveTypeName}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                ) : (
                  <View style={styles.noDataContainer}>
                    <Icon name="information-outline" size={24} color="#666" />
                    <Text style={styles.noDataText}>
                      Không có đơn nghỉ phép đã duyệt trong tháng {selectedMonth}/{selectedYear}
                    </Text>
                  </View>
                )}

                {/* Calculation Formula */}
                <View style={styles.formulaCard}>
                  <Text style={styles.formulaTitle}>Công thức tính lương phép</Text>
                  <View style={styles.formulaContent}>
                    <Text style={styles.formulaText}>
                      Lương phép = Số ngày nghỉ có lương × Lương hợp đồng / Tổng ngày công chuẩn
                    </Text>
                    <Text style={styles.formulaBreakdown}>
                      = {safeSalaryData?.paidLeaveDays || 0} × {formatMoney(safeSalaryData?.contractSalary || 0)} / {safeSalaryData?.standardDays || 0}
                      {'\n'}
                      = {formatMoney(safeSalaryData?.leaveSalary || 0)}
                    </Text>
                  </View>
                </View>

                <View style={styles.noteContainer}>
                  <Icon name="information" size={16} color="#666" />
                  <Text style={styles.noteText}>
                    Lương phép được tính từ các đơn nghỉ phép đã được duyệt trong tháng {selectedMonth}/{selectedYear}
                  </Text>
                </View>
              </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f6f8fa',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    marginTop: 10,
    fontSize: 16,
    color: '#e74c3c',
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 20,
    backgroundColor: '#3498db',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  noDataContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  noDataText: {
    marginTop: 10,
    fontSize: 18,
    fontWeight: 'bold',
    color: '#bdc3c7',
  },
  noDataSubText: {
    marginTop: 5,
    fontSize: 14,
    color: '#95a5a6',
    textAlign: 'center',
  },
  monthNavigation: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2c3e50',
    paddingVertical: 15,
    paddingHorizontal: 20,
    marginBottom: 10,
    borderRadius: 12,
    marginHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  navButton: {
    padding: 8,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  currentButton: {
    marginLeft: 10,
    padding: 8,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  monthText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    marginHorizontal: 20,
  },
  scrollContent: {
    padding: 16,
  },
  employeeHeader: {
    backgroundColor: '#2c3e50',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    marginHorizontal: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
  employeeInfo: {
    flex: 1,
  },
  employeeName: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  employeeCode: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 14,
    marginBottom: 2,
  },
  employeePosition: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 14,
  },
  netSalaryDisplay: {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 12,
    padding: 15,
    minWidth: 120,
  },
  netSalaryLabel: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 14,
    marginBottom: 5,
  },
  netSalaryAmount: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  salaryCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    marginBottom: 16,
    marginHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    borderLeftWidth: 4,
    borderLeftColor: '#3498db',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderBottomWidth: 2,
    borderBottomColor: '#dee2e6',
  },
  cardTitle: {
    marginLeft: 8,
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  cardTitleWhite: {
    marginLeft: 8,
    fontSize: 16,
    fontWeight: 'bold',
    color: 'white',
  },
  cardBody: {
    padding: 16,
  },
  salaryItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f3f4',
  },
  salaryLabel: {
    fontSize: 14,
    color: '#495057',
    fontWeight: '500',
    flex: 1,
  },
  salaryValue: {
    fontSize: 14,
    color: '#2c3e50',
    fontWeight: 'bold',
    textAlign: 'right',
  },
  finalSummaryCard: {
    backgroundColor: '#2c3e50',
    borderRadius: 16,
    marginBottom: 16,
    marginHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
    borderLeftWidth: 4,
    borderLeftColor: '#3498db',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.2)',
  },
  summaryLabel: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.9)',
    fontWeight: '500',
  },
  summaryValueIncome: {
    fontSize: 14,
    color: '#90ee90',
    fontWeight: 'bold',
  },
  summaryValueDeduction: {
    fontSize: 14,
    color: '#ffb6c1',
    fontWeight: 'bold',
  },
  summaryValueNet: {
    fontSize: 16,
    color: 'white',
    fontWeight: 'bold',
  },
  summaryDivider: {
    height: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    marginVertical: 8,
    borderRadius: 1,
  },
  finalRow: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    marginHorizontal: -16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 0,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
  },
  linkText: {
    color: '#3498db',
    textDecorationLine: 'underline',
    fontWeight: '600',
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
    paddingBottom: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  modalBody: {
    padding: 16,
  },
  modalEmpHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#dee2e6',
  },
  modalEmpInfo: {
    flex: 1,
  },
  empName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#3498db',
    marginBottom: 4,
  },
  empId: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  empPos: {
    fontSize: 14,
    color: '#666',
  },
  modalEmpDate: {
    alignItems: 'flex-end',
  },
  dateLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  dateValue: {
    fontSize: 14,
    color: '#2c3e50',
  },
  summaryCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#dee2e6',
  },
  summaryCardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 12,
  },
  detailsList: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#dee2e6',
  },
  detailsListTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 12,
  },
  table: {
    borderWidth: 1,
    borderColor: '#dee2e6',
    borderRadius: 8,
    overflow: 'hidden',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f8f9fa',
    borderBottomWidth: 2,
    borderBottomColor: '#dee2e6',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f3f4',
  },
  tableCell: {
    padding: 8,
    fontSize: 12,
    color: '#495057',
  },
  tableHeaderCell: {
    fontWeight: '600',
    color: '#495057',
  },
  tableCellBold: {
    fontWeight: 'bold',
  },
  formulaCard: {
    backgroundColor: '#e3f2fd',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#3498db',
  },
  formulaTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 12,
  },
  formulaContent: {
    backgroundColor: '#fff',
    borderRadius: 4,
    padding: 12,
  },
  formulaText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: 8,
  },
  formulaBreakdown: {
    fontSize: 12,
    color: '#666',
    fontFamily: 'monospace',
  },
  noteContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 12,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    gap: 8,
  },
  noteText: {
    flex: 1,
    fontSize: 12,
    color: '#666',
    lineHeight: 18,
  },
  noDataContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#e3f2fd',
    borderRadius: 8,
    gap: 8,
    marginBottom: 16,
  },
  noDataText: {
    flex: 1,
    fontSize: 14,
    color: '#666',
  },
});

