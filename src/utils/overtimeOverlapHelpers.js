import { attendanceDataService } from '../services/attendanceDataService';
import api from '../api';

/**
 * Helper function to check if approve status is approved
 */
const isApprovedStatus = (approveStatus) => {
  if (!approveStatus) return false;
  if (typeof approveStatus === 'string') {
    return approveStatus === 'Đã duyệt' || approveStatus === 'Approved';
  }
  if (typeof approveStatus === 'number') {
    return approveStatus === 2; // ApproveStatusEnum.Approved = 2
  }
  return false;
};

/**
 * Check for overlapping overtime requests
 */
export const checkOverlappingOvertimeRequests = (startDateTime, endDateTime, employeeID, overtimeRequests = [], overtimeForms = [], excludeVoucherCode = null) => {
  if (!overtimeRequests || overtimeRequests.length === 0) {
    return [];
  }

  const startDate = new Date(startDateTime);
  const endDate = new Date(endDateTime);

  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
    return [];
  }

  // Filter approved overtime requests for the same employee
  const approvedRequests = overtimeRequests.filter(request =>
    (request.employeeID === employeeID || String(request.employeeID) === String(employeeID)) &&
    isApprovedStatus(request.approveStatus) &&
    (!excludeVoucherCode || request.voucherCode !== excludeVoucherCode)
  );

  const overlapping = [];

  approvedRequests.forEach(request => {
    const requestStart = new Date(request.startDateTime);
    const requestEnd = new Date(request.endDateTime);

    // Check if there's an overlap
    if (startDate <= requestEnd && endDate >= requestStart) {
      const overtimeForm = overtimeForms.find(form => form.id === request.overtimeFormID);
      const overtimeFormName = overtimeForm ? overtimeForm.overtimeFormName : 'N/A';

      overlapping.push({
        voucherCode: request.voucherCode,
        startDateTime: request.startDateTime,
        endDateTime: request.endDateTime,
        overtimeFormName: overtimeFormName
      });
    }
  });

  return overlapping;
};

/**
 * Check for overlapping leave requests
 */
export const checkOverlappingLeaveRequests = (startDateTime, endDateTime, employeeID, leaveRequests = []) => {
  if (!leaveRequests || leaveRequests.length === 0 || !employeeID) {
    return [];
  }

  const overtimeStart = new Date(startDateTime);
  const overtimeEnd = new Date(endDateTime);

  if (isNaN(overtimeStart.getTime()) || isNaN(overtimeEnd.getTime())) {
    return [];
  }

  // Filter approved leave requests for the same employee
  const approvedLeaveRequests = leaveRequests.filter(request =>
    (request.employeeID === employeeID || String(request.employeeID) === String(employeeID)) &&
    isApprovedStatus(request.approveStatus)
  );

  const overlapping = [];

  approvedLeaveRequests.forEach(request => {
    const leaveStart = new Date(request.startDateTime);
    const leaveEnd = new Date(request.endDateTime);

    // Check overlap: chỉ cần có 1 khoảng trùng là đủ
    if (overtimeStart < leaveEnd && overtimeEnd > leaveStart) {
      overlapping.push({
        voucherCode: request.voucherCode,
        startDateTime: request.startDateTime,
        endDateTime: request.endDateTime,
        leaveTypeName: request.leaveTypeName || 'N/A'
      });
    }
  });

  return overlapping;
};

/**
 * Get shift assignments by date range
 */
const getShiftAssignmentsByDateRange = async (startDate, endDate) => {
  try {
    const response = await api.get('/ShiftAssignment', {
      params: {
        startDate: startDate,
        endDate: endDate
      }
    });
    return response.data || [];
  } catch (error) {
    console.error('Error fetching shift assignments:', error);
    return [];
  }
};

/**
 * Check for overlapping shift times with attendance data or leave requests
 */
export const checkOverlappingShiftTimes = async (
  startDateTime,
  endDateTime,
  employeeID,
  employees = [],
  leaveRequests = [],
  workshifts = []
) => {
  if (!employeeID || !startDateTime || !endDateTime) {
    return [];
  }

  const overtimeStart = new Date(startDateTime);
  const overtimeEnd = new Date(endDateTime);

  if (isNaN(overtimeStart.getTime()) || isNaN(overtimeEnd.getTime())) {
    return [];
  }

  // Lấy các phân ca làm việc trong khoảng thời gian của đơn tăng ca
  const startDateOnly = new Date(overtimeStart);
  startDateOnly.setHours(0, 0, 0, 0);
  const endDateOnly = new Date(overtimeEnd);
  endDateOnly.setHours(23, 59, 59, 999);

  const shiftAssignmentsInRange = await getShiftAssignmentsByDateRange(
    startDateOnly.toISOString(),
    endDateOnly.toISOString()
  );

  // Lọc chỉ các phân ca của nhân viên hiện tại
  const employeeShiftAssignments = shiftAssignmentsInRange.filter(assignment =>
    (assignment.employeeID === employeeID || String(assignment.employeeID) === String(employeeID))
  );

  // Lấy thông tin nhân viên để lấy employeeCode
  const selectedEmployee = employees.find(emp =>
    emp.id === employeeID ||
    String(emp.id) === String(employeeID) ||
    emp.employeeCode === employeeID ||
    String(emp.employeeCode) === String(employeeID)
  );

  const employeeCode = selectedEmployee?.id || selectedEmployee?.employeeCode || String(employeeID);

  // Lấy dữ liệu chấm công trong khoảng thời gian
  const attendanceInRange = await attendanceDataService.getAttendanceDataByDateRange(
    startDateOnly.toISOString().split('T')[0],
    endDateOnly.toISOString().split('T')[0]
  );

  // Lọc chỉ dữ liệu chấm công của nhân viên hiện tại
  const employeeAttendance = (attendanceInRange || []).filter(att => {
    const attEmployeeCode = att.employeeCode || att.EmployeeCode;
    const hasCheckInOut = att.checkInTime || att.CheckInTime || att.checkOutTime || att.CheckOutTime;

    const matchesEmployee = attEmployeeCode && (
      String(attEmployeeCode) === String(employeeCode) ||
      String(attEmployeeCode) === String(employeeID) ||
      attEmployeeCode === employeeCode ||
      attEmployeeCode === employeeID
    );

    return matchesEmployee && hasCheckInOut;
  });

  const overlapping = [];

  // KIỂM TRA TẤT CẢ DỮ LIỆU CHẤM CÔNG TRONG KHOẢNG THỜI GIAN TĂNG CA
  for (const att of employeeAttendance) {
    let attDate = null;
    if (att.workDate) {
      attDate = new Date(att.workDate);
    } else if (att.WorkDate) {
      attDate = new Date(att.WorkDate);
    } else if (att.date) {
      attDate = new Date(att.date);
    }

    if (!attDate || isNaN(attDate.getTime())) {
      continue;
    }

    const checkInTime = att.checkInTime || att.CheckInTime;
    const checkOutTime = att.checkOutTime || att.CheckOutTime;

    if (!checkInTime && !checkOutTime) {
      continue;
    }

    let attStartTime = null;
    let attEndTime = null;

    if (checkInTime) {
      const timeParts = String(checkInTime).split(':').map(Number);
      attStartTime = new Date(attDate);
      attStartTime.setHours(timeParts[0] || 0, timeParts[1] || 0, 0, 0);
    }

    if (checkOutTime) {
      const timeParts = String(checkOutTime).split(':').map(Number);
      attEndTime = new Date(attDate);
      attEndTime.setHours(timeParts[0] || 0, timeParts[1] || 0, 0, 0);
    } else if (checkInTime) {
      // Nếu chỉ có check-in, giả sử ca làm việc kết thúc sau 8 giờ
      const timeParts = String(checkInTime).split(':').map(Number);
      attEndTime = new Date(attDate);
      attEndTime.setHours((timeParts[0] || 0) + 8, timeParts[1] || 0, 0, 0);
    }

    // Kiểm tra overlap với đơn tăng ca
    if (attStartTime && attEndTime) {
      const hasTimeOverlap = overtimeStart < attEndTime && overtimeEnd > attStartTime;

      if (hasTimeOverlap) {
        const shiftName = att.shiftName || att.ShiftName || 'N/A';
        overlapping.push({
          workDate: attDate.toLocaleDateString('vi-VN'),
          shiftName: shiftName,
          startTime: attStartTime.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
          endTime: attEndTime.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
          hasAttendance: true,
          hasLeaveRequest: false,
          shiftAssignmentID: att.workShiftID || att.WorkShiftID || null
        });
      }
    }
  }

  // Kiểm tra từng phân ca (để check đơn nghỉ phép)
  for (const assignment of employeeShiftAssignments) {
    const workDate = new Date(assignment.workDate);
    const dayOfWeek = workDate.getDay();
    const dayNames = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];
    const currentDayName = dayNames[dayOfWeek];

    const workShift = workshifts.find(shift => shift.id === assignment.workShiftID);
    if (!workShift || !workShift.shiftDetails) {
      continue;
    }

    const dayShiftDetail = workShift.shiftDetails.find(detail =>
      detail.dayOfWeek === currentDayName || detail.DayOfWeek === currentDayName
    );

    const startTime = dayShiftDetail?.startTime || dayShiftDetail?.StartTime || '00:00:00';
    const endTime = dayShiftDetail?.endTime || dayShiftDetail?.EndTime || '00:00:00';

    if (!dayShiftDetail || startTime === '00:00:00' || endTime === '00:00:00') {
      continue;
    }

    // Tính toán thời gian ca làm việc
    const parseTimeString = (timeStr) => {
      if (!timeStr) return { hours: 0, minutes: 0 };
      const parts = timeStr.split(':').map(Number);
      return { hours: parts[0] || 0, minutes: parts[1] || 0 };
    };

    const shiftStartTime = new Date(workDate);
    const startTimeParts = parseTimeString(startTime);
    shiftStartTime.setHours(startTimeParts.hours, startTimeParts.minutes, 0, 0);

    const shiftEndTime = new Date(workDate);
    const endTimeParts = parseTimeString(endTime);
    shiftEndTime.setHours(endTimeParts.hours, endTimeParts.minutes, 0, 0);

    // Kiểm tra overlap với đơn tăng ca
    const hasTimeOverlap = overtimeStart < shiftEndTime && overtimeEnd > shiftStartTime;

    if (!hasTimeOverlap) {
      continue;
    }

    // Kiểm tra ca đó có đơn nghỉ phép đã duyệt trùng không
    const hasLeaveRequest = leaveRequests.some(request => {
      if ((request.employeeID !== employeeID && String(request.employeeID) !== String(employeeID)) ||
          !isApprovedStatus(request.approveStatus)) {
        return false;
      }

      const leaveStart = new Date(request.startDateTime);
      const leaveEnd = new Date(request.endDateTime);

      return leaveStart <= shiftEndTime && leaveEnd >= shiftStartTime;
    });

    if (hasLeaveRequest) {
      overlapping.push({
        workDate: workDate.toLocaleDateString('vi-VN'),
        shiftName: workShift.shiftName || workShift.ShiftName || 'N/A',
        startTime: startTime,
        endTime: endTime,
        hasAttendance: false,
        hasLeaveRequest: true,
        shiftAssignmentID: assignment.id
      });
    }
  }

  return overlapping;
};

