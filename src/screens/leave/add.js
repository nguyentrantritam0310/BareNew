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
import CustomHeader from '../../components/CustomHeader';

export default function AddLeaveScreen() {
  const navigation = useNavigation();
  const { createLeaveRequest, loading: leaveLoading } = useLeaveRequest();
  const { leaveTypes, fetchLeaveTypes, loading: leaveTypeLoading } = useLeaveType();
  const { employees, fetchAllEmployees, loading: employeeLoading } = useEmployee();
  const { workShifts, fetchWorkShifts, loading: workShiftLoading } = useWorkShift();

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

  // Load data on mount
  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    try {
      await Promise.all([
        fetchLeaveTypes(),
        fetchAllEmployees(),
        fetchWorkShifts()
      ]);
    } catch (error) {
      console.error('Error loading initial data:', error);
      Alert.alert('Lỗi', 'Không thể tải dữ liệu khởi tạo');
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

    setSubmitting(true);
    try {
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

      console.log('Form Data:', formData);
      console.log('Submit Data:', submitData);
      console.log('Start DateTime:', formData.startDateTime);
      console.log('End DateTime:', formData.endDateTime);

      await createLeaveRequest(submitData);
      Alert.alert('Thành công', 'Tạo đơn nghỉ phép thành công', [
        { text: 'OK', onPress: () => navigation.goBack() }
      ]);
    } catch (error) {
      console.error('Error creating leave request:', error);
      console.error('Error response:', error.response?.data);
      console.error('Error status:', error.response?.status);
      Alert.alert('Lỗi', `Không thể tạo đơn nghỉ phép: ${error.response?.data?.message || error.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (date) => {
    if (!date) return '';
    return new Date(date).toLocaleDateString('vi-VN');
  };

  const formatDateTime = (date) => {
    if (!date) return '';
    return new Date(date).toLocaleString('vi-VN');
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
    console.log('handleStartTimeChange - event:', event);
    console.log('handleStartTimeChange - selectedTime:', selectedTime);
    
    if (selectedTime) {
      console.log('Setting tempStartTime to:', selectedTime);
      console.log('Selected time hours:', selectedTime.getHours());
      console.log('Selected time minutes:', selectedTime.getMinutes());
      setTempStartTime(selectedTime);
    }
    
    // Nếu user bấm OK trên Android, tự động confirm
    if (event && event.type === 'set') {
      console.log('User pressed OK, confirming start date time');
      // Sử dụng setTimeout để đảm bảo state được cập nhật trước khi confirm
      setTimeout(() => {
        confirmStartDateTime();
      }, 100);
    }
  };

  const handleEndTimeChange = (event, selectedTime) => {
    console.log('handleEndTimeChange - event:', event);
    console.log('handleEndTimeChange - selectedTime:', selectedTime);
    
    if (selectedTime) {
      console.log('Setting tempEndTime to:', selectedTime);
      console.log('Selected time hours:', selectedTime.getHours());
      console.log('Selected time minutes:', selectedTime.getMinutes());
      setTempEndTime(selectedTime);
    }
    
    // Nếu user bấm OK trên Android, tự động confirm
    if (event && event.type === 'set') {
      console.log('User pressed OK, confirming end date time');
      // Sử dụng setTimeout để đảm bảo state được cập nhật trước khi confirm
      setTimeout(() => {
        confirmEndDateTime();
      }, 100);
    }
  };

  const confirmStartDateTime = () => {
    console.log('confirmStartDateTime called');
    console.log('tempStartDate:', tempStartDate);
    console.log('tempStartTime:', tempStartTime);
    
    // Sử dụng callback để đảm bảo có state mới nhất
    setTempStartTime(currentTempStartTime => {
      console.log('Current tempStartTime in callback:', currentTempStartTime);
      
      // Kết hợp ngày và giờ
      const combinedDateTime = new Date(tempStartDate);
      combinedDateTime.setHours(currentTempStartTime.getHours());
      combinedDateTime.setMinutes(currentTempStartTime.getMinutes());
      combinedDateTime.setSeconds(0);
      combinedDateTime.setMilliseconds(0);
      
      console.log('Combined DateTime:', combinedDateTime);
      console.log('Combined DateTime Hours:', combinedDateTime.getHours());
      console.log('Combined DateTime Minutes:', combinedDateTime.getMinutes());
      console.log('ISO String:', combinedDateTime.toISOString());
      
      setFormData(prev => ({ ...prev, startDateTime: combinedDateTime.toISOString() }));
      
      // Đóng modal
      setTimeout(() => {
        setShowStartDatePicker(false);
        setShowStartTimePicker(false);
        console.log('Start DateTime modal closed');
      }, 100);
      
      return currentTempStartTime;
    });
  };

  const confirmEndDateTime = () => {
    console.log('confirmEndDateTime called');
    console.log('tempEndDate:', tempEndDate);
    console.log('tempEndTime:', tempEndTime);
    
    // Sử dụng callback để đảm bảo có state mới nhất
    setTempEndTime(currentTempEndTime => {
      console.log('Current tempEndTime in callback:', currentTempEndTime);
      
      // Kết hợp ngày và giờ
      const combinedDateTime = new Date(tempEndDate);
      combinedDateTime.setHours(currentTempEndTime.getHours());
      combinedDateTime.setMinutes(currentTempEndTime.getMinutes());
      combinedDateTime.setSeconds(0);
      combinedDateTime.setMilliseconds(0);
      
      console.log('Combined DateTime:', combinedDateTime);
      console.log('Combined DateTime Hours:', combinedDateTime.getHours());
      console.log('Combined DateTime Minutes:', combinedDateTime.getMinutes());
      console.log('ISO String:', combinedDateTime.toISOString());
      
      setFormData(prev => ({ ...prev, endDateTime: combinedDateTime.toISOString() }));
      
      // Đóng modal
      setTimeout(() => {
        setShowEndDatePicker(false);
        setShowEndTimePicker(false);
        console.log('End DateTime modal closed');
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
                <Icon name="refresh" size={20} color="#008080" />
              </TouchableOpacity>
            </View>
            {errors.voucherCode && <Text style={styles.errorText}>{errors.voucherCode}</Text>}
          </View>

          {/* Employee */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Nhân viên <Text style={styles.required}>*</Text></Text>
            <TouchableOpacity 
              style={styles.selectContainer}
              onPress={() => setShowEmployeeModal(true)}
            >
              <Text style={styles.selectText}>
                {formData.employeeID 
                  ? employees.find(emp => emp.id === formData.employeeID)?.employeeName || 'Chọn nhân viên'
                  : 'Chọn nhân viên'
                }
              </Text>
              <Icon name="chevron-down" size={20} color="#666" />
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
              style={styles.selectContainer}
              onPress={() => setShowWorkShiftModal(true)}
            >
              <Text style={styles.selectText}>
                {formData.workShiftID 
                  ? workShifts.find(shift => shift.id === formData.workShiftID)?.shiftName || 'Chọn ca làm việc'
                  : 'Chọn ca làm việc'
                }
              </Text>
              <Icon name="chevron-down" size={20} color="#666" />
            </TouchableOpacity>
            {errors.workShiftID && <Text style={styles.errorText}>{errors.workShiftID}</Text>}
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
              <Icon name="calendar" size={20} color="#666" />
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
              <Icon name="calendar" size={20} color="#666" />
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
            {employees.map((employee) => (
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
                  <Icon name="check" size={20} color="#008080" />
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
                  <Icon name="check" size={20} color="#008080" />
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
            {workShifts.map((shift) => (
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
                  <Icon name="check" size={20} color="#008080" />
                )}
              </TouchableOpacity>
            ))}
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
                minimumDate={new Date()}
                style={styles.datePicker}
                textColor="#000"
                accentColor="#008080"
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
                accentColor="#008080"
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
                minimumDate={formData.startDateTime ? new Date(formData.startDateTime) : new Date()}
                style={styles.datePicker}
                textColor="#000"
                accentColor="#008080"
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
                accentColor="#008080"
              />
            </View>
          </View>
        </Modal>
      )}
      </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollView: { flex: 1 },
  form: { 
    backgroundColor: '#fff', 
    margin: 16, 
    borderRadius: 12, 
    padding: 16, 
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
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
    borderRadius: 8, 
    padding: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  inputError: {
    borderColor: '#e53935',
    backgroundColor: '#ffebee',
  },
  dateInput: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
  voucherCodeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  generateBtn: {
    marginLeft: 8,
    padding: 8,
    backgroundColor: '#f0f0f0',
    borderRadius: 6,
  },
  selectContainer: {
    backgroundColor: '#f6f8fa',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
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
  textArea: {
    backgroundColor: '#f6f8fa',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    textAlignVertical: 'top',
    minHeight: 100,
  },
  dateText: {
    fontSize: 16,
    color: '#333',
  },
  placeholderText: {
    fontSize: 16,
    color: '#999',
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
});
