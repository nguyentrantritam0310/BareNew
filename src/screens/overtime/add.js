import { useNavigation } from '@react-navigation/native';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useOvertimeRequest } from '../../composables/useOvertimeRequest';
import { useEmployee } from '../../composables/useEmployee';
import { useOvertimeType } from '../../composables/useOvertimeType';
import { useOvertimeForm } from '../../composables/useOvertimeForm';
import CustomHeader from '../../components/CustomHeader';

export default function AddOvertimeScreen() {
  const navigation = useNavigation();
  const { createOvertimeRequest, loading: overtimeLoading } = useOvertimeRequest();
  const { employees, fetchAllEmployees, loading: employeeLoading } = useEmployee();
  const { overtimeTypes, fetchOvertimeTypes, loading: overtimeTypeLoading } = useOvertimeType();
  const { overtimeForms, fetchOvertimeForms, loading: overtimeFormLoading } = useOvertimeForm();

  // Form state
  const [formData, setFormData] = useState({
    voucherCode: '',
    employeeID: '',
    overtimeTypeID: '',
    overtimeFormID: '',
    coefficient: '',
    startDateTime: '',
    endDateTime: '',
    reason: ''
  });

  // UI states for DateTimePicker
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  const [showStartTimePicker, setShowStartTimePicker] = useState(false);
  const [showEndTimePicker, setShowEndTimePicker] = useState(false);

  // Temporary date/time states
  const [tempStartDate, setTempStartDate] = useState(new Date());
  const [tempEndDate, setTempEndDate] = useState(new Date());
  const [tempStartTime, setTempStartTime] = useState(new Date());
  const [tempEndTime, setTempEndTime] = useState(new Date());

  // Modal states
  const [showEmployeeModal, setShowEmployeeModal] = useState(false);
  const [showOvertimeTypeModal, setShowOvertimeTypeModal] = useState(false);
  const [showOvertimeFormModal, setShowOvertimeFormModal] = useState(false);

  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  // Load data on mount
  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    try {
      await Promise.all([
        fetchAllEmployees(),
        fetchOvertimeTypes(),
        fetchOvertimeForms()
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

    if (!formData.overtimeTypeID) {
      newErrors.overtimeTypeID = 'Loại tăng ca là bắt buộc';
    }

    if (!formData.overtimeFormID) {
      newErrors.overtimeFormID = 'Hình thức tăng ca là bắt buộc';
    }

    if (!formData.coefficient || formData.coefficient <= 0) {
      newErrors.coefficient = 'Hệ số phải lớn hơn 0';
    }

    if (!formData.startDateTime) {
      newErrors.startDateTime = 'Ngày bắt đầu là bắt buộc';
    }

    if (!formData.endDateTime) {
      newErrors.endDateTime = 'Ngày kết thúc là bắt buộc';
    }

    if (!formData.reason.trim()) {
      newErrors.reason = 'Lý do là bắt buộc';
    }

    // Validate date range
    if (formData.startDateTime && formData.endDateTime) {
      const startDate = new Date(formData.startDateTime);
      const endDate = new Date(formData.endDateTime);
      
      if (startDate >= endDate) {
        newErrors.endDateTime = 'Ngày kết thúc phải sau ngày bắt đầu';
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
        overtimeTypeID: formData.overtimeTypeID,
        overtimeFormID: formData.overtimeFormID,
        coefficient: parseFloat(formData.coefficient),
        startDateTime: new Date(formData.startDateTime).toISOString(),
        endDateTime: new Date(formData.endDateTime).toISOString(),
        reason: formData.reason
      };

      console.log('Form Data:', formData);
      console.log('Submit Data:', submitData);
      console.log('Start DateTime:', formData.startDateTime);
      console.log('End DateTime:', formData.endDateTime);

      await createOvertimeRequest(submitData);
      Alert.alert('Thành công', 'Tạo đơn tăng ca thành công', [
        { text: 'OK', onPress: () => navigation.goBack() }
      ]);
    } catch (error) {
      console.error('Error creating overtime request:', error);
      console.error('Error response:', error.response?.data);
      console.error('Error status:', error.response?.status);
      Alert.alert('Lỗi', `Không thể tạo đơn tăng ca: ${error.response?.data?.message || error.message}`);
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
    return `OT${year}${month}${day}${time}`;
  };

  // Auto-generate voucher code on mount
  useEffect(() => {
    if (!formData.voucherCode) {
      setFormData(prev => ({ ...prev, voucherCode: generateVoucherCode() }));
    }
  }, []);

  // Auto-set coefficient when overtime type changes
  useEffect(() => {
    if (formData.overtimeTypeID && overtimeTypes.length > 0) {
      const selectedType = overtimeTypes.find(type => type.id === formData.overtimeTypeID);
      if (selectedType) {
        setFormData(prev => ({ ...prev, coefficient: selectedType.coefficient }));
      }
    }
  }, [formData.overtimeTypeID, overtimeTypes]);

  return (
    <View style={styles.container}>
      <CustomHeader title="Tạo đơn tăng ca" />
        
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <View style={styles.form}>
          {/* Voucher Code */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Số phiếu <Text style={styles.required}>*</Text></Text>
            <TextInput
              style={[styles.input, errors.voucherCode && styles.inputError]}
              value={formData.voucherCode}
              onChangeText={(text) => setFormData(prev => ({ ...prev, voucherCode: text }))}
              placeholder="Nhập số phiếu"
            />
            {errors.voucherCode && <Text style={styles.errorText}>{errors.voucherCode}</Text>}
          </View>

          {/* Employee */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Nhân viên <Text style={styles.required}>*</Text></Text>
            <TouchableOpacity 
              style={[styles.selectContainer, errors.employeeID && styles.inputError]}
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

          {/* Overtime Type */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Loại tăng ca <Text style={styles.required}>*</Text></Text>
            <TouchableOpacity 
              style={[styles.selectContainer, errors.overtimeTypeID && styles.inputError]}
              onPress={() => setShowOvertimeTypeModal(true)}
            >
              <Text style={styles.selectText}>
                {formData.overtimeTypeID 
                  ? overtimeTypes.find(type => type.id === formData.overtimeTypeID)?.overtimeTypeName || 'Chọn loại tăng ca'
                  : 'Chọn loại tăng ca'
                }
              </Text>
              <Icon name="chevron-down" size={20} color="#666" />
            </TouchableOpacity>
            {errors.overtimeTypeID && <Text style={styles.errorText}>{errors.overtimeTypeID}</Text>}
          </View>

          {/* Overtime Form */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Hình thức tăng ca <Text style={styles.required}>*</Text></Text>
            <TouchableOpacity 
              style={[styles.selectContainer, errors.overtimeFormID && styles.inputError]}
              onPress={() => setShowOvertimeFormModal(true)}
            >
              <Text style={styles.selectText}>
                {formData.overtimeFormID 
                  ? overtimeForms.find(form => form.id === formData.overtimeFormID)?.overtimeFormName || 'Chọn hình thức tăng ca'
                  : 'Chọn hình thức tăng ca'
                }
              </Text>
              <Icon name="chevron-down" size={20} color="#666" />
            </TouchableOpacity>
            {errors.overtimeFormID && <Text style={styles.errorText}>{errors.overtimeFormID}</Text>}
          </View>

          {/* Coefficient */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Hệ số <Text style={styles.required}>*</Text></Text>
            <TextInput
              style={[styles.input, errors.coefficient && styles.inputError]}
              value={formData.coefficient.toString()}
              onChangeText={(text) => setFormData(prev => ({ ...prev, coefficient: text }))}
              placeholder="Nhập hệ số"
              keyboardType="numeric"
              editable={!formData.overtimeTypeID} // Disable if overtime type is selected
            />
            {errors.coefficient && <Text style={styles.errorText}>{errors.coefficient}</Text>}
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
              style={[styles.input, styles.textArea, errors.reason && styles.inputError]}
              value={formData.reason}
              onChangeText={(text) => setFormData(prev => ({ ...prev, reason: text }))}
              placeholder="Nhập lý do tăng ca"
              multiline
              numberOfLines={4}
            />
            {errors.reason && <Text style={styles.errorText}>{errors.reason}</Text>}
          </View>

          {/* Submit Button */}
          <TouchableOpacity 
            style={[styles.submitBtn, (submitting || overtimeLoading) && styles.submitBtnDisabled]} 
            onPress={handleSubmit}
            disabled={submitting || overtimeLoading}
          >
            {submitting || overtimeLoading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.submitText}>Tạo đơn tăng ca</Text>
            )}
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
          <ScrollView style={styles.modalBody}>
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

      {/* Overtime Type Selection Modal */}
      <Modal
        visible={showOvertimeTypeModal}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowOvertimeTypeModal(false)}>
              <Text style={styles.modalCancelText}>Hủy</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Chọn loại tăng ca</Text>
            <View style={{ width: 50 }} />
          </View>
          <ScrollView style={styles.modalBody}>
            {overtimeTypes.map((type) => (
              <TouchableOpacity
                key={type.id}
                style={styles.modalItem}
                onPress={() => {
                  setFormData(prev => ({ ...prev, overtimeTypeID: type.id }));
                  setShowOvertimeTypeModal(false);
                }}
              >
                <Text style={styles.modalItemText}>{type.overtimeTypeName}</Text>
                {formData.overtimeTypeID === type.id && (
                  <Icon name="check" size={20} color="#008080" />
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </Modal>

      {/* Overtime Form Selection Modal */}
      <Modal
        visible={showOvertimeFormModal}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowOvertimeFormModal(false)}>
              <Text style={styles.modalCancelText}>Hủy</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Chọn hình thức tăng ca</Text>
            <View style={{ width: 50 }} />
          </View>
          <ScrollView style={styles.modalBody}>
            {overtimeForms.map((form) => (
              <TouchableOpacity
                key={form.id}
                style={styles.modalItem}
                onPress={() => {
                  setFormData(prev => ({ ...prev, overtimeFormID: form.id }));
                  setShowOvertimeFormModal(false);
                }}
              >
                <Text style={styles.modalItemText}>{form.overtimeFormName}</Text>
                {formData.overtimeFormID === form.id && (
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
                minimumDate={new Date()}
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
  container: { flex: 1, backgroundColor: '#f6f8fa' },
  scrollView: { flex: 1 },
  scrollContent: { paddingBottom: 20 },
  form: { backgroundColor: '#fff', margin: 16, borderRadius: 12, padding: 16, elevation: 1 },
  inputGroup: { marginBottom: 16 },
  label: { fontWeight: 'bold', color: '#1976d2', marginBottom: 8, fontSize: 16 },
  required: { color: '#e53935' },
  input: { 
    backgroundColor: '#f6f8fa', 
    borderRadius: 8, 
    padding: 12, 
    borderWidth: 1, 
    borderColor: '#e0e0e0',
    fontSize: 16,
  },
  inputError: { borderColor: '#e53935' },
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
  selectText: { fontSize: 16, color: '#333' },
  dateInput: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  dateText: { fontSize: 16, color: '#333' },
  placeholderText: { color: '#999' },
  textArea: { height: 100, textAlignVertical: 'top' },
  errorText: { color: '#e53935', fontSize: 14, marginTop: 4 },
  submitBtn: { 
    backgroundColor: '#008080', 
    borderRadius: 10, 
    marginTop: 20, 
    alignItems: 'center', 
    padding: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  submitBtnDisabled: { backgroundColor: '#ccc' },
  submitText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  
  // Modal styles
  modalContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    backgroundColor: '#f8f9fa',
  },
  modalCancelText: {
    fontSize: 16,
    color: '#008080',
    fontWeight: 'bold',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  modalBody: {
    flex: 1,
    padding: 16,
  },
  modalItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  modalItemText: {
    fontSize: 16,
    color: '#333',
  },
  
  // Date picker styles
  datePickerContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  datePickerContent: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    width: '90%',
    maxWidth: 400,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  datePickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  datePickerButton: {
    fontSize: 16,
    color: '#008080',
    fontWeight: 'bold',
  },
  datePickerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  datePicker: {
    width: '100%',
    height: 200,
  },
});
