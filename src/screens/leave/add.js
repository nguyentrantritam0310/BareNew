import { useNavigation } from '@react-navigation/native';
import { useEffect, useState } from 'react';
import { 
  ActivityIndicator, 
  Alert, 
  Modal,
  Platform, 
  ScrollView, 
  StyleSheet, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  View 
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useLeaveRequest } from '../../composables/useLeaveRequest';
import { useLeaveType } from '../../composables/useLeaveType';
import { useEmployee } from '../../composables/useEmployee';
import { useWorkShift } from '../../composables/useWorkShift';
import { useOvertimeRequest } from '../../composables/useOvertimeRequest';
import { useOvertimeForm } from '../../composables/useOvertimeForm';
import { useAuth } from '../../contexts/AuthContext';
import { useMemo, useCallback } from 'react';
 import CustomHeader from '../../components/CustomHeader';
import { 
  getShiftAssignmentsByDateRange, 
  validateAllDaysHaveShifts, 
  checkOverlappingLeaveRequests,
  formatDateForAPI 
} from '../../utils/leaveFormHelpers';
import {
  checkOverlappingOvertimeRequests,
  checkOverlappingShiftTimes
} from '../../utils/overtimeOverlapHelpers';
import { ScrollView as RNScrollView } from 'react-native';

export default function AddLeaveScreen() {
  const navigation = useNavigation();
  const { user, isDirector, isHRManager, isHREmployee } = useAuth();
  const { createLeaveRequest, fetchLeaveRequests, leaveRequests, loading: leaveLoading } = useLeaveRequest();
  const { leaveTypes, fetchLeaveTypes, loading: leaveTypeLoading } = useLeaveType();
  const { employees, fetchAllEmployees, loading: employeeLoading } = useEmployee();
  const { workShifts, fetchWorkShifts, loading: workShiftLoading } = useWorkShift();
  const { overtimeRequests, fetchOvertimeRequests } = useOvertimeRequest();
  const { overtimeForms, fetchOvertimeForms } = useOvertimeForm();

  // Form state
  const [formData, setFormData] = useState({
    voucherCode: '',
    employeeID: '',
    leaveTypeID: '',
    workShiftID: '',
    startDateTime: '',
    endDateTime: '',
    reason: ''
  });

  // UI state
  const [showEmployeeModal, setShowEmployeeModal] = useState(false);
  const [showLeaveTypeModal, setShowLeaveTypeModal] = useState(false);
  const [showWorkShiftModal, setShowWorkShiftModal] = useState(false);
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  const [showStartTimePicker, setShowStartTimePicker] = useState(false);
  const [showEndTimePicker, setShowEndTimePicker] = useState(false);
  const [tempStartDate, setTempStartDate] = useState(new Date());
  const [tempEndDate, setTempEndDate] = useState(new Date());
  const [tempStartTime, setTempStartTime] = useState(new Date());
  const [tempEndTime, setTempEndTime] = useState(new Date());
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  
  // Available work shifts based on shift assignments
  const [availableWorkShifts, setAvailableWorkShifts] = useState([]);
  const [loadingShiftAssignments, setLoadingShiftAssignments] = useState(false);
  const [shiftAssignmentsInRange, setShiftAssignmentsInRange] = useState([]);
  
  // Overlap confirmation modal state
  const [showOverlapModal, setShowOverlapModal] = useState(false);
  const [overlappingRequests, setOverlappingRequests] = useState([]);
  const [overlappingOvertimeRequests, setOverlappingOvertimeRequests] = useState([]);
  const [overlappingShiftTimes, setOverlappingShiftTimes] = useState([]);
  const [overlapModalType, setOverlapModalType] = useState(''); // 'leave', 'overtime', 'shift', or combinations
  const [pendingSubmitData, setPendingSubmitData] = useState(null);

  // Filter employees based on user role
  const availableEmployees = useMemo(() => {
    const userRole = user?.role;
    const userId = user?.id;

    if (!userId || !employees || employees.length === 0) {
      return employees || [];
    }

    // Director, HR Manager, HR Employee: all employees
    if (isDirector() || isHRManager() || isHREmployee()) {
      return employees;
    }

    // Manager (Chỉ huy công trình): self + workers
    if (userRole === 'manager' || userRole === 'MANAGER' || userRole === '2') {
      return employees.filter(emp => {
        // Self
        if (emp.id === userId || String(emp.id) === String(userId)) {
          return true;
        }

        // Check if worker (check by roleName or role)
        const roleName = emp.roleName || emp.role || '';
        const roleNameLower = roleName.toLowerCase();
        const isWorker = roleNameLower.includes('thợ') ||
          roleNameLower.includes('worker') ||
          emp.role === 'worker' ||
          emp.role === 'WORKER' ||
          roleName === 'Nhân viên thợ' ||
          userRole === 'worker' ||
          userRole === 'WORKER';

        return isWorker;
      });
    }

    // Technician/Worker: only self
    if (['technician', 'worker', 'TECHNICIAN', 'WORKER', '4', '1'].includes(userRole)) {
      return employees.filter(emp => 
        emp.id === userId || String(emp.id) === String(userId)
      );
    }

    // Default: return all (fallback)
    return employees;
  }, [employees, user, isDirector, isHRManager, isHREmployee]);

  // Check if user is restricted (technician/worker)
  const isRestrictedUser = useMemo(() => {
    const userRole = user?.role;
    return ['technician', 'worker', 'TECHNICIAN', 'WORKER', '4', '1'].includes(userRole);
  }, [user]);

  // Load data on mount
  useEffect(() => {
    loadInitialData();
  }, []);

  // Auto-set employeeID for restricted users on mount
  useEffect(() => {
    if (isRestrictedUser && user?.id && !formData.employeeID) {
      setFormData(prev => ({ ...prev, employeeID: user.id }));
    }
  }, [isRestrictedUser, user?.id]);

  const loadInitialData = async () => {
    try {
      await Promise.all([
        fetchLeaveTypes(),
        fetchAllEmployees(),
        fetchWorkShifts(),
        fetchLeaveRequests(), // Load leave requests for overlap checking
        fetchOvertimeRequests(), // Load overtime requests for overlap checking
        fetchOvertimeForms() // Load overtime forms for overlap display
      ]);
    } catch (error) {
      Alert.alert('Lỗi', 'Không thể tải dữ liệu khởi tạo');
    }
  };
  
  // Function to fetch shift assignments and filter available work shifts
  const fetchAvailableWorkShifts = useCallback(async () => {
    // Reset available work shifts
    setAvailableWorkShifts([]);
    setShiftAssignmentsInRange([]);
    setErrors(prev => ({ ...prev, workShiftID: '' }));
    
    // Check if we have all required fields
    if (!formData.employeeID || !formData.startDateTime || !formData.endDateTime) {
      return;
    }
    
    try {
      setLoadingShiftAssignments(true);
      
      // Parse dates
      const startDate = new Date(formData.startDateTime);
      const endDate = new Date(formData.endDateTime);
      
      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        return;
      }
      
      const startDateStr = formatDateForAPI(startDate);
      const endDateStr = formatDateForAPI(endDate);
      
      // Fetch shift assignments in date range
      const assignments = await getShiftAssignmentsByDateRange(startDateStr, endDateStr);
      
      // Filter assignments for the selected employee
      const employeeAssignments = assignments.filter(assignment => 
        assignment.employeeID === formData.employeeID ||
        String(assignment.employeeID) === String(formData.employeeID)
      );
      
      setShiftAssignmentsInRange(employeeAssignments);
      
      // Validate that all days in the range have shift assignments
      const validation = validateAllDaysHaveShifts(startDate, endDate, employeeAssignments);
      if (!validation.valid) {
        setAvailableWorkShifts([]);
        setErrors(prev => ({
          ...prev,
          workShiftID: `Không có ca làm việc được phân cho ngày ${validation.missingDate.toLocaleDateString('vi-VN')}. Vui lòng phân ca cho tất cả các ngày trong khoảng thời gian.`
        }));
        if (formData.workShiftID) {
          setFormData(prev => ({ ...prev, workShiftID: '' }));
        }
        return;
      }
      
      // Get unique work shift IDs from assignments
      const assignedShiftIds = new Set(
        employeeAssignments.map(assignment => assignment.workShiftID)
      );
      
      // Filter workshifts to only include assigned ones
      const filteredShifts = workShifts.filter(shift => 
        assignedShiftIds.has(shift.id)
      );
      setAvailableWorkShifts(filteredShifts);
      
      // If current workShiftID is not in available shifts, clear it
      if (formData.workShiftID && !assignedShiftIds.has(parseInt(formData.workShiftID))) {
        setFormData(prev => ({ ...prev, workShiftID: '' }));
        setErrors(prev => ({
          ...prev,
          workShiftID: 'Ca làm việc này không được phân cho nhân viên trong khoảng thời gian đã chọn'
        }));
      }
    } catch (error) {
      console.error('Error fetching shift assignments:', error);
      setAvailableWorkShifts([]);
      setErrors(prev => ({
        ...prev,
        workShiftID: 'Lỗi khi tải danh sách ca làm việc'
      }));
    } finally {
      setLoadingShiftAssignments(false);
    }
  }, [formData.employeeID, formData.startDateTime, formData.endDateTime, formData.workShiftID, workShifts]);
  
  // Computed property for work shifts to display
  const displayWorkShifts = useMemo(() => {
    // If we have employee, start date, and end date, show only available shifts
    if (formData.employeeID && formData.startDateTime && formData.endDateTime) {
      return availableWorkShifts;
    }
    // Otherwise, show all work shifts
    return workShifts;
  }, [formData.employeeID, formData.startDateTime, formData.endDateTime, availableWorkShifts, workShifts]);
  
  // Watch for changes in employeeID, startDateTime, endDateTime to fetch available work shifts
  useEffect(() => {
    if (formData.employeeID && formData.startDateTime && formData.endDateTime) {
      // Debounce to avoid too many API calls
      const timer = setTimeout(() => {
        fetchAvailableWorkShifts();
      }, 300);
      return () => clearTimeout(timer);
    } else {
      // Reset available work shifts if any required field is missing
      setAvailableWorkShifts([]);
      setShiftAssignmentsInRange([]);
      if (!formData.employeeID || !formData.startDateTime || !formData.endDateTime) {
        setFormData(prev => ({ ...prev, workShiftID: '' }));
      }
    }
  }, [formData.employeeID, formData.startDateTime, formData.endDateTime, fetchAvailableWorkShifts]);

  const validateForm = () => {
    const newErrors = {};

    if (!formData.voucherCode.trim()) {
      newErrors.voucherCode = 'Số phiếu là bắt buộc';
    }

    if (!formData.employeeID) {
      newErrors.employeeID = 'Nhân viên là bắt buộc';
    }

    if (!formData.leaveTypeID) {
      newErrors.leaveTypeID = 'Loại nghỉ phép là bắt buộc';
    }

    if (!formData.workShiftID) {
      newErrors.workShiftID = 'Ca làm việc là bắt buộc';
    }

    if (!formData.startDateTime) {
      newErrors.startDateTime = 'Ngày bắt đầu là bắt buộc';
    } else {
      const startDate = new Date(formData.startDateTime);
      if (isNaN(startDate.getTime())) {
        newErrors.startDateTime = 'Định dạng ngày không hợp lệ';
      }
    }

    if (!formData.endDateTime) {
      newErrors.endDateTime = 'Ngày kết thúc là bắt buộc';
    } else {
      const endDate = new Date(formData.endDateTime);
      if (isNaN(endDate.getTime())) {
        newErrors.endDateTime = 'Định dạng ngày không hợp lệ';
      }
    }

    if (!formData.reason.trim()) {
      newErrors.reason = 'Lý do là bắt buộc';
    }

    // Validate date range
    if (formData.startDateTime && formData.endDateTime) {
      const startDate = new Date(formData.startDateTime);
      const endDate = new Date(formData.endDateTime);
      
      if (!isNaN(startDate.getTime()) && !isNaN(endDate.getTime())) {
        if (startDate >= endDate) {
          newErrors.endDateTime = 'Ngày kết thúc phải sau ngày bắt đầu';
        }
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      Alert.alert('Lỗi', 'Vui lòng kiểm tra lại thông tin');
      return;
    }

    // Chuẩn bị dữ liệu theo format của Vue form
    const submitData = {
      voucherCode: formData.voucherCode,
      employeeID: formData.employeeID,
      leaveTypeID: formData.leaveTypeID,
      workShiftID: formData.workShiftID,
      startDateTime: new Date(formData.startDateTime).toISOString(),
      endDateTime: new Date(formData.endDateTime).toISOString(),
      reason: formData.reason
    };
    
    try {
      // Check for overlapping overtime requests first (blocks creation)
      const overtimeOverlaps = checkOverlappingOvertimeRequests(
        formData.startDateTime,
        formData.endDateTime,
        formData.employeeID,
        overtimeRequests,
        overtimeForms
      );
      
      // Check for overlapping shift times with attendance data (blocks creation)
      const shiftOverlaps = await checkOverlappingShiftTimes(
        formData.startDateTime,
        formData.endDateTime,
        formData.employeeID,
        employees,
        leaveRequests,
        workShifts
      );
      
      // Check for overlapping leave requests (allows confirmation)
      const leaveOverlaps = checkOverlappingLeaveRequests(
        formData.startDateTime,
        formData.endDateTime,
        formData.employeeID,
        leaveRequests
      );
      
      // If there are overtime or shift overlaps, block creation
      if (overtimeOverlaps.length > 0 || shiftOverlaps.length > 0) {
        // Store all overlaps for display
        setOverlappingOvertimeRequests(overtimeOverlaps);
        setOverlappingShiftTimes(shiftOverlaps);
        setOverlappingRequests(leaveOverlaps);
        
        // Determine modal type
        const hasOvertime = overtimeOverlaps.length > 0;
        const hasShift = shiftOverlaps.length > 0;
        const hasLeave = leaveOverlaps.length > 0;
        
        if (hasOvertime && hasShift && hasLeave) {
          setOverlapModalType('all');
        } else if (hasOvertime && hasShift) {
          setOverlapModalType('overtime-shift');
        } else if (hasOvertime && hasLeave) {
          setOverlapModalType('overtime-leave');
        } else if (hasShift && hasLeave) {
          setOverlapModalType('shift-leave');
        } else if (hasOvertime) {
          setOverlapModalType('overtime');
        } else if (hasShift) {
          setOverlapModalType('shift');
        }
        
        // Show modal (no confirm button - blocks creation)
        setShowOverlapModal(true);
        return;
      }
      
      // If only leave overlaps, show confirmation modal (allows creation after confirmation)
      if (leaveOverlaps.length > 0) {
        setPendingSubmitData(submitData);
        setOverlappingRequests(leaveOverlaps);
        setOverlappingOvertimeRequests([]);
        setOverlappingShiftTimes([]);
        setOverlapModalType('leave');
        setShowOverlapModal(true);
        return;
      }
      
      // No overlaps, submit directly
      await doSubmit(submitData);
    } catch (error) {
      console.error('Error checking overlaps:', error);
      // If error occurs, still allow submission (fallback)
      await doSubmit(submitData);
    }
  };
  
  const doSubmit = async (submitData) => {
    setSubmitting(true);
    try {
      await createLeaveRequest(submitData);
      Alert.alert('Thành công', 'Tạo đơn nghỉ phép thành công', [
        { text: 'OK', onPress: () => navigation.goBack() }
      ]);
    } catch (error) {
      Alert.alert('Lỗi', `Không thể tạo đơn nghỉ phép: ${error.response?.data?.message || error.message}`);
    } finally {
      setSubmitting(false);
    }
  };
  
  
  const handleOverlapCancel = () => {
    setShowOverlapModal(false);
    setPendingSubmitData(null);
    setOverlappingRequests([]);
    setOverlappingOvertimeRequests([]);
    setOverlappingShiftTimes([]);
    setOverlapModalType('');
  };
  
  const handleOverlapConfirm = async () => {
    if (pendingSubmitData) {
      await doSubmit(pendingSubmitData);
      setShowOverlapModal(false);
      setPendingSubmitData(null);
      setOverlappingRequests([]);
      setOverlappingOvertimeRequests([]);
      setOverlappingShiftTimes([]);
      setOverlapModalType('');
    }
  };

  const formatDate = (date) => {
    if (!date) return '';
    try {
      const dateObj = new Date(date);
      if (isNaN(dateObj.getTime())) return '';
      return dateObj.toLocaleDateString('vi-VN');
    } catch {
      return '';
    }
  };

  const formatDateTime = (date) => {
    if (!date) return '';
    try {
      const dateObj = new Date(date);
      if (isNaN(dateObj.getTime())) return '';
      return dateObj.toLocaleString('vi-VN');
    } catch {
      return '';
    }
  };

  const handleStartDateChange = (event, selectedDate) => {
    if (selectedDate) {
      setTempStartDate(selectedDate);
    }
    
    // Nếu user bấm OK trên Android, tự động chuyển sang TimePicker
    if (event && event.type === 'set') {
      setShowStartDatePicker(false);
      // Khởi tạo thời gian với giờ hiện tại của ngày đã chọn
      const currentTime = new Date(selectedDate);
      currentTime.setHours(new Date().getHours());
      currentTime.setMinutes(new Date().getMinutes());
      setTempStartTime(currentTime);
      setShowStartTimePicker(true);
    }
  };

  const handleEndDateChange = (event, selectedDate) => {
    if (selectedDate) {
      setTempEndDate(selectedDate);
    }
    
    // Nếu user bấm OK trên Android, tự động chuyển sang TimePicker
    if (event && event.type === 'set') {
      setShowEndDatePicker(false);
      // Khởi tạo thời gian với giờ hiện tại của ngày đã chọn
      const currentTime = new Date(selectedDate);
      currentTime.setHours(new Date().getHours());
      currentTime.setMinutes(new Date().getMinutes());
      setTempEndTime(currentTime);
      setShowEndTimePicker(true);
    }
  };

  const confirmStartDate = () => {
    setFormData(prev => ({ ...prev, startDateTime: tempStartDate.toISOString() }));
    setShowStartDatePicker(false);
  };

  const confirmEndDate = () => {
    setFormData(prev => ({ ...prev, endDateTime: tempEndDate.toISOString() }));
    setShowEndDatePicker(false);
  };

  const cancelStartDate = () => {
    setShowStartDatePicker(false);
  };

  const cancelEndDate = () => {
    setShowEndDatePicker(false);
  };

  const handleStartTimeChange = (event, selectedTime) => {
    if (selectedTime) {
      setTempStartTime(selectedTime);
    }
    
    if (event && event.type === 'set') {
      setTimeout(() => {
        confirmStartDateTime();
      }, 100);
    }
  };

  const handleEndTimeChange = (event, selectedTime) => {
    if (selectedTime) {
      setTempEndTime(selectedTime);
    }
    
    if (event && event.type === 'set') {
      setTimeout(() => {
        confirmEndDateTime();
      }, 100);
    }
  };

  const confirmStartDateTime = () => {
    setTempStartTime(currentTempStartTime => {
      const combinedDateTime = new Date(tempStartDate);
      combinedDateTime.setHours(currentTempStartTime.getHours());
      combinedDateTime.setMinutes(currentTempStartTime.getMinutes());
      combinedDateTime.setSeconds(0);
      combinedDateTime.setMilliseconds(0);
      
      setFormData(prev => ({ ...prev, startDateTime: combinedDateTime.toISOString() }));
      
      setTimeout(() => {
        setShowStartDatePicker(false);
        setShowStartTimePicker(false);
      }, 100);
      
      return currentTempStartTime;
    });
  };

  const confirmEndDateTime = () => {
    setTempEndTime(currentTempEndTime => {
      const combinedDateTime = new Date(tempEndDate);
      combinedDateTime.setHours(currentTempEndTime.getHours());
      combinedDateTime.setMinutes(currentTempEndTime.getMinutes());
      combinedDateTime.setSeconds(0);
      combinedDateTime.setMilliseconds(0);
      
      setFormData(prev => ({ ...prev, endDateTime: combinedDateTime.toISOString() }));
      
      setTimeout(() => {
        setShowEndDatePicker(false);
        setShowEndTimePicker(false);
      }, 100);
      
      return currentTempEndTime;
    });
  };

  const cancelStartDateTime = () => {
    setShowStartDatePicker(false);
    setShowStartTimePicker(false);
  };

  const cancelEndDateTime = () => {
    setShowEndDatePicker(false);
    setShowEndTimePicker(false);
  };

  const generateVoucherCode = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const time = String(now.getTime()).slice(-4);
    return `LV${year}${month}${day}${time}`;
  };

  const handleGenerateVoucherCode = () => {
    setFormData(prev => ({
      ...prev,
      voucherCode: generateVoucherCode()
    }));
  };

  if (leaveTypeLoading || employeeLoading) {
    return (
      <View style={styles.container}>
        <CustomHeader title="Tạo đơn nghỉ phép" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3498db" />
          <Text style={styles.loadingText}>Đang tải dữ liệu...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CustomHeader title="Tạo đơn nghỉ phép" />

        {/* Form */}
        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.form}>
          {/* Voucher Code */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Số phiếu <Text style={styles.required}>*</Text></Text>
            <View style={styles.voucherCodeContainer}>
              <TextInput 
                style={[styles.input, errors.voucherCode && styles.inputError]} 
                value={formData.voucherCode} 
                onChangeText={(text) => setFormData(prev => ({ ...prev, voucherCode: text }))}
                placeholder="Nhập số phiếu"
              />
              <TouchableOpacity style={styles.generateBtn} onPress={handleGenerateVoucherCode}>
                <Icon name="refresh" size={20} color="#3498db" />
              </TouchableOpacity>
            </View>
            {errors.voucherCode && <Text style={styles.errorText}>{errors.voucherCode}</Text>}
          </View>

          {/* Employee */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Nhân viên <Text style={styles.required}>*</Text></Text>
            <TouchableOpacity 
              style={[
                styles.selectContainer,
                isRestrictedUser && styles.selectContainerDisabled
              ]}
              onPress={() => !isRestrictedUser && setShowEmployeeModal(true)}
              disabled={isRestrictedUser}
            >
              <Text style={[
                styles.selectText,
                isRestrictedUser && styles.selectTextDisabled
              ]}>
                {formData.employeeID 
                  ? availableEmployees.find(emp => emp.id === formData.employeeID)?.employeeName || 'Chọn nhân viên'
                  : 'Chọn nhân viên'
                }
              </Text>
              {!isRestrictedUser && <Icon name="chevron-down" size={20} color="#666" />}
            </TouchableOpacity>
            {errors.employeeID && <Text style={styles.errorText}>{errors.employeeID}</Text>}
          </View>

          {/* Leave Type */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Loại nghỉ phép <Text style={styles.required}>*</Text></Text>
            <TouchableOpacity 
              style={styles.selectContainer}
              onPress={() => setShowLeaveTypeModal(true)}
            >
              <Text style={styles.selectText}>
                {formData.leaveTypeID 
                  ? leaveTypes.find(type => type.id === formData.leaveTypeID)?.leaveTypeName || 'Chọn loại nghỉ phép'
                  : 'Chọn loại nghỉ phép'
                }
              </Text>
              <Icon name="chevron-down" size={20} color="#666" />
            </TouchableOpacity>
            {errors.leaveTypeID && <Text style={styles.errorText}>{errors.leaveTypeID}</Text>}
          </View>

          {/* Work Shift */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Ca làm việc <Text style={styles.required}>*</Text></Text>
            <TouchableOpacity 
              style={[
                styles.selectContainer,
                (!formData.employeeID || !formData.startDateTime || !formData.endDateTime || loadingShiftAssignments) && styles.selectContainerDisabled
              ]}
              onPress={() => {
                if (formData.employeeID && formData.startDateTime && formData.endDateTime && !loadingShiftAssignments) {
                  setShowWorkShiftModal(true);
                }
              }}
              disabled={!formData.employeeID || !formData.startDateTime || !formData.endDateTime || loadingShiftAssignments}
            >
              <Text style={[
                styles.selectText,
                (!formData.employeeID || !formData.startDateTime || !formData.endDateTime || loadingShiftAssignments) && styles.selectTextDisabled
              ]}>
                {loadingShiftAssignments 
                  ? 'Đang tải...'
                  : !formData.employeeID || !formData.startDateTime || !formData.endDateTime
                  ? 'Vui lòng chọn nhân viên, từ ngày và đến ngày trước'
                  : formData.workShiftID 
                  ? displayWorkShifts.find(shift => shift.id === formData.workShiftID)?.shiftName || 'Chọn ca làm việc'
                  : 'Chọn ca làm việc'
                }
              </Text>
              {(!loadingShiftAssignments && formData.employeeID && formData.startDateTime && formData.endDateTime) && (
                <Icon name="chevron-down" size={20} color="#666" />
              )}
            </TouchableOpacity>
            {errors.workShiftID && <Text style={styles.errorText}>{errors.workShiftID}</Text>}
            {formData.employeeID && formData.startDateTime && formData.endDateTime && availableWorkShifts.length === 0 && !loadingShiftAssignments && (
              <Text style={styles.warningText}>
                Không có ca làm việc nào được phân cho nhân viên này trong khoảng thời gian đã chọn.
              </Text>
            )}
          </View>

          {/* Start Date */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Từ ngày <Text style={styles.required}>*</Text></Text>
            <TouchableOpacity 
              style={[styles.input, styles.dateInput, errors.startDateTime && styles.inputError]} 
              onPress={() => {
                const currentDate = formData.startDateTime ? new Date(formData.startDateTime) : new Date();
                setTempStartDate(currentDate);
                // Khởi tạo thời gian với giờ hiện tại của ngày đã chọn
                const currentTime = new Date(currentDate);
                currentTime.setHours(new Date().getHours());
                currentTime.setMinutes(new Date().getMinutes());
                setTempStartTime(currentTime);
                setShowStartDatePicker(true);
              }}
            >
              <Text style={[styles.dateText, !formData.startDateTime && styles.placeholderText]}>
                {formData.startDateTime ? formatDateTime(formData.startDateTime) : 'Chọn ngày bắt đầu'}
              </Text>
              <Icon name="calendar" size={20} color="#3498db" />
            </TouchableOpacity>
            {errors.startDateTime && <Text style={styles.errorText}>{errors.startDateTime}</Text>}
          </View>

          {/* End Date */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Đến ngày <Text style={styles.required}>*</Text></Text>
            <TouchableOpacity 
              style={[styles.input, styles.dateInput, errors.endDateTime && styles.inputError]} 
              onPress={() => {
                const currentDate = formData.endDateTime ? new Date(formData.endDateTime) : new Date();
                setTempEndDate(currentDate);
                // Khởi tạo thời gian với giờ hiện tại của ngày đã chọn
                const currentTime = new Date(currentDate);
                currentTime.setHours(new Date().getHours());
                currentTime.setMinutes(new Date().getMinutes());
                setTempEndTime(currentTime);
                setShowEndDatePicker(true);
              }}
            >
              <Text style={[styles.dateText, !formData.endDateTime && styles.placeholderText]}>
                {formData.endDateTime ? formatDateTime(formData.endDateTime) : 'Chọn ngày kết thúc'}
              </Text>
              <Icon name="calendar" size={20} color="#3498db" />
            </TouchableOpacity>
            {errors.endDateTime && <Text style={styles.errorText}>{errors.endDateTime}</Text>}
          </View>

          {/* Reason */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Lý do <Text style={styles.required}>*</Text></Text>
            <TextInput 
              style={[styles.textArea, errors.reason && styles.inputError]} 
              value={formData.reason} 
              onChangeText={(text) => setFormData(prev => ({ ...prev, reason: text }))}
              placeholder="Nhập lý do nghỉ phép"
              multiline
              numberOfLines={4}
            />
            {errors.reason && <Text style={styles.errorText}>{errors.reason}</Text>}
          </View>

          {/* Submit Button */}
          <TouchableOpacity 
            style={[styles.submitBtn, (submitting || leaveLoading) && styles.submitBtnDisabled]} 
            onPress={handleSubmit}
            disabled={submitting || leaveLoading}
          >
            <View style={styles.submitBtnSolid}>
              {submitting || leaveLoading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.submitText}>Tạo đơn nghỉ phép</Text>
              )}
            </View>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Employee Selection Modal */}
      <Modal
        visible={showEmployeeModal}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowEmployeeModal(false)}>
              <Text style={styles.modalCancelText}>Hủy</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Chọn nhân viên</Text>
            <View style={{ width: 50 }} />
          </View>
          
          <ScrollView style={styles.modalContent}>
            {availableEmployees.map((employee) => (
              <TouchableOpacity
                key={employee.id}
                style={styles.modalItem}
                onPress={() => {
                  setFormData(prev => ({ ...prev, employeeID: employee.id }));
                  setShowEmployeeModal(false);
                }}
              >
                <Text style={styles.modalItemText}>{employee.employeeName}</Text>
                {formData.employeeID === employee.id && (
                  <Icon name="check" size={20} color="#3498db" />
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </Modal>

      {/* Leave Type Selection Modal */}
      <Modal
        visible={showLeaveTypeModal}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowLeaveTypeModal(false)}>
              <Text style={styles.modalCancelText}>Hủy</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Chọn loại nghỉ phép</Text>
            <View style={{ width: 50 }} />
          </View>
          
          <ScrollView style={styles.modalContent}>
            {leaveTypes.map((leaveType) => (
              <TouchableOpacity
                key={leaveType.id}
                style={styles.modalItem}
                onPress={() => {
                  setFormData(prev => ({ ...prev, leaveTypeID: leaveType.id }));
                  setShowLeaveTypeModal(false);
                }}
              >
                <Text style={styles.modalItemText}>{leaveType.leaveTypeName}</Text>
                {formData.leaveTypeID === leaveType.id && (
                  <Icon name="check" size={20} color="#3498db" />
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </Modal>

      {/* Work Shift Selection Modal */}
      <Modal
        visible={showWorkShiftModal}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowWorkShiftModal(false)}>
              <Text style={styles.modalCancelText}>Hủy</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Chọn ca làm việc</Text>
            <View style={{ width: 50 }} />
          </View>
          <ScrollView style={styles.modalBody}>
            {displayWorkShifts.length === 0 ? (
              <View style={styles.modalEmptyContainer}>
                <Text style={styles.modalEmptyText}>
                  Không có ca làm việc nào được phân cho nhân viên này trong khoảng thời gian đã chọn.
                </Text>
              </View>
            ) : (
              displayWorkShifts.map((shift) => (
                <TouchableOpacity
                  key={shift.id}
                  style={styles.modalItem}
                  onPress={() => {
                    setFormData(prev => ({ ...prev, workShiftID: shift.id }));
                    setShowWorkShiftModal(false);
                  }}
                >
                  <Text style={styles.modalItemText}>{shift.shiftName}</Text>
                  {formData.workShiftID === shift.id && (
                    <Icon name="check" size={20} color="#3498db" />
                  )}
                </TouchableOpacity>
              ))
            )}
          </ScrollView>
        </View>
      </Modal>

      {/* Start Date & Time Picker */}
      {showStartDatePicker && (
        <Modal transparent={true} animationType="slide">
          <View style={styles.datePickerContainer}>
            <View style={styles.datePickerContent}>
              <View style={styles.datePickerHeader}>
                <TouchableOpacity onPress={cancelStartDateTime}>
                  <Text style={styles.datePickerButton}>Hủy</Text>
                </TouchableOpacity>
                <Text style={styles.datePickerTitle}>Chọn ngày bắt đầu</Text>
                <View style={{ width: 50 }} />
              </View>
              <DateTimePicker
                value={tempStartDate}
                mode="date"
                display="default"
                onChange={handleStartDateChange}
                style={styles.datePicker}
                textColor="#000"
                accentColor="#3498db"
              />
            </View>
          </View>
        </Modal>
      )}

      {showStartTimePicker && (
        <Modal transparent={true} animationType="slide">
          <View style={styles.datePickerContainer}>
            <View style={styles.datePickerContent}>
              <View style={styles.datePickerHeader}>
                <TouchableOpacity onPress={cancelStartDateTime}>
                  <Text style={styles.datePickerButton}>Hủy</Text>
                </TouchableOpacity>
                <Text style={styles.datePickerTitle}>Chọn giờ bắt đầu</Text>
                <View style={{ width: 50 }} />
              </View>
              <DateTimePicker
                value={tempStartTime}
                mode="time"
                display="default"
                onChange={handleStartTimeChange}
                style={styles.datePicker}
                textColor="#000"
                accentColor="#3498db"
              />
            </View>
          </View>
        </Modal>
      )}

      {/* End Date & Time Picker */}
      {showEndDatePicker && (
        <Modal transparent={true} animationType="slide">
          <View style={styles.datePickerContainer}>
            <View style={styles.datePickerContent}>
              <View style={styles.datePickerHeader}>
                <TouchableOpacity onPress={cancelEndDateTime}>
                  <Text style={styles.datePickerButton}>Hủy</Text>
                </TouchableOpacity>
                <Text style={styles.datePickerTitle}>Chọn ngày kết thúc</Text>
                <View style={{ width: 50 }} />
              </View>
              <DateTimePicker
                value={tempEndDate}
                mode="date"
                display="default"
                onChange={handleEndDateChange}
                style={styles.datePicker}
                textColor="#000"
                accentColor="#3498db"
              />
            </View>
          </View>
        </Modal>
      )}

      {showEndTimePicker && (
        <Modal transparent={true} animationType="slide">
          <View style={styles.datePickerContainer}>
            <View style={styles.datePickerContent}>
              <View style={styles.datePickerHeader}>
                <TouchableOpacity onPress={cancelEndDateTime}>
                  <Text style={styles.datePickerButton}>Hủy</Text>
                </TouchableOpacity>
                <Text style={styles.datePickerTitle}>Chọn giờ kết thúc</Text>
                <View style={{ width: 50 }} />
              </View>
              <DateTimePicker
                value={tempEndTime}
                mode="time"
                display="default"
                onChange={handleEndTimeChange}
                style={styles.datePicker}
                textColor="#000"
                accentColor="#3498db"
              />
            </View>
          </View>
        </Modal>
      )}
      
      {/* Overlap Confirmation Modal */}
      <Modal
        visible={showOverlapModal}
        animationType="slide"
        transparent={true}
      >
        <View style={styles.overlapModalContainer}>
          <View style={styles.overlapModalContent}>
            <View style={styles.overlapModalHeader}>
              <Text style={styles.overlapModalTitle}>
                {overlapModalType === 'leave' 
                  ? 'Cảnh báo: Đơn nghỉ phép trùng lặp' 
                  : 'Cảnh báo: Không thể tạo đơn nghỉ phép'}
              </Text>
            </View>
            <RNScrollView style={styles.overlapModalBody}>
              {/* Warning message based on overlap type */}
              {overlapModalType === 'leave' ? (
                <View style={[styles.overlapModalInfo, { backgroundColor: '#fff3cd' }]}>
                  <Text style={styles.overlapModalInfoText}>
                    <Icon name="alert-circle" size={16} color="#856404" /> Đơn nghỉ phép này trùng lặp với {overlappingRequests.length} đơn nghỉ phép đã duyệt khác.
                  </Text>
                </View>
              ) : (
                <View style={[styles.overlapModalInfo, { backgroundColor: '#f8d7da' }]}>
                  <Text style={[styles.overlapModalInfoText, { color: '#721c24' }]}>
                    <Icon name="alert-circle" size={16} color="#721c24" /> Đơn nghỉ phép này trùng với đơn tăng ca đã duyệt hoặc ca làm việc đã có dữ liệu chấm công. Không thể tạo đơn.
                  </Text>
                </View>
              )}
              
              {/* Overtime Requests Section */}
              {(overlapModalType === 'overtime' || overlapModalType === 'overtime-leave' || overlapModalType === 'overtime-shift' || overlapModalType === 'all') && overlappingOvertimeRequests.length > 0 && (
                <View style={styles.overlapSection}>
                  <Text style={styles.overlapSectionTitle}>
                    <Icon name="clock" size={16} color="#1976d2" /> Đơn tăng ca trùng lặp ({overlappingOvertimeRequests.length})
                  </Text>
                  {overlappingOvertimeRequests.map((request, index) => (
                    <View key={index} style={styles.overlapItem}>
                      <Text style={styles.overlapItemText}>
                        <Text style={{ fontWeight: 'bold' }}>Số phiếu:</Text> {request.voucherCode}{'\n'}
                        <Text style={{ fontWeight: 'bold' }}>Hình thức tăng ca:</Text> {request.overtimeFormName}{'\n'}
                        <Text style={{ fontWeight: 'bold' }}>Từ ngày:</Text> {new Date(request.startDateTime).toLocaleString('vi-VN')}{'\n'}
                        <Text style={{ fontWeight: 'bold' }}>Đến ngày:</Text> {new Date(request.endDateTime).toLocaleString('vi-VN')}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
              
              {/* Shift Times Section */}
              {(overlapModalType === 'shift' || overlapModalType === 'shift-leave' || overlapModalType === 'overtime-shift' || overlapModalType === 'all') && overlappingShiftTimes.length > 0 && (
                <View style={styles.overlapSection}>
                  <Text style={styles.overlapSectionTitle}>
                    <Icon name="clock" size={16} color="#1976d2" /> Ca làm việc có dữ liệu chấm công ({overlappingShiftTimes.length})
                  </Text>
                  {overlappingShiftTimes.map((shift, index) => (
                    <View key={index} style={styles.overlapItem}>
                      <Text style={styles.overlapItemText}>
                        <Text style={{ fontWeight: 'bold' }}>Ngày:</Text> {shift.workDate}{'\n'}
                        <Text style={{ fontWeight: 'bold' }}>Ca làm việc:</Text> {shift.shiftName}{'\n'}
                        <Text style={{ fontWeight: 'bold' }}>Giờ bắt đầu:</Text> {shift.startTime}{'\n'}
                        <Text style={{ fontWeight: 'bold' }}>Giờ kết thúc:</Text> {shift.endTime}{'\n'}
                        <Text style={{ fontWeight: 'bold' }}>Trạng thái:</Text> {shift.hasAttendance ? 'Có dữ liệu chấm công' : 'N/A'}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
              
              {/* Leave Requests Section */}
              {(overlapModalType === 'leave' || overlapModalType === 'overtime-leave' || overlapModalType === 'shift-leave' || overlapModalType === 'all') && overlappingRequests.length > 0 && (
                <View style={styles.overlapSection}>
                  <Text style={styles.overlapSectionTitle}>Đơn nghỉ phép trùng lặp ({overlappingRequests.length})</Text>
                  {overlappingRequests.map((request, index) => (
                    <View key={index} style={styles.overlapItem}>
                      <Text style={styles.overlapItemText}>
                        <Text style={{ fontWeight: 'bold' }}>Số phiếu:</Text> {request.voucherCode}{'\n'}
                        <Text style={{ fontWeight: 'bold' }}>Loại nghỉ phép:</Text> {request.leaveTypeName}{'\n'}
                        <Text style={{ fontWeight: 'bold' }}>Từ ngày:</Text> {new Date(request.startDateTime).toLocaleString('vi-VN')}{'\n'}
                        <Text style={{ fontWeight: 'bold' }}>Đến ngày:</Text> {new Date(request.endDateTime).toLocaleString('vi-VN')}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
              
              {/* Info message */}
              <View style={[styles.overlapModalInfo, { backgroundColor: overlapModalType === 'leave' ? '#fff3cd' : '#d1ecf1' }]}>
                <Text style={styles.overlapModalInfoText}>
                  <Icon name="information" size={16} color={overlapModalType === 'leave' ? '#856404' : '#0c5460'} /> 
                  {overlapModalType === 'leave' 
                    ? ' Lưu ý: Hệ thống sẽ tính theo đơn có thời gian nghỉ dài hơn trong mỗi ngày.'
                    : ' Vui lòng kiểm tra và điều chỉnh thời gian đơn nghỉ phép để tránh trùng lặp.'}
                </Text>
              </View>
            </RNScrollView>
            <View style={styles.overlapModalFooter}>
              {/* If only leave overlaps, show cancel and confirm buttons */}
              {overlapModalType === 'leave' ? (
                <>
                  <TouchableOpacity 
                    style={[styles.overlapModalButton, { backgroundColor: '#6c757d', marginRight: 8 }]} 
                    onPress={handleOverlapCancel}
                  >
                    <Text style={styles.overlapModalButtonText}>Hủy</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={[styles.overlapModalButton, { backgroundColor: '#3498db' }]} 
                    onPress={handleOverlapConfirm}
                  >
                    <Text style={styles.overlapModalButtonText}>Xác nhận tạo đơn</Text>
                  </TouchableOpacity>
                </>
              ) : (
                /* If overtime or shift overlaps, only show close button (blocks creation) */
                <TouchableOpacity 
                  style={[styles.overlapModalButton, { backgroundColor: '#6c757d' }]} 
                  onPress={handleOverlapCancel}
                >
                  <Text style={styles.overlapModalButtonText}>Đóng</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </Modal>
      </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  scrollView: { flex: 1 },
  form: { 
    backgroundColor: '#fff', 
    margin: 16, 
    borderRadius: 16, 
    padding: 20, 
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
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
    color: '#3498db',
    fontWeight: '500',
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: { 
    fontWeight: 'bold', 
    color: '#3498db', 
    marginBottom: 8,
    fontSize: 16,
  },
  required: {
    color: '#e53935',
  },
  input: { 
    backgroundColor: '#f6f8fa', 
    borderRadius: 10, 
    padding: 14,
    fontSize: 16,
    borderWidth: 1.5,
    borderColor: '#e0e0e0',
    color: '#2c3e50',
  },
  inputError: {
    borderColor: '#e53935',
    backgroundColor: '#ffebee',
  },
  dateInput: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f6f8fa',
    borderRadius: 10,
    padding: 14,
    borderWidth: 1.5,
    borderColor: '#e0e0e0',
  },
  dateText: {
    fontSize: 16,
    color: '#333',
    flex: 1,
  },
  placeholderText: {
    color: '#999',
  },
  voucherCodeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  generateBtn: {
    marginLeft: 8,
    padding: 8,
    backgroundColor: '#e3f2fd',
    borderRadius: 8,
  },
  selectContainer: {
    backgroundColor: '#f6f8fa',
    borderRadius: 10,
    padding: 14,
    borderWidth: 1.5,
    borderColor: '#e0e0e0',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  selectText: {
    fontSize: 16,
    color: '#333',
    flex: 1,
  },
  selectTextDisabled: {
    color: '#999',
  },
  selectContainerDisabled: {
    backgroundColor: '#f0f0f0',
    opacity: 0.7,
  },
  textArea: {
    backgroundColor: '#f6f8fa',
    borderRadius: 10,
    padding: 14,
    fontSize: 16,
    borderWidth: 1.5,
    borderColor: '#e0e0e0',
    textAlignVertical: 'top',
    minHeight: 100,
    color: '#2c3e50',
  },
  errorText: {
    color: '#e53935',
    fontSize: 14,
    marginTop: 4,
  },
  submitBtn: { 
    borderRadius: 12, 
    marginTop: 20, 
    overflow: 'hidden',
    shadowColor: '#3498db',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  submitBtnSolid: {
    backgroundColor: '#3498db',
    alignItems: 'center', 
    padding: 16,
    borderRadius: 12,
  },
  submitBtnDisabled: {
    backgroundColor: '#ccc',
  },
  submitText: { 
    color: '#fff', 
    fontWeight: 'bold', 
    fontSize: 16 
  },
  // Modal styles
  modalContainer: {
    flex: 1,
    backgroundColor: '#f6f8fa',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderColor: '#e0e0e0',
  },
  modalCancelText: {
    fontSize: 16,
    color: '#3498db',
    fontWeight: '500',
  },
  modalDoneText: {
    fontSize: 16,
    color: '#3498db',
    fontWeight: 'bold',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },
  datePickerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    padding: 16,
    marginBottom: 8,
    borderRadius: 8,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  modalItemText: {
    fontSize: 16,
    color: '#333',
    flex: 1,
  },
  helpText: {
    color: '#666',
    fontSize: 12,
    marginTop: 4,
    fontStyle: 'italic',
  },
  warningText: {
    color: '#856404',
    fontSize: 12,
    marginTop: 4,
  },
  modalEmptyContainer: {
    padding: 20,
    alignItems: 'center',
  },
  modalEmptyText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  // Overlap modal styles
  overlapModalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  overlapModalContent: {
    backgroundColor: '#fff',
    borderRadius: 12,
    width: '100%',
    maxWidth: 500,
    maxHeight: '80%',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  overlapModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    backgroundColor: '#f8f9fa',
  },
  overlapModalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  overlapModalBody: {
    maxHeight: 400,
    padding: 16,
  },
  overlapModalText: {
    fontSize: 16,
    color: '#333',
    marginBottom: 16,
  },
  overlapSection: {
    marginBottom: 16,
  },
  overlapSectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#3498db',
    
    marginBottom: 8,
  },
  overlapItem: {
    marginBottom: 4,
    paddingLeft: 8,
  },
  overlapItemText: {
    fontSize: 14,
    color: '#666',
  },
  overlapModalInfo: {
    marginTop: 16,
    padding: 12,
    backgroundColor: '#fff3cd',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ffc107',
  },
  overlapModalInfoText: {
    fontSize: 14,
    color: '#856404',
  },
  overlapModalFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  overlapModalButton: {
    borderRadius: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  overlapModalButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
