import { useNavigation, useRoute } from '@react-navigation/native';
import { useEffect, useState, useMemo, useCallback } from 'react';
import { 
  ActivityIndicator, 
  Alert, 
  Modal,
  ScrollView, 
  StyleSheet, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  View 
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useLeaveRequest } from '../../../composables/useLeaveRequest';
import { useLeaveType } from '../../../composables/useLeaveType';
import { useEmployee } from '../../../composables/useEmployee';
import { useWorkShift } from '../../../composables/useWorkShift';
import { useOvertimeRequest } from '../../../composables/useOvertimeRequest';
import { useOvertimeForm } from '../../../composables/useOvertimeForm';
import { useAuth } from '../../../contexts/AuthContext';
import CustomHeader from '../../../components/CustomHeader';
import { 
  getShiftAssignmentsByDateRange, 
  validateAllDaysHaveShifts, 
  checkOverlappingLeaveRequests,
  formatDateForAPI 
} from '../../../utils/leaveFormHelpers';
import {
  checkOverlappingOvertimeRequests,
  checkOverlappingShiftTimes
} from '../../../utils/overtimeOverlapHelpers';
import { ScrollView as RNScrollView } from 'react-native';

export default function EditLeaveScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { id } = route.params;
  const { user, isDirector, isHRManager, isHREmployee } = useAuth();
  const { 
    getLeaveRequestById, 
    updateLeaveRequest,
    fetchLeaveRequests,
    leaveRequests,
    loading: leaveLoading 
  } = useLeaveRequest();
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
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  const [tempStartDate, setTempStartDate] = useState(new Date());
  const [tempEndDate, setTempEndDate] = useState(new Date());
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  
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

  const loadInitialData = async () => {
    try {
      setLoading(true);
      await Promise.all([
        fetchLeaveTypes(),
        fetchAllEmployees(),
        fetchWorkShifts(),
        fetchLeaveRequests(), // Load leave requests for overlap checking
        fetchOvertimeRequests(), // Load overtime requests for overlap checking
        fetchOvertimeForms(), // Load overtime forms for overlap display
        loadLeaveRequest()
      ]);
    } catch (error) {
      Alert.alert('Lỗi', 'Không thể tải dữ liệu');
    } finally {
      setLoading(false);
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

  const loadLeaveRequest = async () => {
    try {
      const leaveRequest = await getLeaveRequestById(id);
      if (leaveRequest) {
        // If user is restricted (technician/worker), ensure employeeID is set to user.id
        let employeeID = leaveRequest.employeeID || '';
        const userRole = user?.role;
        if (user?.id && ['technician', 'worker', 'TECHNICIAN', 'WORKER', '4', '1'].includes(userRole)) {
          employeeID = user.id;
        }
        
        const newFormData = {
          voucherCode: leaveRequest.voucherCode || '',
          employeeID: employeeID,
          leaveTypeID: leaveRequest.leaveTypeID || '',
          workShiftID: leaveRequest.workShiftID || '',
          startDateTime: leaveRequest.startDateTime || '',
          endDateTime: leaveRequest.endDateTime || '',
          reason: leaveRequest.reason || ''
        };
        setFormData(newFormData);
        
        // Fetch available work shifts if we have all required fields
        if (newFormData.employeeID && newFormData.startDateTime && newFormData.endDateTime) {
          setTimeout(() => {
            fetchAvailableWorkShifts();
          }, 500);
        }
      }
    } catch (error) {
      Alert.alert('Lỗi', 'Không thể tải thông tin đơn nghỉ phép');
    }
  };

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

    const submitData = {
      ...formData,
      startDateTime: new Date(formData.startDateTime).toISOString(),
      endDateTime: new Date(formData.endDateTime).toISOString()
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
      
      // Check for overlapping leave requests (exclude current voucher code)
      const leaveOverlaps = checkOverlappingLeaveRequests(
        formData.startDateTime,
        formData.endDateTime,
        formData.employeeID,
        leaveRequests,
        formData.voucherCode // Exclude current leave request
      );
      
      // If there are overtime or shift overlaps, block update
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
        
        // Show modal (no confirm button - blocks update)
        setShowOverlapModal(true);
        return;
      }
      
      // If only leave overlaps, also block for edit (to be consistent)
      if (leaveOverlaps.length > 0) {
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
      await updateLeaveRequest(formData.voucherCode, submitData);
      Alert.alert('Thành công', 'Cập nhật đơn nghỉ phép thành công', [
        { text: 'OK', onPress: () => navigation.goBack() }
      ]);
    } catch (error) {
      Alert.alert('Lỗi', 'Không thể cập nhật đơn nghỉ phép');
    } finally {
      setSubmitting(false);
    }
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
  
  const handleOverlapCancel = () => {
    setShowOverlapModal(false);
    setPendingSubmitData(null);
    setOverlappingRequests([]);
    setOverlappingOvertimeRequests([]);
    setOverlappingShiftTimes([]);
    setOverlapModalType('');
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
  };

  const handleEndDateChange = (event, selectedDate) => {
    if (selectedDate) {
      setTempEndDate(selectedDate);
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

  if (loading || leaveTypeLoading || employeeLoading) {
    return (
      <View style={styles.container}>
        <CustomHeader title="Sửa đơn nghỉ phép" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3498db" />
          <Text style={styles.loadingText}>Đang tải dữ liệu...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CustomHeader title="Sửa đơn nghỉ phép" />

        {/* Form */}
        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.form}>
          {/* Voucher Code */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Số phiếu <Text style={styles.required}>*</Text></Text>
            <TextInput 
              style={[styles.input, errors.voucherCode && styles.inputError]} 
              value={formData.voucherCode} 
              onChangeText={(text) => setFormData(prev => ({ ...prev, voucherCode: text }))}
              placeholder="Nhập số phiếu"
              editable={false}
            />
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

          {/* Start Date */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Từ ngày <Text style={styles.required}>*</Text></Text>
            <TouchableOpacity 
              style={[styles.input, styles.dateInput, errors.startDateTime && styles.inputError]} 
              onPress={() => {
                setTempStartDate(formData.startDateTime ? new Date(formData.startDateTime) : new Date());
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
                setTempEndDate(formData.endDateTime ? new Date(formData.endDateTime) : new Date());
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
                <Text style={styles.submitText}>Cập nhật đơn nghỉ phép</Text>
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

      {/* DateTimePicker Components */}
      {showStartDatePicker && (
        <Modal transparent={true} animationType="slide">
          <View style={styles.datePickerContainer}>
            <View style={styles.datePickerContent}>
              <View style={styles.datePickerHeader}>
                <TouchableOpacity onPress={cancelStartDate}>
                  <Text style={styles.datePickerButton}>Hủy</Text>
                </TouchableOpacity>
                <Text style={styles.datePickerTitle}>Chọn ngày bắt đầu</Text>
                <TouchableOpacity onPress={confirmStartDate}>
                  <Text style={styles.datePickerButton}>Xong</Text>
                </TouchableOpacity>
              </View>
              <DateTimePicker
                value={tempStartDate}
                mode="datetime"
                display="spinner"
                onChange={handleStartDateChange}
                style={styles.datePicker}
                textColor="#000"
                accentColor="#3498db"
              />
            </View>
          </View>
        </Modal>
      )}

      {showEndDatePicker && (
        <Modal transparent={true} animationType="slide">
          <View style={styles.datePickerContainer}>
            <View style={styles.datePickerContent}>
              <View style={styles.datePickerHeader}>
                <TouchableOpacity onPress={cancelEndDate}>
                  <Text style={styles.datePickerButton}>Hủy</Text>
                </TouchableOpacity>
                <Text style={styles.datePickerTitle}>Chọn ngày kết thúc</Text>
                <TouchableOpacity onPress={confirmEndDate}>
                  <Text style={styles.datePickerButton}>Xong</Text>
                </TouchableOpacity>
              </View>
              <DateTimePicker
                value={tempEndDate}
                mode="datetime"
                display="spinner"
                onChange={handleEndDateChange}
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
                  : 'Cảnh báo: Không thể cập nhật đơn nghỉ phép'}
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
                    <Icon name="alert-circle" size={16} color="#721c24" /> Đơn nghỉ phép này trùng với đơn tăng ca đã duyệt hoặc ca làm việc đã có dữ liệu chấm công. Không thể cập nhật đơn.
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
                    <Text style={styles.overlapModalButtonText}>Xác nhận cập nhật</Text>
                  </TouchableOpacity>
                </>
              ) : (
                /* If overtime or shift overlaps, only show close button (blocks update) */
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
  datePickerContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  datePickerContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 20,
  },
  datePickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  datePickerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  datePickerButton: {
    fontSize: 16,
    color: '#3498db',
    fontWeight: '600',
  },
  datePicker: {
    height: 300,
    backgroundColor: '#fff',
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
