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
 * Fetch shift assignments by date range
 * @param {String} startDate - Start date in format YYYY-MM-DD
 * @param {String} endDate - End date in format YYYY-MM-DD
 * @returns {Promise<Array>} Array of shift assignments
 */
export const getShiftAssignmentsByDateRange = async (startDate, endDate) => {
  try {
    const response = await api.get('/ShiftAssignment');
    const allAssignments = response.data || [];
    
    // Filter by date range
    const start = new Date(startDate);
    const end = new Date(endDate);
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
    
    return allAssignments.filter(assignment => {
      if (!assignment.workDate) return false;
      const assignmentDate = new Date(assignment.workDate);
      assignmentDate.setHours(0, 0, 0, 0);
      return assignmentDate >= start && assignmentDate <= end;
    });
  } catch (error) {
    console.error('Error fetching shift assignments:', error);
    return [];
  }
};

/**
 * Validate that all days in the date range have shift assignments
 * @param {Date} startDate - Start date
 * @param {Date} endDate - End date
 * @param {Array} assignments - Array of shift assignments
 * @returns {Object} { valid: boolean, missingDate: Date | null }
 */
export const validateAllDaysHaveShifts = (startDate, endDate, assignments) => {
  const dates = new Set();
  assignments.forEach(assignment => {
    if (assignment.workDate) {
      const assignmentDate = new Date(assignment.workDate);
      assignmentDate.setHours(0, 0, 0, 0);
      const dateString = assignmentDate.toDateString();
      dates.add(dateString);
    }
  });
  
  const currentDate = new Date(startDate);
  currentDate.setHours(0, 0, 0, 0);
  const endDateNormalized = new Date(endDate);
  endDateNormalized.setHours(0, 0, 0, 0);
  
  while (currentDate <= endDateNormalized) {
    const dateString = currentDate.toDateString();
    if (!dates.has(dateString)) {
      return { valid: false, missingDate: new Date(currentDate) };
    }
    currentDate.setDate(currentDate.getDate() + 1);
  }
  
  return { valid: true, missingDate: null };
};

/**
 * Check for overlapping leave requests
 * @param {String} startDateTime - Start date time
 * @param {String} endDateTime - End date time
 * @param {String} employeeID - Employee ID
 * @param {Array} allLeaveRequests - All leave requests
 * @param {String} excludeVoucherCode - Voucher code to exclude (for update mode)
 * @returns {Array} Array of overlapping leave requests
 */
export const checkOverlappingLeaveRequests = (startDateTime, endDateTime, employeeID, allLeaveRequests, excludeVoucherCode = null) => {
  if (!allLeaveRequests || allLeaveRequests.length === 0 || !employeeID) {
    return [];
  }

  const leaveStart = new Date(startDateTime);
  const leaveEnd = new Date(endDateTime);

  if (isNaN(leaveStart.getTime()) || isNaN(leaveEnd.getTime())) {
    return [];
  }

  const approvedLeaveRequests = allLeaveRequests.filter(request =>
    (request.employeeID === employeeID || String(request.employeeID) === String(employeeID)) &&
    isApprovedStatus(request.approveStatus) &&
    (!excludeVoucherCode || request.voucherCode !== excludeVoucherCode)
  );

  const overlapping = [];

  approvedLeaveRequests.forEach(request => {
    const requestStart = new Date(request.startDateTime);
    const requestEnd = new Date(request.endDateTime);

    // Check if there's an overlap
    // Overlap exists if: (leaveStart <= requestEnd) && (leaveEnd >= requestStart)
    if (leaveStart <= requestEnd && leaveEnd >= requestStart) {
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
 * Format date for API (YYYY-MM-DD)
 * @param {Date} date - Date object
 * @returns {String} Formatted date string
 */
export const formatDateForAPI = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};
