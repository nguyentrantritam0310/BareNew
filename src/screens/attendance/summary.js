import React, { useEffect, useState, useMemo } from 'react';
import { ActivityIndicator, Image, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useAttendanceData } from '../../composables/useAttendanceData';
import { useLeaveRequest } from '../../composables/useLeaveRequest';
import { useWorkShift } from '../../composables/useWorkShift';
import { useAuth } from '../../contexts/AuthContext';
import { useEmployee } from '../../composables/useEmployee';
import { attendanceDataService } from '../../services/attendanceDataService';
import api from '../../api';
import CustomHeader from '../../components/CustomHeader';

export default function AttendanceSummary() {
  const { user } = useAuth();
  const { attendanceData, loading: attendanceLoading, error: attendanceError, fetchAttendanceData } = useAttendanceData();
  const { leaveRequests, fetchLeaveRequests, loading: leaveLoading } = useLeaveRequest();
  const { workShifts, fetchWorkShifts, loading: workShiftLoading } = useWorkShift();
  const { employees, fetchAllEmployees } = useEmployee();
  
  // State cho tháng/năm
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedDay, setSelectedDay] = useState(null);
  const [dayDetailData, setDayDetailData] = useState([]);
  const [workHistoryData, setWorkHistoryData] = useState([]);
  const [shiftAssignments, setShiftAssignments] = useState([]);
  const [attendanceList, setAttendanceList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dayModalLoading, setDayModalLoading] = useState(false);
  const [dayModalError, setDayModalError] = useState(null);
  const [selectedEmployee, setSelectedEmployee] = useState(null);

  useEffect(() => {
    loadAllData();
  }, [month, year]);

  useEffect(() => {
    fetchLeaveRequests();
    fetchWorkShifts();
    fetchAllEmployees();
  }, []);

  const loadAllData = async () => {
    try {
      setLoading(true);
      await Promise.all([
        loadAttendanceData(),
        loadShiftAssignments(),
        loadAttendanceList()
      ]);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadAttendanceData = async () => {
    await fetchAttendanceData({
      year: year,
      month: month
    });
  };

  const loadShiftAssignments = async () => {
    try {
      const response = await api.get('/ShiftAssignment');
      setShiftAssignments(response.data || []);
    } catch (error) {
      console.error('Error loading shift assignments:', error);
      setShiftAssignments([]);
    }
  };

  const loadAttendanceList = async () => {
    try {
      const response = await api.get('/AttendanceData');
      setAttendanceList(response.data || []);
    } catch (error) {
      console.error('Error loading attendance list:', error);
      setAttendanceList([]);
    }
  };

  const formatTime = (timeString) => {
    if (!timeString) return '';
    try {
      if (typeof timeString === 'string' && timeString.includes('T')) {
        const date = new Date(timeString);
      if (isNaN(date.getTime())) return '';
      return date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
      }
      // If it's already in HH:mm format
      if (typeof timeString === 'string' && timeString.length <= 5) {
        return timeString;
      }
      return timeString.toString().substring(0, 5);
    } catch {
      return '';
    }
  };

  const formatDateToString = (date) => {
    if (!date) return '';
    try {
      const d = new Date(date);
      if (isNaN(d.getTime())) return '';
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    } catch {
      return '';
    }
  };

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

  const matchEmployee = (attendance, employeeId) => {
    const attEmployeeId = attendance.employeeCode || attendance.employeeID || attendance.employeeId;
    return String(attEmployeeId) === String(employeeId);
  };

  const checkLeaveRequestForEmployee = (employeeId, date) => {
    if (!leaveRequests || leaveRequests.length === 0) return null;
    
    const dateStr = formatDateToString(date);
    const leave = leaveRequests.find(l => {
      if (String(l.employeeID) !== String(employeeId)) return false;
      if (!isApproved(l.approveStatus)) return false;
      
      const leaveStart = new Date(l.startDateTime);
      const leaveEnd = new Date(l.endDateTime);
      const leaveStartStr = formatDateToString(leaveStart);
      const leaveEndStr = formatDateToString(leaveEnd);
      
      return dateStr >= leaveStartStr && dateStr <= leaveEndStr;
    });
    
    return leave || null;
  };

  const calculateWorkDaysFromAttendanceData = (attRecord) => {
    if (!attRecord.checkInTime || !attRecord.checkOutTime) {
      return { actualWorkHours: 0, workDays: 0, standardWorkHours: 8 };
    }

    const checkInTime = new Date(`2000-01-01T${attRecord.checkInTime}`);
    const checkOutTime = new Date(`2000-01-01T${attRecord.checkOutTime}`);
    
    if (!attRecord.workShiftID) {
      const workHours = (checkOutTime - checkInTime) / (1000 * 60 * 60);
      return { actualWorkHours: workHours, workDays: workHours / 8, standardWorkHours: 8 };
    }

    const workShift = workShifts.find(shift => shift.id === attRecord.workShiftID);
    if (!workShift || !workShift.shiftDetails) {
      const workHours = (checkOutTime - checkInTime) / (1000 * 60 * 60);
      return { actualWorkHours: workHours, workDays: workHours / 8, standardWorkHours: 8 };
    }

    const workDate = new Date(attRecord.workDate);
    const dayOfWeek = workDate.getDay();
    const dayNames = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];
    const currentDayName = dayNames[dayOfWeek];
    const dayShiftDetail = workShift.shiftDetails.find(detail => detail.dayOfWeek === currentDayName);
    
    if (!dayShiftDetail || dayShiftDetail.startTime === '00:00:00' || dayShiftDetail.endTime === '00:00:00') {
      const workHours = (checkOutTime - checkInTime) / (1000 * 60 * 60);
      return { actualWorkHours: workHours, workDays: workHours / 8, standardWorkHours: 8 };
    }

    const shiftStart = new Date(`2000-01-01T${dayShiftDetail.startTime}`);
    const shiftEnd = new Date(`2000-01-01T${dayShiftDetail.endTime}`);
    
    let standardWorkHours = (shiftEnd - shiftStart) / (1000 * 60 * 60);
    if (dayShiftDetail.breakStart && dayShiftDetail.breakEnd && 
        dayShiftDetail.breakStart !== '00:00:00' && dayShiftDetail.breakEnd !== '00:00:00') {
      const breakStart = new Date(`2000-01-01T${dayShiftDetail.breakStart}`);
      const breakEnd = new Date(`2000-01-01T${dayShiftDetail.breakEnd}`);
      const breakHours = (breakEnd - breakStart) / (1000 * 60 * 60);
      standardWorkHours -= breakHours;
    }
    
    const effectiveCheckInTime = checkInTime < shiftStart ? shiftStart : checkInTime;
    const effectiveCheckOutTime = checkOutTime < shiftEnd ? checkOutTime : shiftEnd;
    
    let totalTimeHours = (effectiveCheckOutTime - effectiveCheckInTime) / (1000 * 60 * 60);
    if (totalTimeHours < 0) {
      totalTimeHours = 0;
    }
    
    let actualWorkHours = totalTimeHours;
    if (dayShiftDetail.breakStart && dayShiftDetail.breakEnd && 
        dayShiftDetail.breakStart !== '00:00:00' && dayShiftDetail.breakEnd !== '00:00:00') {
      const breakStart = new Date(`2000-01-01T${dayShiftDetail.breakStart}`);
      const breakEnd = new Date(`2000-01-01T${dayShiftDetail.breakEnd}`);
      if (effectiveCheckInTime <= breakEnd && effectiveCheckOutTime >= breakStart) {
        const actualBreakStart = effectiveCheckInTime > breakStart ? effectiveCheckInTime : breakStart;
        const actualBreakEnd = effectiveCheckOutTime < breakEnd ? effectiveCheckOutTime : breakEnd;
        const actualBreakHours = (actualBreakEnd - actualBreakStart) / (1000 * 60 * 60);
        actualWorkHours = totalTimeHours - Math.max(0, actualBreakHours);
      }
    }
    
    if (actualWorkHours < 0) {
      actualWorkHours = 0;
    }
    
    // Tính ngày công: luôn chia cho 8 giờ chuẩn (1 ngày công = 8 giờ)
    // Không chia cho standardWorkHours của ca vì ngày công phải dựa trên chuẩn 8 giờ/ngày
    const divisor = 8; // 1 ngày công = 8 giờ chuẩn
    const workDays = Math.round((actualWorkHours / divisor) * 100) / 100;
    
    return { actualWorkHours, workDays, standardWorkHours };
  };

  /**
   * Tính ngày công nghỉ phép từ leave request
   * @param {Object} leaveRequest - Thông tin nghỉ phép (startDateTime, endDateTime, workShiftID)
   * @param {Date} targetDate - Ngày cần tính
   * @param {Object} workShift - Thông tin ca làm việc (optional, sẽ tìm nếu không có)
   * @returns {Object} { actualWorkHours, workDays, standardWorkHours }
   */
  const calculateWorkDaysFromLeaveRequest = (leaveRequest, targetDate, workShift = null) => {
    if (!leaveRequest) return { actualWorkHours: 0, workDays: 0, standardWorkHours: 8 };

    const leaveStart = new Date(leaveRequest.startDateTime);
    const leaveEnd = new Date(leaveRequest.endDateTime);
    const target = new Date(targetDate);
    
    // Đặt ngày đích về đầu ngày để so sánh
    target.setHours(0, 0, 0, 0);
    
    // Kiểm tra xem ngày đích có nằm trong khoảng nghỉ phép không
    const leaveStartDate = new Date(leaveStart);
    leaveStartDate.setHours(0, 0, 0, 0);
    const leaveEndDate = new Date(leaveEnd);
    leaveEndDate.setHours(0, 0, 0, 0);
    
    if (target < leaveStartDate || target > leaveEndDate) {
      return { actualWorkHours: 0, workDays: 0, standardWorkHours: 8 };
    }
    
    // Lấy thông tin chi tiết ca làm việc
    if (!workShift && leaveRequest.workShiftID) {
      workShift = workShifts.find(shift => shift.id === leaveRequest.workShiftID);
    }
    
    // Giờ công mặc định nếu không có thông tin ca
    let workHours = 0;
    let standardWorkHours = 8;
    
    if (workShift && workShift.shiftDetails) {
      const dayOfWeek = target.getDay();
      const dayNames = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];
      const currentDayName = dayNames[dayOfWeek];
      
      const dayShiftDetail = workShift.shiftDetails.find(detail => detail.dayOfWeek === currentDayName);
      
      if (dayShiftDetail && dayShiftDetail.startTime !== '00:00:00' && dayShiftDetail.endTime !== '00:00:00') {
        const shiftStart = new Date(`2000-01-01T${dayShiftDetail.startTime}`);
        const shiftEnd = new Date(`2000-01-01T${dayShiftDetail.endTime}`);
        
        // Tính giờ công chuẩn
        standardWorkHours = (shiftEnd.getTime() - shiftStart.getTime()) / (1000 * 60 * 60);
        if (dayShiftDetail.breakStart && dayShiftDetail.breakEnd && 
            dayShiftDetail.breakStart !== '00:00:00' && dayShiftDetail.breakEnd !== '00:00:00') {
          const breakStart = new Date(`2000-01-01T${dayShiftDetail.breakStart}`);
          const breakEnd = new Date(`2000-01-01T${dayShiftDetail.breakEnd}`);
          const breakHours = (breakEnd.getTime() - breakStart.getTime()) / (1000 * 60 * 60);
          standardWorkHours -= breakHours;
        }
        
        // Xác định giờ công dựa trên khoảng nghỉ phép
        if (target.getTime() === leaveStartDate.getTime() && target.getTime() === leaveEndDate.getTime()) {
          // Nghỉ phép một ngày
          const leaveStartTime = new Date(`2000-01-01T${leaveStart.toTimeString().substring(0, 8)}`);
          const leaveEndTime = new Date(`2000-01-01T${leaveEnd.toTimeString().substring(0, 8)}`);
          const leaveStartTimeOnly = leaveStartTime.getTime();
          const leaveEndTimeOnly = leaveEndTime.getTime();
          const shiftStartTime = shiftStart.getTime();
          const shiftEndTime = shiftEnd.getTime();
          
          if (leaveStartTimeOnly <= shiftStartTime && leaveEndTimeOnly >= shiftEndTime) {
            workHours = standardWorkHours;
          } else {
            const effectiveStart = leaveStartTimeOnly < shiftStartTime ? shiftStart : leaveStartTime;
            const effectiveEnd = leaveEndTimeOnly > shiftEndTime ? shiftEnd : leaveEndTime;
            const leaveHours = (effectiveEnd - effectiveStart) / (1000 * 60 * 60);
            
            if (dayShiftDetail.breakStart && dayShiftDetail.breakEnd && 
                dayShiftDetail.breakStart !== '00:00:00' && dayShiftDetail.breakEnd !== '00:00:00') {
              const breakStart = new Date(`2000-01-01T${dayShiftDetail.breakStart}`);
              const breakEnd = new Date(`2000-01-01T${dayShiftDetail.breakEnd}`);
              if (effectiveStart <= breakEnd && effectiveEnd >= breakStart) {
                const actualBreakStart = effectiveStart > breakStart ? effectiveStart : breakStart;
                const actualBreakEnd = effectiveEnd < breakEnd ? effectiveEnd : breakEnd;
                const actualBreakHours = (actualBreakEnd - actualBreakStart) / (1000 * 60 * 60);
                workHours = leaveHours - Math.max(0, actualBreakHours);
              } else {
                workHours = leaveHours;
              }
            } else {
              workHours = leaveHours;
            }
          }
        } else if (target.getTime() === leaveStartDate.getTime()) {
          // Ngày đầu tiên
          const leaveStartHours = leaveStart.getHours();
          const leaveStartMinutes = leaveStart.getMinutes();
          const leaveStartSeconds = leaveStart.getSeconds();
          const leaveStartTime = new Date(2000, 0, 1, leaveStartHours, leaveStartMinutes, leaveStartSeconds);
          const leaveStartTimeOnly = leaveStartTime.getTime();
          const shiftStartTime = shiftStart.getTime();
          
          if (leaveStartTimeOnly <= shiftStartTime) {
            workHours = standardWorkHours;
          } else {
            const effectiveEnd = shiftEnd;
            const dayHours = (effectiveEnd.getTime() - leaveStartTime.getTime()) / (1000 * 60 * 60);
            
            if (dayShiftDetail.breakStart && dayShiftDetail.breakEnd && 
                dayShiftDetail.breakStart !== '00:00:00' && dayShiftDetail.breakEnd !== '00:00:00') {
              const breakStart = new Date(`2000-01-01T${dayShiftDetail.breakStart}`);
              const breakEnd = new Date(`2000-01-01T${dayShiftDetail.breakEnd}`);
              if (leaveStartTime.getTime() <= breakEnd.getTime() && effectiveEnd.getTime() >= breakStart.getTime()) {
                const actualBreakStart = leaveStartTime.getTime() > breakStart.getTime() ? leaveStartTime : breakStart;
                const actualBreakEnd = effectiveEnd.getTime() < breakEnd.getTime() ? effectiveEnd : breakEnd;
                const actualBreakHours = (actualBreakEnd.getTime() - actualBreakStart.getTime()) / (1000 * 60 * 60);
                workHours = dayHours - Math.max(0, actualBreakHours);
              } else {
                workHours = dayHours;
              }
            } else {
              workHours = dayHours;
            }
          }
        } else if (target.getTime() === leaveEndDate.getTime()) {
          // Ngày cuối cùng
          const leaveEndTime = new Date(`2000-01-01T${leaveEnd.toTimeString().substring(0, 8)}`);
          const leaveEndTimeOnly = leaveEndTime.getTime();
          const shiftEndTime = shiftEnd.getTime();
          
          if (leaveEndTimeOnly >= shiftEndTime) {
            workHours = standardWorkHours;
          } else {
            const effectiveStart = shiftStart;
            const dayHours = (leaveEndTime.getTime() - effectiveStart.getTime()) / (1000 * 60 * 60);
            
            if (dayShiftDetail.breakStart && dayShiftDetail.breakEnd && 
                dayShiftDetail.breakStart !== '00:00:00' && dayShiftDetail.breakEnd !== '00:00:00') {
              const breakStart = new Date(`2000-01-01T${dayShiftDetail.breakStart}`);
              const breakEnd = new Date(`2000-01-01T${dayShiftDetail.breakEnd}`);
              if (effectiveStart.getTime() <= breakEnd.getTime() && leaveEndTime.getTime() >= breakStart.getTime()) {
                const actualBreakStart = effectiveStart.getTime() > breakStart.getTime() ? effectiveStart : breakStart;
                const actualBreakEnd = leaveEndTime.getTime() < breakEnd.getTime() ? leaveEndTime : breakEnd;
                const actualBreakHours = (actualBreakEnd.getTime() - actualBreakStart.getTime()) / (1000 * 60 * 60);
                workHours = dayHours - Math.max(0, actualBreakHours);
              } else {
                workHours = dayHours;
              }
            } else {
              workHours = dayHours;
            }
          }
        } else {
          // Ngày giữa - full ca làm việc
          workHours = standardWorkHours;
        }
      } else {
        // Không có thông tin chi tiết ca
        if (target.getTime() === leaveStartDate.getTime()) {
          const leaveStartHours = leaveStart.getHours();
          const leaveStartMinutes = leaveStart.getMinutes();
          const leaveStartSeconds = leaveStart.getSeconds();
          const leaveStartTime = new Date(2000, 0, 1, leaveStartHours, leaveStartMinutes, leaveStartSeconds);
          const defaultEndTime = new Date(2000, 0, 1, 17, 0, 0);
          workHours = (defaultEndTime.getTime() - leaveStartTime.getTime()) / (1000 * 60 * 60);
        } else if (target.getTime() === leaveEndDate.getTime()) {
          const leaveEndHours = leaveEnd.getHours();
          const leaveEndMinutes = leaveEnd.getMinutes();
          const leaveEndSeconds = leaveEnd.getSeconds();
          const leaveEndTime = new Date(2000, 0, 1, leaveEndHours, leaveEndMinutes, leaveEndSeconds);
          const defaultStartTime = new Date(2000, 0, 1, 8, 0, 0);
          workHours = (leaveEndTime.getTime() - defaultStartTime.getTime()) / (1000 * 60 * 60);
        } else {
          workHours = standardWorkHours;
        }
      }
    } else {
      workHours = standardWorkHours;
    }
    
    if (workHours < 0) {
      workHours = 0;
    }
    
    // Tính ngày công: luôn chia cho 8 giờ chuẩn
    const divisor = 8;
    const workDays = Math.round((workHours / divisor) * 100) / 100;
    
    return { actualWorkHours: workHours, workDays, standardWorkHours };
  };

  const generateAttendanceForEmployee = (employeeId) => {
    if (!attendanceList || attendanceList.length === 0) {
      return Array.from({ length: new Date(year, month, 0).getDate() }).map((_, dayIdx) => {
        const currentDate = new Date(year, month - 1, dayIdx + 1);
        const leaveRequest = checkLeaveRequestForEmployee(employeeId, currentDate);
        if (leaveRequest) {
          return {
            status: 'leave',
            time: '',
            type: leaveRequest.leaveTypeName || 'Nghỉ phép',
            attendance: null,
            leaveRequest: leaveRequest
          };
        }
        return { status: 'absent', time: '', type: '', attendance: null, leaveRequest: null };
      });
    }

    const employeeAttendance = attendanceList.filter(attendance => 
      matchEmployee(attendance, employeeId)
    );

    const daysInMonth = new Date(year, month, 0).getDate();
    return Array.from({ length: daysInMonth }).map((_, dayIdx) => {
      const currentDate = new Date(year, month - 1, dayIdx + 1);
      const dateStr = formatDateToString(currentDate);

      const dayAttendance = employeeAttendance.find(attendance => {
        const attendanceDate = formatDateToString(new Date(attendance.workDate));
        return attendanceDate === dateStr;
      });

      let leaveRequest = checkLeaveRequestForEmployee(employeeId, currentDate);
      
      if (leaveRequest) {
        return {
          status: 'leave',
          time: '',
          type: leaveRequest.leaveTypeName || 'Nghỉ phép',
          attendance: null,
          leaveRequest: leaveRequest
        };
      }

      if (dayAttendance) {
        const getTimeString = (time) => formatTime(time);
        
        if (dayAttendance.checkInTime && dayAttendance.checkOutTime) {
          const checkIn = getTimeString(dayAttendance.checkInTime);
          const checkOut = getTimeString(dayAttendance.checkOutTime);
          const checkInTime = new Date(`2000-01-01T${dayAttendance.checkInTime}`);
          const checkOutTime = new Date(`2000-01-01T${dayAttendance.checkOutTime}`);
          
          let workHours = 0;
          let standardWorkHours = 8;
          let lateMinutes = 0;
          let earlyMinutes = 0;
          
          if (dayAttendance.workShiftID) {
            const workShift = workShifts.find(shift => shift.id === dayAttendance.workShiftID);
            if (workShift && workShift.shiftDetails) {
              const dayOfWeek = currentDate.getDay();
              const dayNames = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];
              const currentDayName = dayNames[dayOfWeek];
              const dayShiftDetail = workShift.shiftDetails.find(detail => detail.dayOfWeek === currentDayName);
              
              if (dayShiftDetail && dayShiftDetail.startTime !== '00:00:00' && dayShiftDetail.endTime !== '00:00:00') {
                const shiftStart = new Date(`2000-01-01T${dayShiftDetail.startTime}`);
                const shiftEnd = new Date(`2000-01-01T${dayShiftDetail.endTime}`);
                
                let shiftWorkHours = (shiftEnd - shiftStart) / (1000 * 60 * 60);
                if (dayShiftDetail.breakStart && dayShiftDetail.breakEnd && 
                    dayShiftDetail.breakStart !== '00:00:00' && dayShiftDetail.breakEnd !== '00:00:00') {
                  const breakStart = new Date(`2000-01-01T${dayShiftDetail.breakStart}`);
                  const breakEnd = new Date(`2000-01-01T${dayShiftDetail.breakEnd}`);
                  const breakHours = (breakEnd - breakStart) / (1000 * 60 * 60);
                  shiftWorkHours -= breakHours;
                }
                standardWorkHours = shiftWorkHours;
                
                const effectiveCheckInTime = checkInTime < shiftStart ? shiftStart : checkInTime;
                const effectiveCheckOutTime = checkOutTime < shiftEnd ? checkOutTime : shiftEnd;
                let totalTimeHours = (effectiveCheckOutTime - effectiveCheckInTime) / (1000 * 60 * 60);
                if (totalTimeHours < 0) totalTimeHours = 0;
                
                let actualWorkHours = totalTimeHours;
                if (dayShiftDetail.breakStart && dayShiftDetail.breakEnd && 
                    dayShiftDetail.breakStart !== '00:00:00' && dayShiftDetail.breakEnd !== '00:00:00') {
                  const breakStart = new Date(`2000-01-01T${dayShiftDetail.breakStart}`);
                  const breakEnd = new Date(`2000-01-01T${dayShiftDetail.breakEnd}`);
                  if (effectiveCheckInTime <= breakEnd && effectiveCheckOutTime >= breakStart) {
                    const actualBreakStart = effectiveCheckInTime > breakStart ? effectiveCheckInTime : breakStart;
                    const actualBreakEnd = effectiveCheckOutTime < breakEnd ? effectiveCheckOutTime : breakEnd;
                    const actualBreakHours = (actualBreakEnd - actualBreakStart) / (1000 * 60 * 60);
                    actualWorkHours = totalTimeHours - Math.max(0, actualBreakHours);
                  }
                }
                if (actualWorkHours < 0) actualWorkHours = 0;
                workHours = actualWorkHours;
                
                if (checkInTime > shiftStart) {
                  lateMinutes = Math.round((checkInTime - shiftStart) / (1000 * 60));
                }
                if (checkOutTime < shiftEnd) {
                  earlyMinutes = Math.round((shiftEnd - checkOutTime) / (1000 * 60));
                }
    } else {
                workHours = (checkOutTime - checkInTime) / (1000 * 60 * 60);
              }
            } else {
              workHours = (checkOutTime - checkInTime) / (1000 * 60 * 60);
            }
          } else {
            workHours = (checkOutTime - checkInTime) / (1000 * 60 * 60);
          }

          const isSufficient = workHours >= (standardWorkHours - 0.1);
          let finalStatus = isSufficient ? 'work' : 'insufficient';
          if (lateMinutes > 0 || earlyMinutes > 0) {
            finalStatus = 'insufficient';
          }

          return {
            status: finalStatus,
            time: `${checkIn} ${checkOut}`,
            type: dayAttendance.status || 'Đi làm',
            attendance: dayAttendance,
            leaveRequest: null,
            workDays: workHours / 8,
            late: lateMinutes,
            early: earlyMinutes
          };
        } else if (dayAttendance.checkInTime) {
          return {
            status: 'incomplete',
            time: `${getTimeString(dayAttendance.checkInTime)} -`,
            type: dayAttendance.status || 'Quên checkout',
            attendance: dayAttendance,
            leaveRequest: null
          };
        } else if (dayAttendance.checkOutTime) {
          return {
            status: 'incomplete',
            time: `- ${getTimeString(dayAttendance.checkOutTime)}`,
            type: dayAttendance.status || 'Quên checkin',
            attendance: dayAttendance,
            leaveRequest: null
          };
        }
      }
      
      const hasShiftAssignment = shiftAssignments?.some(sa => {
        const saDate = new Date(sa.workDate);
        saDate.setHours(0, 0, 0, 0);
        const targetDate = new Date(currentDate);
        targetDate.setHours(0, 0, 0, 0);
        return String(sa.employeeID) === String(employeeId) && 
               saDate.getTime() === targetDate.getTime();
      });
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const currentDateNormalized = new Date(currentDate);
      currentDateNormalized.setHours(0, 0, 0, 0);
      const isPastOrToday = currentDateNormalized.getTime() <= today.getTime();
      
      if (hasShiftAssignment && !dayAttendance && !leaveRequest && isPastOrToday) {
        return { status: 'absent-without-leave', time: '', type: 'Vắng không phép', attendance: null, leaveRequest: null };
      }
      
      return { status: 'absent', time: '', type: 'Vắng mặt', attendance: null, leaveRequest: null };
    });
  };

  const personalAttendanceData = useMemo(() => {
    if (!user || !user.id) return [];
    
    const userAttendanceData = generateAttendanceForEmployee(user.id);
    const daysInMonth = new Date(year, month, 0).getDate();
    
    const firstDayOfMonth = new Date(year, month - 1, 1);
    const lastDayOfMonth = new Date(year, month - 1, daysInMonth);
    const firstSunday = new Date(firstDayOfMonth);
    firstSunday.setDate(firstDayOfMonth.getDate() - firstDayOfMonth.getDay());
    
    const weeks = [];
    let currentDate = new Date(firstSunday);
    
    while (currentDate <= lastDayOfMonth || currentDate.getDay() !== 0) {
      const week = [];
      for (let dayOfWeek = 0; dayOfWeek < 7; dayOfWeek++) {
        const cellDate = new Date(currentDate);
        const day = cellDate.getDate();
        const cellMonth = cellDate.getMonth();
        const cellYear = cellDate.getFullYear();
        const isCurrentMonth = cellMonth === month - 1 && cellYear === year;
        
        const dayData = {
          day: isCurrentMonth ? day : '',
          date: isCurrentMonth ? `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}` : '',
          fullDate: isCurrentMonth ? cellDate : null,
          isCurrentMonth: isCurrentMonth,
          dayOfWeek: dayOfWeek,
          attendance: null
        };
        
        if (isCurrentMonth) {
          const dayIndex = day - 1;
          if (userAttendanceData && userAttendanceData[dayIndex]) {
            const attendanceInfo = userAttendanceData[dayIndex];
            dayData.attendance = {
              status: attendanceInfo.status,
              time: attendanceInfo.time,
              type: attendanceInfo.type,
              class: attendanceInfo.status
            };
          } else {
            dayData.attendance = {
              status: '',
              time: '',
              type: '',
              class: 'empty'
            };
          }
        }
        
        week.push(dayData);
        currentDate.setDate(currentDate.getDate() + 1);
      }
      weeks.push(week);
      
      if (currentDate > lastDayOfMonth && currentDate.getDay() === 0) {
        break;
      }
    }
    
    return weeks;
  }, [user, year, month, attendanceList, leaveRequests, workShifts, shiftAssignments]);

  const personalStatistics = useMemo(() => {
    if (!user || !user.id) {
      return {
        totalWorkDays: 0,
        totalLeave: 0,
        totalInsufficient: 0,
        totalIncomplete: 0,
        totalAbsentWithoutLeave: 0,
        totalDays: 0
      };
    }

    const employeeId = user.id;
    const monthStart = new Date(year, month - 1, 1);
    const monthEnd = new Date(year, month, 0, 23, 59, 59);
    const daysInMonth = new Date(year, month, 0).getDate();

    const stats = {
      totalWorkDays: 0,
      totalLeave: 0,
      totalInsufficient: 0,
      totalIncomplete: 0,
      totalAbsentWithoutLeave: 0,
      totalDays: daysInMonth
    };

    if (attendanceList && attendanceList.length > 0) {
      const employeeAttendance = attendanceList.filter(att => matchEmployee(att, employeeId));
      const attendanceByDate = new Map();
      
      employeeAttendance.forEach(att => {
        const workDate = new Date(att.workDate);
        workDate.setHours(0, 0, 0, 0);
        
        if (workDate >= monthStart && workDate <= monthEnd) {
          const dateKey = workDate.getTime();
          if (!attendanceByDate.has(dateKey)) {
            attendanceByDate.set(dateKey, {
              checkInTime: null,
              checkOutTime: null,
              workShiftID: null,
              workDate: workDate,
              records: []
            });
          }
          const dayData = attendanceByDate.get(dateKey);
          dayData.records.push(att);
          if (att.checkInTime && !dayData.checkInTime) dayData.checkInTime = att.checkInTime;
          if (att.checkOutTime && !dayData.checkOutTime) dayData.checkOutTime = att.checkOutTime;
          if (att.workShiftID && !dayData.workShiftID) dayData.workShiftID = att.workShiftID;
        }
      });
      
      attendanceByDate.forEach((dayData) => {
        if (dayData.checkInTime && dayData.checkOutTime) {
          const attRecord = {
            checkInTime: dayData.checkInTime,
            checkOutTime: dayData.checkOutTime,
            workShiftID: dayData.workShiftID,
            workDate: dayData.workDate
          };
          const result = calculateWorkDaysFromAttendanceData(attRecord);
          if (result.actualWorkHours > 0) {
            let isSufficient = false;
            if (dayData.workShiftID) {
              const workShift = workShifts.find(shift => shift.id === dayData.workShiftID);
              if (workShift && workShift.shiftDetails) {
                const dayOfWeek = dayData.workDate.getDay();
                const dayNames = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];
                const currentDayName = dayNames[dayOfWeek];
                const dayShiftDetail = workShift.shiftDetails.find(detail => detail.dayOfWeek === currentDayName);
                if (dayShiftDetail && dayShiftDetail.startTime !== '00:00:00' && dayShiftDetail.endTime !== '00:00:00') {
                  const shiftStart = new Date(`2000-01-01T${dayShiftDetail.startTime}`);
                  const shiftEnd = new Date(`2000-01-01T${dayShiftDetail.endTime}`);
                  let standardWorkHours = (shiftEnd - shiftStart) / (1000 * 60 * 60);
                  if (dayShiftDetail.breakStart && dayShiftDetail.breakEnd && 
                      dayShiftDetail.breakStart !== '00:00:00' && dayShiftDetail.breakEnd !== '00:00:00') {
                    const breakStart = new Date(`2000-01-01T${dayShiftDetail.breakStart}`);
                    const breakEnd = new Date(`2000-01-01T${dayShiftDetail.breakEnd}`);
                    const breakHours = (breakEnd - breakStart) / (1000 * 60 * 60);
                    standardWorkHours -= breakHours;
                  }
                  isSufficient = result.actualWorkHours >= (standardWorkHours - 0.1);
      } else {
                  isSufficient = result.actualWorkHours >= 7.9;
                }
              } else {
                isSufficient = result.actualWorkHours >= 7.9;
              }
            } else {
              isSufficient = result.actualWorkHours >= 7.9;
            }
            if (isSufficient) {
              stats.totalWorkDays += 1;
            } else {
              stats.totalInsufficient += 1;
            }
          }
        } else if (dayData.checkInTime && !dayData.checkOutTime) {
          stats.totalIncomplete += 1;
        } else if (!dayData.checkInTime && dayData.checkOutTime) {
          stats.totalIncomplete += 1;
        }
      });
    }

    if (leaveRequests && leaveRequests.length > 0) {
      const monthStartDate = new Date(monthStart);
      monthStartDate.setHours(0, 0, 0, 0);
      const monthEndDate = new Date(monthEnd);
      monthEndDate.setHours(0, 0, 0, 0);
      
      const attendanceDates = new Set();
      if (attendanceList && attendanceList.length > 0) {
        const employeeAttendance = attendanceList.filter(att => matchEmployee(att, employeeId));
        employeeAttendance.forEach(att => {
          if (att.checkInTime && att.checkOutTime) {
            const workDate = new Date(att.workDate);
            workDate.setHours(0, 0, 0, 0);
            attendanceDates.add(workDate.getTime());
          }
        });
      }

      const dayLeaveMap = new Map();
      leaveRequests.forEach(leave => {
        if (String(leave.employeeID) !== String(employeeId)) return;
        const leaveStart = new Date(leave.startDateTime);
        const leaveEnd = new Date(leave.endDateTime);
        if (leaveStart > monthEndDate || leaveEnd < monthStartDate) return;
        
        const leaveTypeName = (leave.leaveTypeName || '').toLowerCase();
        const isPaidLeave = (leaveTypeName.includes('phép năm') || 
                            leaveTypeName.includes('phép có lương')) &&
                            !leaveTypeName.includes('nghỉ bù') &&
                            !leaveTypeName.includes('bù');
        
        if (isPaidLeave && isApproved(leave.approveStatus)) {
          const startDate = new Date(leaveStart > monthStartDate ? leaveStart : monthStartDate);
          startDate.setHours(0, 0, 0, 0);
          const endDate = new Date(leaveEnd < monthEndDate ? leaveEnd : monthEndDate);
          endDate.setHours(0, 0, 0, 0);
          
          for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
            const dateKey = new Date(d);
            dateKey.setHours(0, 0, 0, 0);
            if (dateKey >= monthStartDate && dateKey <= monthEndDate) {
              if (!attendanceDates.has(dateKey.getTime())) {
                const dayString = `${dateKey.getFullYear()}-${String(dateKey.getMonth() + 1).padStart(2, '0')}-${String(dateKey.getDate()).padStart(2, '0')}`;
                const dayStart = new Date(dateKey.getFullYear(), dateKey.getMonth(), dateKey.getDate());
                const dayEnd = new Date(dateKey.getFullYear(), dateKey.getMonth(), dateKey.getDate(), 23, 59, 59, 999);
                const requestStartOnDay = leaveStart > dayStart ? leaveStart : dayStart;
                const requestEndOnDay = leaveEnd < dayEnd ? leaveEnd : dayEnd;
                const dayDuration = requestEndOnDay - requestStartOnDay;
                if (!dayLeaveMap.has(dayString) || dayLeaveMap.get(dayString).duration < dayDuration) {
                  dayLeaveMap.set(dayString, { leave, duration: dayDuration });
                }
              }
            }
          }
        }
      });
      stats.totalLeave = dayLeaveMap.size;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const attendanceDates = new Set();
    if (attendanceList && attendanceList.length > 0) {
      const employeeAttendance = attendanceList.filter(att => matchEmployee(att, employeeId));
      employeeAttendance.forEach(att => {
        const workDate = new Date(att.workDate);
        workDate.setHours(0, 0, 0, 0);
        if (workDate >= monthStart && workDate <= monthEnd) {
          attendanceDates.add(workDate.getTime());
        }
      });
    }
    
    const leaveDates = new Set();
    if (leaveRequests && leaveRequests.length > 0) {
      const monthStartDate = new Date(monthStart);
      monthStartDate.setHours(0, 0, 0, 0);
      const monthEndDate = new Date(monthEnd);
      monthEndDate.setHours(0, 0, 0, 0);
      leaveRequests.forEach(leave => {
        if (String(leave.employeeID) !== String(employeeId)) return;
        const leaveStart = new Date(leave.startDateTime);
        const leaveEnd = new Date(leave.endDateTime);
        if (leaveStart > monthEndDate || leaveEnd < monthStartDate) return;
        if (isApproved(leave.approveStatus)) {
          const startDate = new Date(leaveStart > monthStartDate ? leaveStart : monthStartDate);
          startDate.setHours(0, 0, 0, 0);
          const endDate = new Date(leaveEnd < monthEndDate ? leaveEnd : monthEndDate);
          endDate.setHours(0, 0, 0, 0);
          for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
            const dateKey = new Date(d);
            dateKey.setHours(0, 0, 0, 0);
            if (dateKey >= monthStartDate && dateKey <= monthEndDate) {
              leaveDates.add(dateKey.getTime());
            }
          }
        }
      });
    }
    
    for (let day = 1; day <= daysInMonth; day++) {
      const currentDate = new Date(year, month - 1, day);
      currentDate.setHours(0, 0, 0, 0);
      const isPastOrToday = currentDate.getTime() <= today.getTime();
      if (!isPastOrToday) continue;
      
      const hasShiftAssignment = shiftAssignments?.some(sa => {
        const saDate = new Date(sa.workDate);
        saDate.setHours(0, 0, 0, 0);
        return String(sa.employeeID) === String(employeeId) && saDate.getTime() === currentDate.getTime();
      });
      if (!hasShiftAssignment) continue;
      
      const hasAttendance = attendanceDates.has(currentDate.getTime());
      const hasLeave = leaveDates.has(currentDate.getTime());
      if (!hasAttendance && !hasLeave) {
        stats.totalAbsentWithoutLeave += 1;
      }
    }

    return stats;
  }, [user, year, month, attendanceList, leaveRequests, workShifts, shiftAssignments]);

  const loadDayModalData = async (employeeId, dateStr) => {
    try {
      setDayModalLoading(true);
      setDayModalError(null);
      
      // Load attendance data from API - use raw API call to get full data
      let attendanceData = [];
      try {
        const response = await api.get('/AttendanceData/employee/date', {
          params: {
            employeeCode: employeeId,
            date: dateStr
          }
        });
        attendanceData = response.data || [];
      } catch (error) {
        console.error('Error loading attendance data:', error);
      }
      
      // Transform attendance data - group check-in and check-out together
      const transformedAttendanceData = [];
      let sttCounter = 1;
      
      if (attendanceData && attendanceData.length > 0) {
        attendanceData.forEach((item) => {
          // Group check-in and check-out into one entry
          // Priority: location (from CheckInLocation) > checkInLocation > checkOutLocation > machineName
          const machineLocation = item.location || item.checkInLocation || item.checkOutLocation || item.machineName || '-';
          transformedAttendanceData.push({
            stt: sttCounter++,
            shiftName: item.shiftName || 'N/A',
            refCode: item.refCode || '-',
            date: formatDate(item.workDate || dateStr),
            checkInTime: item.checkInTime ? formatTime(item.checkInTime) : null,
            checkOutTime: item.checkOutTime ? formatTime(item.checkOutTime) : null,
            location: machineLocation,
            workShiftID: item.workShiftID,
          });
        });
      }
      
      // Load leave requests for this date
      const dayLeaveRequests = leaveRequests.filter(leave => {
        if (String(leave.employeeID) !== String(employeeId)) return false;
        const leaveStart = new Date(leave.startDateTime);
        const leaveEnd = new Date(leave.endDateTime);
        const targetDate = new Date(dateStr);
        
        leaveStart.setHours(0, 0, 0, 0);
        leaveEnd.setHours(0, 0, 0, 0);
        targetDate.setHours(0, 0, 0, 0);
        
        return targetDate.getTime() >= leaveStart.getTime() && targetDate.getTime() <= leaveEnd.getTime();
      });
      
      // Add leave requests to attendance data - group into one entry
      dayLeaveRequests.forEach(leave => {
        const leaveWorkShift = workShifts.find(shift => shift.id === leave.workShiftID);
        
        transformedAttendanceData.push({
          stt: sttCounter++,
          shiftName: `${leave.leaveTypeName || 'Nghỉ phép'} (${leaveWorkShift?.shiftName || 'N/A'})`,
          refCode: leave.voucherCode || `MP${leave.id}`,
          date: formatDate(dateStr),
          checkInTime: formatTime(leave.startDateTime),
          checkOutTime: formatTime(leave.endDateTime),
          location: 'Nghỉ phép',
          isLeave: true,
        });
      });
      
      setDayDetailData(transformedAttendanceData);
      
      // Calculate work history - group by workShiftID
      const workHistoryMap = new Map();
      if (attendanceData && attendanceData.length > 0) {
        attendanceData.forEach((item) => {
          if (item.checkInTime && item.checkOutTime) {
            const workShiftId = item.workShiftID;
            const workShift = workShifts.find(shift => shift.id === workShiftId);
            
            if (!workHistoryMap.has(workShiftId)) {
              const checkIn = formatTime(item.checkInTime);
              const checkOut = formatTime(item.checkOutTime);
              const scanInOut = `Vào: ${checkIn}, Ra: ${checkOut}`;
              
              let totalWorkHours = 8;
              let standardWorkDays = 1;
              let actualWorkHours = 8;
              let workDays = 1;
              let lateEarly = '-';
              let shiftStart = null;
              let shiftEnd = null;
              
              if (workShift && workShift.shiftDetails) {
                const workDate = new Date(item.workDate || dateStr);
                const dayOfWeek = workDate.getDay();
                const dayNames = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];
                const currentDayName = dayNames[dayOfWeek];
                const dayShiftDetail = workShift.shiftDetails.find(detail => detail.dayOfWeek === currentDayName);
                
                if (dayShiftDetail && dayShiftDetail.startTime !== '00:00:00' && dayShiftDetail.endTime !== '00:00:00') {
                  shiftStart = new Date(`2000-01-01T${dayShiftDetail.startTime}`);
                  shiftEnd = new Date(`2000-01-01T${dayShiftDetail.endTime}`);
                  
                  // Tính giờ công chuẩn
                  totalWorkHours = (shiftEnd - shiftStart) / (1000 * 60 * 60);
                  
                  if (dayShiftDetail.breakStart && dayShiftDetail.breakEnd && 
                      dayShiftDetail.breakStart !== '00:00:00' && dayShiftDetail.breakEnd !== '00:00:00') {
                    const breakStart = new Date(`2000-01-01T${dayShiftDetail.breakStart}`);
                    const breakEnd = new Date(`2000-01-01T${dayShiftDetail.breakEnd}`);
                    const breakHours = (breakEnd - breakStart) / (1000 * 60 * 60);
                    totalWorkHours -= breakHours;
                  }
                  
                  // Tính ngày công chuẩn
                  standardWorkDays = (totalWorkHours / 8).toFixed(2);
                  
                  // Tính toán effective check-in/check-out time
                  const checkInTime = new Date(`2000-01-01T${item.checkInTime}`);
                  const checkOutTime = new Date(`2000-01-01T${item.checkOutTime}`);
                  const effectiveCheckInTime = checkInTime < shiftStart ? shiftStart : checkInTime;
                  const effectiveCheckOutTime = checkOutTime < shiftEnd ? checkOutTime : shiftEnd;
                  
                  // Tính tổng số giờ
                  let totalTimeHours = (effectiveCheckOutTime - effectiveCheckInTime) / (1000 * 60 * 60);
                  if (totalTimeHours < 0) {
                    totalTimeHours = 0;
                  }
                  
                  // Trừ giờ nghỉ trưa nếu nằm trong thời gian làm việc
                  actualWorkHours = totalTimeHours;
                  if (dayShiftDetail.breakStart && dayShiftDetail.breakEnd && 
                      dayShiftDetail.breakStart !== '00:00:00' && dayShiftDetail.breakEnd !== '00:00:00') {
                    const breakStart = new Date(`2000-01-01T${dayShiftDetail.breakStart}`);
                    const breakEnd = new Date(`2000-01-01T${dayShiftDetail.breakEnd}`);
                    if (effectiveCheckInTime <= breakEnd && effectiveCheckOutTime >= breakStart) {
                      const actualBreakStart = effectiveCheckInTime > breakStart ? effectiveCheckInTime : breakStart;
                      const actualBreakEnd = effectiveCheckOutTime < breakEnd ? effectiveCheckOutTime : breakEnd;
                      const actualBreakHours = (actualBreakEnd - actualBreakStart) / (1000 * 60 * 60);
                      actualWorkHours = totalTimeHours - Math.max(0, actualBreakHours);
                    }
                  }
                  
                  if (actualWorkHours < 0) {
                    actualWorkHours = 0;
                  }
                  
                  // Tính ngày công: luôn chia cho 8 giờ chuẩn
                  workDays = Math.round((actualWorkHours / 8) * 100) / 100;
                  
                  // Tính số phút đi trễ/về sớm
                  const lateMinutes = Math.max(0, (checkInTime - shiftStart) / (1000 * 60));
                  const earlyMinutes = Math.max(0, (shiftEnd - checkOutTime) / (1000 * 60));
                  
                  if (lateMinutes > 0 || earlyMinutes > 0) {
                    lateEarly = `Đi trễ: ${Math.round(lateMinutes)} phút, Về sớm: ${Math.round(earlyMinutes)} phút`;
                  } else {
                    lateEarly = 'Đi trễ: 0 phút, Về sớm: 0 phút';
                  }
                } else {
                  // Fallback: không có shift details
                  const result = calculateWorkDaysFromAttendanceData({
                    checkInTime: item.checkInTime,
                    checkOutTime: item.checkOutTime,
                    workShiftID: item.workShiftID,
                    workDate: item.workDate || dateStr
                  });
                  actualWorkHours = result.actualWorkHours;
                  workDays = result.workDays;
                  totalWorkHours = result.standardWorkHours;
                  standardWorkDays = (totalWorkHours / 8).toFixed(2);
                }
              } else {
                // Fallback: không có work shift
                const result = calculateWorkDaysFromAttendanceData({
                  checkInTime: item.checkInTime,
                  checkOutTime: item.checkOutTime,
                  workShiftID: item.workShiftID,
                  workDate: item.workDate || dateStr
                });
                actualWorkHours = result.actualWorkHours;
                workDays = result.workDays;
                totalWorkHours = result.standardWorkHours;
                standardWorkDays = (totalWorkHours / 8).toFixed(2);
              }
              
              workHistoryMap.set(workShiftId, {
                stt: workHistoryMap.size + 1,
                shiftName: item.shiftName || workShift?.shiftName || 'N/A',
                workShiftID: workShiftId,
                standard: `${totalWorkHours.toFixed(2)}/${standardWorkDays}`,
                scanInOut,
                lateEarly,
                workHour: `${actualWorkHours.toFixed(2)}/${workDays.toFixed(2)}`,
              });
            }
          }
        });
      }
      
      // Thêm dữ liệu nghỉ phép vào work history
      // Loại bỏ trùng lặp: chỉ giữ đơn có thời gian nghỉ dài hơn trong ngày
      const processedLeavesForWork = new Map();
      
      if (dayLeaveRequests && dayLeaveRequests.length > 0) {
        dayLeaveRequests.forEach(leave => {
          const leaveWorkShiftId = leave.workShiftID;
          const selectedDate = new Date(dateStr);
          const leaveStartDate = new Date(leave.startDateTime);
          const leaveEndDate = new Date(leave.endDateTime);
          
          // Tính thời gian nghỉ trong ngày này
          let dayStart = new Date(selectedDate);
          dayStart.setHours(0, 0, 0, 0);
          let dayEnd = new Date(selectedDate);
          dayEnd.setHours(23, 59, 59, 999);
          
          const leaveStartInDay = leaveStartDate > dayStart ? leaveStartDate : dayStart;
          const leaveEndInDay = leaveEndDate < dayEnd ? leaveEndDate : dayEnd;
          const leaveDurationInDay = leaveEndInDay - leaveStartInDay;
          
          // Nếu chưa có đơn nào cho ca này, hoặc đơn này có thời gian dài hơn
          if (!processedLeavesForWork.has(leaveWorkShiftId) || 
              processedLeavesForWork.get(leaveWorkShiftId).duration < leaveDurationInDay) {
            processedLeavesForWork.set(leaveWorkShiftId, { leave, duration: leaveDurationInDay });
          }
        });
      }
      
      // Chuyển đổi Map thành array
      const finalDayLeaveRequestsForWork = Array.from(processedLeavesForWork.values()).map(item => item.leave);
      
      // Xử lý nghỉ phép: merge vào ca làm việc đã có hoặc tạo mới nếu chưa có
      finalDayLeaveRequestsForWork.forEach(leave => {
        const leaveWorkShiftId = leave.workShiftID;
        const leaveWorkShiftInfo = workShifts.find(shift => shift.id === leaveWorkShiftId);
        
        // Tính ngày công sử dụng hàm chung
        const selectedDate = new Date(dateStr);
        const leaveResult = calculateWorkDaysFromLeaveRequest(leave, selectedDate, leaveWorkShiftInfo);
        const leaveWorkDays = typeof leaveResult === 'object' ? leaveResult.workDays : leaveResult;
        const leaveWorkHours = typeof leaveResult === 'object' ? leaveResult.actualWorkHours : (leaveWorkDays * 8);
        const leaveStandardWorkHours = typeof leaveResult === 'object' ? leaveResult.standardWorkHours : 8;
        
        // Lấy thông tin chi tiết ca làm việc
        let leaveShiftStart = null;
        let leaveShiftEnd = null;
        let leaveScanInOut = 'Vào: --:--, Ra: --:--';
        let leaveLateEarly = 'Nghỉ phép';
        
        const leaveStartDate = new Date(leave.startDateTime);
        leaveStartDate.setHours(0, 0, 0, 0);
        const leaveEndDate = new Date(leave.endDateTime);
        leaveEndDate.setHours(0, 0, 0, 0);
        const currentLeaveDate = new Date(selectedDate);
        currentLeaveDate.setHours(0, 0, 0, 0);
        
        let leaveDayShiftDetail = null;
        if (leaveWorkShiftInfo && leaveWorkShiftInfo.shiftDetails) {
          const selectedDayOfWeek = selectedDate.getDay();
          const dayNames = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];
          const selectedDayName = dayNames[selectedDayOfWeek];
          
          leaveDayShiftDetail = leaveWorkShiftInfo.shiftDetails.find(detail => detail.dayOfWeek === selectedDayName);
          
          if (leaveDayShiftDetail && leaveDayShiftDetail.startTime !== '00:00:00' && leaveDayShiftDetail.endTime !== '00:00:00') {
            leaveShiftStart = new Date(`2000-01-01T${leaveDayShiftDetail.startTime}`);
            leaveShiftEnd = new Date(`2000-01-01T${leaveDayShiftDetail.endTime}`);
          }
        }
        
        // Xác định thời gian quét vào/ra dựa trên khoảng nghỉ phép
        if (leaveStartDate.getTime() === leaveEndDate.getTime()) {
          // Single day leave
          const leaveStartTime = new Date(leave.startDateTime);
          const leaveEndTime = new Date(leave.endDateTime);
          leaveScanInOut = `Vào: ${leaveStartTime.toTimeString().substring(0, 5)}, Ra: ${leaveEndTime.toTimeString().substring(0, 5)}`;
          
          if (leaveShiftStart && leaveShiftEnd) {
            const leaveStartTimeOnly = new Date(`2000-01-01T${leaveStartTime.toTimeString().substring(0, 8)}`);
            const leaveEndTimeOnly = new Date(`2000-01-01T${leaveEndTime.toTimeString().substring(0, 8)}`);
            const lateMinutes = Math.max(0, (leaveStartTimeOnly - leaveShiftStart) / (1000 * 60));
            const earlyMinutes = Math.max(0, (leaveShiftEnd - leaveEndTimeOnly) / (1000 * 60));
            leaveLateEarly = `Đi trễ: ${Math.round(lateMinutes)} phút, Về sớm: ${Math.round(earlyMinutes)} phút`;
          } else {
            leaveLateEarly = 'Đi trễ: 0 phút, Về sớm: 0 phút';
          }
        } else {
          // Multi-day leave
          if (currentLeaveDate.getTime() === leaveStartDate.getTime()) {
            // Start day
            const leaveStartTime = new Date(leave.startDateTime);
            let shiftEndTimeStr = null;
            
            if (leaveDayShiftDetail && leaveDayShiftDetail.endTime && leaveDayShiftDetail.endTime !== '00:00:00') {
              shiftEndTimeStr = leaveDayShiftDetail.endTime.substring(0, 5);
            } else if (leaveShiftEnd) {
              const shiftEndHours = String(leaveShiftEnd.getHours()).padStart(2, '0');
              const shiftEndMinutes = String(leaveShiftEnd.getMinutes()).padStart(2, '0');
              shiftEndTimeStr = `${shiftEndHours}:${shiftEndMinutes}`;
            } else {
              shiftEndTimeStr = '17:00';
            }
            
            leaveScanInOut = `Vào: ${leaveStartTime.toTimeString().substring(0, 5)}, Ra: ${shiftEndTimeStr}`;
            
            if (leaveShiftStart) {
              const leaveStartTimeOnly = new Date(`2000-01-01T${leaveStartTime.toTimeString().substring(0, 8)}`);
              const lateMinutes = Math.max(0, (leaveStartTimeOnly - leaveShiftStart) / (1000 * 60));
              leaveLateEarly = `Đi trễ: ${Math.round(lateMinutes)} phút, Về sớm: 0 phút`;
            } else {
              leaveLateEarly = 'Đi trễ: 0 phút, Về sớm: 0 phút';
            }
          } else if (currentLeaveDate.getTime() === leaveEndDate.getTime()) {
            // End day
            const leaveEndTime = new Date(leave.endDateTime);
            
            if (leaveDayShiftDetail && leaveDayShiftDetail.startTime !== '00:00:00') {
              leaveScanInOut = `Vào: ${leaveDayShiftDetail.startTime.substring(0, 5)}, Ra: ${leaveEndTime.toTimeString().substring(0, 5)}`;
            } else {
              const leaveStartTime = new Date(leave.startDateTime);
              leaveScanInOut = `Vào: ${leaveStartTime.toTimeString().substring(0, 5)}, Ra: ${leaveEndTime.toTimeString().substring(0, 5)}`;
            }
            
            if (leaveShiftEnd) {
              const leaveEndTimeOnly = new Date(`2000-01-01T${leaveEndTime.toTimeString().substring(0, 8)}`);
              const earlyMinutes = Math.max(0, (leaveShiftEnd - leaveEndTimeOnly) / (1000 * 60));
              leaveLateEarly = `Đi trễ: 0 phút, Về sớm: ${Math.round(earlyMinutes)} phút`;
            } else {
              leaveLateEarly = 'Đi trễ: 0 phút, Về sớm: 0 phút';
            }
          } else {
            // Middle day
            if (leaveDayShiftDetail && leaveDayShiftDetail.startTime !== '00:00:00' && leaveDayShiftDetail.endTime !== '00:00:00') {
              leaveScanInOut = `Vào: ${leaveDayShiftDetail.startTime.substring(0, 5)}, Ra: ${leaveDayShiftDetail.endTime.substring(0, 5)}`;
              leaveLateEarly = 'Đi trễ: 0 phút, Về sớm: 0 phút';
            } else {
              const leaveStartTime = new Date(leave.startDateTime);
              const leaveEndTime = new Date(leave.endDateTime);
              leaveScanInOut = `Vào: ${leaveStartTime.toTimeString().substring(0, 5)}, Ra: ${leaveEndTime.toTimeString().substring(0, 5)}`;
              
              if (leaveShiftStart && leaveShiftEnd) {
                const leaveStartTimeOnly = new Date(`2000-01-01T${leaveStartTime.toTimeString().substring(0, 8)}`);
                const leaveEndTimeOnly = new Date(`2000-01-01T${leaveEndTime.toTimeString().substring(0, 8)}`);
                const lateMinutes = Math.max(0, (leaveStartTimeOnly - leaveShiftStart) / (1000 * 60));
                const earlyMinutes = Math.max(0, (leaveShiftEnd - leaveEndTimeOnly) / (1000 * 60));
                leaveLateEarly = `Đi trễ: ${Math.round(lateMinutes)} phút, Về sớm: ${Math.round(earlyMinutes)} phút`;
              } else {
                leaveLateEarly = 'Đi trễ: 0 phút, Về sớm: 0 phút';
              }
            }
          }
        }
        
        // Tìm dòng ca làm việc tương ứng
        const existingWorkRow = Array.from(workHistoryMap.values()).find(work => 
          work.workShiftID === leaveWorkShiftId
        );
        
        // Tính công chuẩn và giờ/ngày công
        const standardWorkDays = leaveStandardWorkHours > 0 ? (leaveStandardWorkHours / 8) : 1;
        const standardDisplay = `${leaveStandardWorkHours.toFixed(2)}/${standardWorkDays.toFixed(2)}`;
        const workHourDisplay = `${leaveWorkHours.toFixed(2)}/${leaveWorkDays.toFixed(2)}`;
        
        if (existingWorkRow) {
          // Cập nhật thông tin nghỉ phép vào dòng đã có
          existingWorkRow.scanInOut = leaveScanInOut;
          existingWorkRow.lateEarly = leaveLateEarly;
          existingWorkRow.workHour = workHourDisplay;
          existingWorkRow.standard = standardDisplay;
          if (existingWorkRow.shiftName && !existingWorkRow.shiftName.includes('Phép năm')) {
            // Giữ nguyên tên ca
          } else {
            existingWorkRow.shiftName = leaveWorkShiftInfo?.shiftName || 'N/A';
          }
        } else {
          // Chỉ tạo dòng mới nếu chưa có ca làm việc nào với workShiftID này
          const alreadyAdded = Array.from(workHistoryMap.values()).some(work => work.workShiftID === leaveWorkShiftId);
          if (!alreadyAdded) {
            workHistoryMap.set(leaveWorkShiftId, {
              stt: workHistoryMap.size + 1,
              shiftName: leaveWorkShiftInfo?.shiftName || 'N/A',
              workShiftID: leaveWorkShiftId,
              standard: standardDisplay,
              scanInOut: leaveScanInOut,
              lateEarly: leaveLateEarly,
              workHour: workHourDisplay,
            });
          }
        }
      });
      
      // Thêm ca làm việc đã phân nhưng chưa có attendance (không chấm công)
      const dayShiftAssignments = shiftAssignments.filter(sa => {
        const assignmentDate = new Date(sa.workDate).toDateString();
        const targetDate = new Date(dateStr).toDateString();
        return sa.employeeID === employeeId && assignmentDate === targetDate;
      });
      
      dayShiftAssignments.forEach(assignment => {
        // Kiểm tra xem đã có attendance cho ca này chưa
        const hasAttendanceInAPI = attendanceData && attendanceData.some(att => 
          att.workShiftID === assignment.workShiftID
        );
        
        const hasAttendanceInWorkData = Array.from(workHistoryMap.values()).some(work => 
          work.workShiftID === assignment.workShiftID
        );
        
        // Chỉ hiển thị trong "Lịch làm việc" nếu chưa có attendance cho ca này
        if (!hasAttendanceInAPI && !hasAttendanceInWorkData) {
          const workShift = workShifts.find(ws => ws.id === assignment.workShiftID);
          
          if (workShift) {
            const selectedDate = new Date(dateStr);
            const dayOfWeek = selectedDate.getDay();
            const dayNames = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];
            const currentDayName = dayNames[dayOfWeek];
            
            const dayShiftDetail = workShift.shiftDetails?.find(detail => detail.dayOfWeek === currentDayName);
            
            let standardHours = 8.00;
            let standardDays = 1.00;
            let scanInOut = 'Vào: --:--, Ra: --:--';
            
            if (dayShiftDetail && dayShiftDetail.startTime !== '00:00:00' && dayShiftDetail.endTime !== '00:00:00') {
              const startTime = new Date(`2000-01-01T${dayShiftDetail.startTime}`);
              const endTime = new Date(`2000-01-01T${dayShiftDetail.endTime}`);
              
              let workHours = (endTime - startTime) / (1000 * 60 * 60);
              
              if (dayShiftDetail.breakStart && dayShiftDetail.breakEnd && 
                  dayShiftDetail.breakStart !== '00:00:00' && dayShiftDetail.breakEnd !== '00:00:00') {
                const breakStart = new Date(`2000-01-01T${dayShiftDetail.breakStart}`);
                const breakEnd = new Date(`2000-01-01T${dayShiftDetail.breakEnd}`);
                const breakHours = (breakEnd - breakStart) / (1000 * 60 * 60);
                workHours -= breakHours;
              }
              
              standardHours = workHours;
              standardDays = Math.round((workHours / 8) * 100) / 100;
            }
            
            // Kiểm tra xem đã có dòng với workShiftID này chưa
            const existingRow = Array.from(workHistoryMap.values()).find(work => work.workShiftID === assignment.workShiftID);
            if (!existingRow) {
              workHistoryMap.set(assignment.workShiftID, {
                stt: workHistoryMap.size + 1,
                shiftName: workShift.shiftName,
                workShiftID: assignment.workShiftID,
                standard: `${standardHours.toFixed(2)}/${standardDays.toFixed(2)}`,
                scanInOut: scanInOut,
                lateEarly: 'Chưa chấm công',
                workHour: '0.00/0.00',
              });
            }
          }
        }
      });
      
      // Thêm thông tin nghỉ phép cho tất cả các ngày trong khoảng nghỉ (nếu chưa có dữ liệu gì)
      if (workHistoryMap.size === 0 && finalDayLeaveRequestsForWork.length > 0) {
        finalDayLeaveRequestsForWork.forEach(leave => {
          workHistoryMap.set(leave.workShiftID || 'leave-' + leave.id, {
            stt: workHistoryMap.size + 1,
            shiftName: 'Nghỉ phép',
            workShiftID: leave.workShiftID || null,
            standard: '0.00/0.00',
            scanInOut: 'Vào: --:--, Ra: --:--',
            lateEarly: 'Nghỉ phép',
            workHour: '0.00/0.00',
          });
        });
      }
      
      const workHistory = Array.from(workHistoryMap.values());
      
      setWorkHistoryData(workHistory);
    } catch (error) {
      console.error('Error loading day modal data:', error);
      setDayModalError(error.message || 'Không thể tải dữ liệu chi tiết ngày công');
      setDayDetailData([]);
      setWorkHistoryData([]);
    } finally {
      setDayModalLoading(false);
    }
  };

  const handleDayPress = async (dayData) => {
    if (!dayData.isCurrentMonth || !dayData.day || !user) return;
    
    setSelectedDay(dayData);
    setModalVisible(true);
    
    // Find employee info
    const employee = employees.find(emp => String(emp.id) === String(user.id)) || user;
    setSelectedEmployee({
      ...employee,
      name: employee.employeeName || employee.name || `${employee.firstName || ''} ${employee.lastName || ''}`.trim() || 'N/A',
      position: employee.roleName || employee.position || employee.title || 'Chưa có',
    });
    
    // Load data
    const currentDate = new Date(year, month - 1, dayData.day);
    const dateStr = formatDateToString(currentDate);
    await loadDayModalData(user.id, dateStr);
  };

  const adjustMonth = (direction) => {
    if (direction === 'prev') {
      if (month === 1) {
        setMonth(12);
        setYear(year - 1);
      } else {
        setMonth(month - 1);
      }
    } else {
      if (month === 12) {
        setMonth(1);
        setYear(year + 1);
      } else {
        setMonth(month + 1);
      }
    }
  };

  const handlePreviousMonth = () => adjustMonth('prev');
  const handleNextMonth = () => adjustMonth('next');
  
  const goToCurrentMonth = () => {
    const now = new Date();
    setMonth(now.getMonth() + 1);
    setYear(now.getFullYear());
  };

  const getPersonalCellClass = (status) => {
    switch (status) {
      case 'work':
        return { bg: '#e8f5e9', color: '#43a047', border: '#43a047' };
      case 'leave':
        return { bg: '#e3f2fd', color: '#3498db', border: '#3498db' };
      case 'insufficient':
        return { bg: '#fff8e1', color: '#ffc107', border: '#ffc107' };
      case 'incomplete':
        return { bg: '#ffebee', color: '#e53935', border: '#e53935' };
      case 'absent-without-leave':
        return { bg: '#f5f5f5', color: '#6c757d', border: '#6c757d' };
      case 'absent':
        return { bg: '#f5f5f5', color: '#bdbdbd', border: '#bdbdbd' };
      default:
        return { bg: '#f5f5f5', color: '#bdbdbd', border: '#bdbdbd' };
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return '';
      return date.toLocaleDateString('vi-VN');
    } catch {
      return '';
    }
  };

  const getTypeColor = (type) => {
    switch (type) {
      case 'ĐiLam':
      case 'Về':
        return '#43a047';
      case 'Đi trễ':
      case 'Về sớm':
        return '#e53935';
      default:
        return '#3498db';
    }
  };

  if (loading || attendanceLoading || leaveLoading || workShiftLoading) {
    return (
      <View style={styles.container}>
        <CustomHeader title="Tổng kết chấm công" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3498db" />
          <Text style={styles.loadingText}>Đang tải dữ liệu...</Text>
        </View>
      </View>
    );
  }

  if (attendanceError) {
    return (
      <View style={styles.container}>
        <CustomHeader title="Tổng kết chấm công" />
        <View style={styles.errorContainer}>
          <Icon name="alert-circle" size={64} color="#e53935" />
          <Text style={styles.errorText}>{attendanceError}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={loadAllData}>
            <Text style={styles.retryButtonText}>Thử lại</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const weekdays = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

  const summaryData = [
    { label: 'Tổng ngày công', value: (personalStatistics.totalWorkDays + personalStatistics.totalLeave).toString() },
    { label: 'Ngày đi làm', value: personalStatistics.totalWorkDays.toString() },
    { label: 'Nghỉ có lương', value: personalStatistics.totalLeave.toString() },
    { label: 'Chưa đủ giờ', value: personalStatistics.totalInsufficient.toString() },
    { label: 'Quên checkin/out', value: personalStatistics.totalIncomplete.toString() },
    { label: 'Vắng không phép', value: personalStatistics.totalAbsentWithoutLeave.toString() },
  ];

  return (
    <View style={styles.container}>
      <CustomHeader title="Tổng kết chấm công" />
        <ScrollView>
          {/* Month Navigation Card */}
          <View style={styles.monthCard}>
            <TouchableOpacity 
              style={styles.navButton} 
              onPress={handlePreviousMonth}
              activeOpacity={0.7}
            >
              <Icon name="chevron-left" size={24} color="white" />
            </TouchableOpacity>
            <View style={styles.monthInfo}>
              <Icon name="calendar-month" size={20} color="white" style={{ marginRight: 8 }} />
              <Text style={styles.monthText}>
                Tháng {month < 10 ? `0${month}` : month}/{year}
              </Text>
            </View>
            <View style={styles.monthNavRight}>
              <TouchableOpacity 
                style={styles.navButton} 
                onPress={handleNextMonth}
                activeOpacity={0.7}
              >
                <Icon name="chevron-right" size={24} color="white" />
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.navButton} 
                onPress={goToCurrentMonth}
                activeOpacity={0.7}
                title="Tháng hiện tại"
              >
                <Icon name="calendar-today" size={20} color="white" />
            </TouchableOpacity>
            </View>
          </View>
          
          {/* Calendar grid */}
          <View style={styles.calendarWrap}>
            <Text style={styles.calendarTitle}>Bảng chấm công tháng {month}/{year}</Text>
            {/* Dòng thứ */}
            <View style={styles.weekdaysRow}>
              {weekdays.map((d, i) => (
              <Text key={i} style={[styles.weekday, i === 0 && { color: '#e53935' }]}>{d}</Text>
              ))}
            </View>
          {/* Render lịch theo từng tuần */}
            <View style={styles.calendarGrid}>
            {personalAttendanceData.map((week, weekIdx) => (
                <View key={weekIdx} style={styles.calendarRow}>
                {week.map((dayData, idx) => {
                  if (!dayData.isCurrentMonth) {
                    return <View key={idx} style={styles.dayBox} />;
                  }
                  const cellClass = getPersonalCellClass(dayData.attendance?.class || 'empty');
                  const timeText = dayData.attendance?.time || '';
                  // Tách giờ checkin và checkout
                  const timeParts = timeText.split(' ');
                  const checkInTime = timeParts[0] || '';
                  const checkOutTime = timeParts[1] || '';
                  
                    return (
                      <TouchableOpacity
                        key={idx}
                      style={[styles.dayBox, { 
                        backgroundColor: cellClass.bg, 
                        borderColor: cellClass.border 
                      }]}
                        activeOpacity={0.7}
                      onPress={() => handleDayPress(dayData)}
                    >
                      <Text style={[styles.dayNum, { color: cellClass.color }]}>{dayData.day}</Text>
                      {checkInTime && (
                        <Text style={[styles.dayLabel, { color: cellClass.color }]} numberOfLines={1}>
                          {checkInTime}
                        </Text>
                      )}
                      {checkOutTime && (
                        <Text style={[styles.dayLabel, { color: cellClass.color }]} numberOfLines={1}>
                          {checkOutTime}
                        </Text>
                      )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ))}
            </View>
            {/* Chú thích màu */}
            <View style={styles.legendContainer}>
              <Text style={styles.legendTitle}>Chú thích</Text>
            <View style={styles.legendRow}>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: '#43a047', borderColor: '#43a047' }]} />
                  <Text style={styles.legendLabel}>Đi làm</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: '#3498db', borderColor: '#3498db' }]} />
                  <Text style={styles.legendLabel}>Nghỉ phép</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: '#ffc107', borderColor: '#ffc107' }]} />
                  <Text style={styles.legendLabel}>Chưa đủ giờ</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: '#e53935', borderColor: '#e53935' }]} />
                  <Text style={styles.legendLabel}>Quên checkin/out</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: '#6c757d', borderColor: '#6c757d' }]} />
                  <Text style={styles.legendLabel}>Vắng không phép</Text>
                </View>
              </View>
            </View>
          </View>
          
          {/* Summary grid */}
          <View style={styles.summaryGrid}>
            {summaryData.map((item, idx) => (
              <View key={idx} style={styles.summaryBox}>
                <Text style={styles.summaryValue}>{item.value}</Text>
                <Text style={styles.summaryLabel}>{item.label}</Text>
              </View>
            ))}
          </View>
          
          {/* Detail Modal */}
          <Modal
            visible={modalVisible}
            animationType="slide"
            transparent
            onRequestClose={() => setModalVisible(false)}
          >
            <View style={styles.modalOverlay}>
              <View style={styles.modalContent}>
                <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setModalVisible(false)}>
                  <Icon name="close" size={28} color="#3498db" />
                </TouchableOpacity>
                
                {/* Employee Header */}
                {selectedEmployee && selectedDay && (
                  <View style={styles.modalEmpHeader}>
                    <View style={styles.modalEmpAvatarWrapper}>
                      <View style={styles.modalEmpAvatar}>
                        <Icon name="account-circle" size={40} color="#3498db" />
                      </View>
                    </View>
                    <View style={styles.modalEmpInfo}>
                      <Text style={styles.empName}>{selectedEmployee.name}</Text>
                      <View style={styles.empDetailsRow}>
                        <Text style={styles.detailText}>
                          <Text style={styles.detailLabel}>Mã: </Text>
                          <Text style={styles.detailValue}>{selectedEmployee.id || 'N/A'}</Text>
                        </Text>
                        <Text style={styles.detailSeparator}> • </Text>
                        <Text style={styles.detailText}>
                          <Text style={styles.detailLabel}>Chức vụ: </Text>
                          <Text style={styles.detailValue}>{selectedEmployee.position}</Text>
                        </Text>
                      </View>
                    </View>
                    <View style={styles.modalEmpDate}>
                      <View style={styles.dateBadge}>
                        <Icon name="calendar-today" size={16} color="#3498db" />
                        <Text style={styles.dateValue}>{selectedDay.day}/{month}/{year}</Text>
                      </View>
                    </View>
                  </View>
                )}

                {/* Loading State */}
                {dayModalLoading && (
                  <View style={styles.modalLoadingState}>
                    <ActivityIndicator size="large" color="#3498db" />
                    <Text style={styles.modalLoadingText}>Đang tải dữ liệu chi tiết...</Text>
                  </View>
                )}

                {/* Error State */}
                {dayModalError && !dayModalLoading && (
                  <View style={styles.modalErrorState}>
                    <Icon name="alert-circle" size={48} color="#e53935" />
                    <Text style={styles.modalErrorTitle}>Có lỗi xảy ra</Text>
                    <Text style={styles.modalErrorMessage}>{dayModalError}</Text>
                    <TouchableOpacity 
                      style={styles.modalRetryBtn} 
                      onPress={() => {
                        if (selectedDay && user) {
                          const currentDate = new Date(year, month - 1, selectedDay.day);
                          const dateStr = formatDateToString(currentDate);
                          loadDayModalData(user.id, dateStr);
                        }
                      }}
                      disabled={dayModalLoading}
                    >
                      <Icon name="refresh" size={18} color="#fff" />
                      <Text style={styles.modalRetryBtnText}>Thử lại</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {/* Data Content */}
                {!dayModalLoading && !dayModalError && (
                  <ScrollView style={styles.modalScrollView} showsVerticalScrollIndicator={false}>
                    {/* Attendance History Section */}
                    <View style={styles.modalSection}>
                      <View style={styles.sectionTitleRow}>
                        <View style={styles.sectionIconWrapper}>
                          <Icon name="fingerprint" size={18} color="#3498db" />
                        </View>
                        <Text style={styles.modalSectionTitle}>Dữ liệu chấm công</Text>
                      </View>
                      {dayDetailData.length > 0 ? (
                        <View style={styles.modalCardList}>
                          {dayDetailData.map((item, idx) => (
                            <View key={idx} style={styles.modalDataCard}>
                              <View style={styles.modalDataCardHeader}>
                                <View style={styles.modalDataCardBadge}>
                                  <Text style={styles.modalDataCardBadgeText}>#{item.stt}</Text>
                                </View>
                                <Text style={styles.modalDataCardShift} numberOfLines={1}>{item.shiftName}</Text>
                              </View>
                              <View style={styles.modalDataCardBody}>
                                <View style={styles.modalDataCardTimeRow}>
                                  {item.checkInTime && (
                                    <View style={styles.modalDataCardTimeItem}>
                                      <Icon name="login" size={16} color="#43a047" />
                                      <Text style={styles.modalDataCardTimeLabel}>Vào</Text>
                                      <Text style={styles.modalDataCardTimeValue}>{item.checkInTime}</Text>
                                    </View>
                                  )}
                                  {item.checkOutTime && (
                                    <View style={styles.modalDataCardTimeItem}>
                                      <Icon name="logout" size={16} color="#e53935" />
                                      <Text style={styles.modalDataCardTimeLabel}>Ra</Text>
                                      <Text style={styles.modalDataCardTimeValue}>{item.checkOutTime}</Text>
                                    </View>
                                  )}
                                </View>
                                <View style={styles.modalDataCardInfoRow}>
                                  {item.refCode && item.refCode !== '-' && (
                                    <View style={styles.modalDataCardInfoItem}>
                                      <Icon name="file-document-outline" size={14} color="#666" />
                                      <Text style={styles.modalDataCardInfoText} numberOfLines={1}>{item.refCode}</Text>
                                    </View>
                                  )}
                                  {item.location && item.location !== '-' && (
                                    <View style={styles.modalDataCardInfoItem}>
                                      <Icon name="map-marker-outline" size={14} color="#666" />
                                      <Text style={styles.modalDataCardInfoText} numberOfLines={1}>{item.location}</Text>
                                    </View>
                                  )}
                                </View>
                              </View>
                            </View>
                          ))}
                        </View>
                      ) : (
                        <View style={styles.modalEmptyState}>
                          <Icon name="inbox" size={48} color="#bdbdbd" />
                          <Text style={styles.modalEmptyText}>Không có dữ liệu chấm công cho ngày này</Text>
                        </View>
                      )}
                    </View>

                    {/* Work History Section */}
                    <View style={styles.modalSection}>
                      <View style={styles.sectionTitleRow}>
                        <View style={styles.sectionIconWrapper}>
                          <Icon name="calendar-clock" size={18} color="#3498db" />
                        </View>
                        <Text style={styles.modalSectionTitle}>Lịch làm việc</Text>
                      </View>
                      {workHistoryData.length > 0 ? (
                        <View style={styles.modalCardList}>
                          {workHistoryData.map((item, idx) => (
                            <View key={idx} style={styles.modalWorkCard}>
                              <View style={styles.modalWorkCardHeader}>
                                <View style={styles.modalWorkCardBadge}>
                                  <Text style={styles.modalWorkCardBadgeText}>#{item.stt}</Text>
                                </View>
                                <Text style={styles.modalWorkCardShift}>{item.shiftName}</Text>
                              </View>
                              <View style={styles.modalWorkCardBody}>
                                <View style={styles.modalWorkCardGrid}>
                                  <View style={styles.modalWorkCardItem}>
                                    <Icon name="clock-check-outline" size={18} color="#3498db" />
                                    <Text style={styles.modalWorkCardItemLabel}>Công chuẩn</Text>
                                    <Text style={styles.modalWorkCardItemValue}>{item.standard}</Text>
                                  </View>
                                  <View style={styles.modalWorkCardItem}>
                                    <Icon name="timer-outline" size={18} color="#3498db" />
                                    <Text style={styles.modalWorkCardItemLabel}>Giờ/ngày công</Text>
                                    <Text style={styles.modalWorkCardItemValue} numberOfLines={2}>{item.workHour}</Text>
                                  </View>
                                </View>
                                <View style={styles.modalWorkCardRow}>
                                  <Icon name="clock-in" size={16} color="#666" />
                                  <Text style={styles.modalWorkCardLabel}>Quét vào/ra: </Text>
                                  <Text style={styles.modalWorkCardValue}>
                                    {item.scanInOut.split(',')[0]?.replace('Vào:', '').trim() || '--:--'} / {item.scanInOut.split(',')[1]?.replace('Ra:', '').trim() || '--:--'}
                                  </Text>
                                </View>
                                {item.lateEarly && item.lateEarly !== '-' && (
                                  <View style={styles.modalWorkCardRow}>
                                    <Icon name="alert-outline" size={16} color="#ffc107" />
                                    <Text style={styles.modalWorkCardLabel}>Đi trễ/Về sớm: </Text>
                                    <Text style={[styles.modalWorkCardValue, { color: '#ffc107' }]}>{item.lateEarly}</Text>
                                  </View>
                                )}
                              </View>
                            </View>
                          ))}
                        </View>
                      ) : (
                        <View style={styles.modalEmptyState}>
                          <Icon name="calendar-remove" size={48} color="#bdbdbd" />
                          <Text style={styles.modalEmptyText}>Không có dữ liệu lịch làm việc cho ngày này</Text>
                        </View>
                      )}
                    </View>
                  </ScrollView>
                )}
              </View>
            </View>
          </Modal>
        </ScrollView>
      </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
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
    padding: 40,
  },
  errorText: {
    fontSize: 16,
    color: '#e53935',
    marginTop: 16,
    marginBottom: 20,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: '#3498db',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
    shadowColor: '#3498db',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  monthCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2c3e50',
    paddingVertical: 15,
    paddingHorizontal: 20,
    marginBottom: 10,
    borderRadius: 12,
    marginHorizontal: 16,
    marginTop: 10,
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
    justifyContent: 'center',
    alignItems: 'center',
  },
  monthInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  monthNavRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  monthText: {
    fontWeight: 'bold',
    fontSize: 16,
    color: 'white',
    letterSpacing: 0.5,
  },
  legendContainer: {
    marginTop: 20,
    paddingTop: 16,
    paddingBottom: 12,
    borderTopWidth: 1.5,
    borderTopColor: '#e8f4f8',
    backgroundColor: '#f8fafb',
    borderRadius: 12,
    paddingHorizontal: 16,
    marginHorizontal: -4,
  },
  legendTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#2c3e50',
    marginBottom: 14,
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  legendRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    flexWrap: 'wrap',
    paddingHorizontal: 4,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    paddingHorizontal: 4,
    width: '48%',
  },
  legendDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    marginRight: 10,
    borderWidth: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  legendLabel: {
    fontSize: 12,
    color: '#2c3e50',
    fontWeight: '600',
    letterSpacing: 0.2,
    flex: 1,
  },
  weekdaysRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
    marginHorizontal: 4,
  },
  weekday: {
    flex: 1,
    textAlign: 'center',
    color: '#666',
    fontWeight: 'bold',
    fontSize: 13,
    paddingBottom: 4,
  },
  calendarWrap: {
    backgroundColor: '#fff',
    borderRadius: 16,
    margin: 16,
    marginBottom: 8,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  calendarTitle: {
    fontWeight: 'bold',
    color: '#3498db',
    fontSize: 20,
    marginBottom: 16,
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  calendarGrid: {
    flexDirection: 'column',
    gap: 0,
    marginHorizontal: 0,
  },
  calendarRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
    paddingHorizontal: 2,
  },
  dayBox: {
    flex: 1,
    minHeight: 70,
    maxHeight: 80,
    borderRadius: 12,
    marginHorizontal: 2,
    marginBottom: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    position: 'relative',
    paddingVertical: 6,
    paddingHorizontal: 2,
  },
  modalSection: {
    marginBottom: 18,
  },
  modalSectionTitle: {
    fontWeight: '700',
    color: '#2c3e50',
    fontSize: 16,
    marginTop: 2,
  },
  modalCard: {
    backgroundColor: '#f8fafd',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    shadowColor: '#3498db',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#e3f2fd',
  },
  modalCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  modalCardImg: {
    width: 40,
    height: 40,
    borderRadius: 8,
    marginRight: 12,
    backgroundColor: '#e3f2fd',
  },
  modalCardName: {
    fontWeight: 'bold',
    fontSize: 15,
    color: '#2c3e50',
    marginBottom: 4,
  },
  modalCardSub: {
    color: '#666',
    fontSize: 13,
    marginBottom: 2,
  },
  dayNum: {
    fontWeight: 'bold',
    fontSize: 16,
    marginBottom: 4,
  },
  dayLabel: {
    fontSize: 10,
    textAlign: 'center',
    lineHeight: 12,
    fontWeight: '600',
    marginTop: 1,
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    padding: 16,
    gap: 12,
  },
  summaryBox: {
    width: '30%',
    backgroundColor: '#fff',
    borderRadius: 14,
    marginBottom: 12,
    alignItems: 'center',
    paddingVertical: 18,
    paddingHorizontal: 8,
    shadowColor: '#3498db',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#e3f2fd',
  },
  summaryValue: {
    fontWeight: 'bold',
    color: '#3498db',
    fontSize: 20,
    marginBottom: 4,
  },
  summaryLabel: {
    color: '#666',
    fontSize: 12,
    textAlign: 'center',
    fontWeight: '500',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '98%',
    maxHeight: '95%',
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 10,
  },
  modalCloseBtn: {
    position: 'absolute',
    top: 12,
    right: 12,
    padding: 8,
    zIndex: 1,
    backgroundColor: '#f0f7ff',
    borderRadius: 20,
  },
  modalScrollView: {
    maxHeight: 450,
  },
  modalEmpHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 40,
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1.5,
    borderBottomColor: '#e8f4f8',
  },
  modalEmpAvatarWrapper: {
    marginRight: 10,
  },
  modalEmpAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#f0f7ff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#e3f2fd',
  },
  modalEmpInfo: {
    flex: 1,
    marginRight: 8,
  },
  empName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#2c3e50',
    marginBottom: 4,
  },
  empDetailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  detailText: {
    fontSize: 12,
  },
  detailSeparator: {
    fontSize: 12,
    color: '#bdbdbd',
    marginHorizontal: 4,
  },
  detailLabel: {
    fontSize: 12,
    color: '#666',
  },
  detailValue: {
    fontSize: 12,
    color: '#2c3e50',
    fontWeight: '600',
  },
  modalEmpDate: {
    marginLeft: 'auto',
  },
  dateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f7ff',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e3f2fd',
  },
  dateValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#3498db',
    marginLeft: 6,
  },
  modalLoadingState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  modalLoadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#666',
  },
  modalErrorState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  modalErrorTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#2c3e50',
    marginTop: 12,
    marginBottom: 8,
  },
  modalErrorMessage: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
    paddingHorizontal: 20,
  },
  modalRetryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3498db',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
    gap: 8,
  },
  modalRetryBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  sectionIconWrapper: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f0f7ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  modalCardList: {
    gap: 10,
  },
  modalDataCard: {
    backgroundColor: '#f8fafb',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e8f4f8',
    shadowColor: '#3498db',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  modalDataCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e8f4f8',
  },
  modalDataCardBadge: {
    backgroundColor: '#3498db',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginRight: 10,
  },
  modalDataCardBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  modalDataCardShift: {
    fontSize: 13,
    fontWeight: '700',
    color: '#2c3e50',
    flex: 1,
  },
  modalDataCardBody: {
    gap: 8,
  },
  modalDataCardTimeRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 8,
  },
  modalDataCardTimeItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e8f4f8',
  },
  modalDataCardTimeLabel: {
    fontSize: 11,
    color: '#666',
    marginLeft: 6,
    marginRight: 4,
    fontWeight: '600',
  },
  modalDataCardTimeValue: {
    fontSize: 13,
    color: '#2c3e50',
    fontWeight: '700',
  },
  modalDataCardInfoRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  modalDataCardInfoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e8f4f8',
    flex: 1,
    minWidth: '45%',
  },
  modalDataCardInfoText: {
    fontSize: 11,
    color: '#555',
    marginLeft: 6,
    flex: 1,
  },
  modalWorkCard: {
    backgroundColor: '#f8fafb',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e8f4f8',
    shadowColor: '#3498db',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  modalWorkCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e8f4f8',
  },
  modalWorkCardBadge: {
    backgroundColor: '#3498db',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginRight: 10,
  },
  modalWorkCardBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  modalWorkCardShift: {
    fontSize: 14,
    fontWeight: '700',
    color: '#2c3e50',
    flex: 1,
  },
  modalWorkCardBody: {
    gap: 10,
  },
  modalWorkCardGrid: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 8,
  },
  modalWorkCardItem: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e8f4f8',
  },
  modalWorkCardItemLabel: {
    fontSize: 11,
    color: '#666',
    marginTop: 6,
    marginBottom: 4,
    textAlign: 'center',
  },
  modalWorkCardItemValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#3498db',
    textAlign: 'center',
  },
  modalWorkCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  modalWorkCardLabel: {
    fontSize: 13,
    color: '#666',
    marginLeft: 8,
    marginRight: 4,
  },
  modalWorkCardValue: {
    fontSize: 13,
    color: '#2c3e50',
    fontWeight: '600',
    flex: 1,
  },
  modalEmptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  modalEmptyText: {
    fontSize: 14,
    color: '#999',
    marginTop: 12,
    textAlign: 'center',
  },
});
