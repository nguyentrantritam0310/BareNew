// Mock data service for development when API is not available
export const mockAttendanceData = [
  {
    id: '1',
    employeeCode: 'EMP001',
    date: '2025-01-15',
    scanTime: '2025-01-15T08:30:00Z',
    type: 'Đi làm',
    shiftName: 'Ca sáng',
    status: 'present'
  },
  {
    id: '2',
    employeeCode: 'EMP001',
    date: '2025-01-15',
    scanTime: '2025-01-15T17:30:00Z',
    type: 'Về',
    shiftName: 'Ca sáng',
    status: 'present'
  },
  {
    id: '3',
    employeeCode: 'EMP001',
    date: '2025-01-16',
    scanTime: '2025-01-16T08:45:00Z',
    type: 'Đi trễ',
    shiftName: 'Ca sáng',
    status: 'late'
  },
  {
    id: '4',
    employeeCode: 'EMP001',
    date: '2025-01-16',
    scanTime: '2025-01-16T17:30:00Z',
    type: 'Về',
    shiftName: 'Ca sáng',
    status: 'present'
  },
  {
    id: '5',
    employeeCode: 'EMP001',
    date: '2025-01-17',
    scanTime: '2025-01-17T08:25:00Z',
    type: 'Đi làm',
    shiftName: 'Ca sáng',
    status: 'present'
  },
  {
    id: '6',
    employeeCode: 'EMP001',
    date: '2025-01-17',
    scanTime: '2025-01-17T17:30:00Z',
    type: 'Về',
    shiftName: 'Ca sáng',
    status: 'present'
  },
  {
    id: '7',
    employeeCode: 'EMP001',
    date: '2025-01-18',
    scanTime: '2025-01-18T08:30:00Z',
    type: 'Đi làm',
    shiftName: 'Ca sáng',
    status: 'present'
  },
  {
    id: '8',
    employeeCode: 'EMP001',
    date: '2025-01-18',
    scanTime: '2025-01-18T17:30:00Z',
    type: 'Về',
    shiftName: 'Ca sáng',
    status: 'present'
  },
  {
    id: '9',
    employeeCode: 'EMP001',
    date: '2025-01-19',
    scanTime: '2025-01-19T08:30:00Z',
    type: 'Đi làm',
    shiftName: 'Ca sáng',
    status: 'present'
  },
  {
    id: '10',
    employeeCode: 'EMP001',
    date: '2025-01-19',
    scanTime: '2025-01-19T17:30:00Z',
    type: 'Về',
    shiftName: 'Ca sáng',
    status: 'present'
  }
];

export const mockEmployeeData = {
  employeeCode: 'EMP001',
  fullName: 'Nguyễn Văn A',
  department: 'IT',
  position: 'Developer',
  email: 'nguyenvana@company.com',
  phone: '0123456789'
};

export const mockLeaveData = [
  {
    id: '1',
    employeeCode: 'EMP001',
    startDate: '2025-01-20',
    endDate: '2025-01-22',
    type: 'Nghỉ phép',
    reason: 'Nghỉ phép cá nhân',
    status: 'approved'
  }
];

export const mockOvertimeData = [
  {
    id: '1',
    employeeCode: 'EMP001',
    date: '2025-01-15',
    startTime: '18:00',
    endTime: '20:00',
    reason: 'Làm thêm giờ',
    status: 'pending'
  }
];
