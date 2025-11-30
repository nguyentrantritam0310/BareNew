import { useRoute, useNavigation } from '@react-navigation/native';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useOvertimeRequest } from '../../composables/useOvertimeRequest';
import { useAuth } from '../../contexts/AuthContext';
import CustomHeader from '../../components/CustomHeader';

export default function OvertimeDetailScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { id } = route.params;
  const { 
    getOvertimeRequestById, 
    submitForApproval, 
    approveOvertimeRequest,
    loading: overtimeLoading
  } = useOvertimeRequest();
  
  const { isDirector, isHRManager, isHREmployee } = useAuth();
  
  const [overtime, setOvertime] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Approval modal state
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [pendingAction, setPendingAction] = useState(''); // 'submit', 'approve', 'reject', 'return'
  const [approvalNotes, setApprovalNotes] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    loadOvertimeRequest();
  }, [id]);

  const loadOvertimeRequest = async () => {
    try {
      setLoading(true);
      const data = await getOvertimeRequestById(id);
      setOvertime(data);
    } catch (err) {
      setError('Không thể tải thông tin đơn tăng ca');
    } finally {
      setLoading(false);
    }
  };

  const canSubmit = () => {
    const isCreatedStatus = overtime?.approveStatus === 'Tạo mới' || 
                           overtime?.approveStatus === 0 || 
                           overtime?.approveStatus === '0';
    return isCreatedStatus;
  };

  const canApprove = () => {
    // Chỉ cho phép duyệt khi status là "Chờ duyệt" (Pending)
    // Không phân biệt role - tất cả đều phải tuân theo quy tắc này
    // Đơn ở trạng thái "Tạo mới" phải được gửi duyệt trước khi có thể duyệt
    const isPendingStatus = overtime?.approveStatus === 'Chờ duyệt' || 
                           overtime?.approveStatus === 'Pending' || 
                           overtime?.approveStatus === 1 || 
                           overtime?.approveStatus === '1';
    
    if (!isPendingStatus) {
      return false;
    }
    
    // Director can approve items in "Chờ duyệt" status
    if (isDirector()) {
      return true;
    }
    
    // HR Manager can approve items in "Chờ duyệt" status
    if (isHRManager()) {
      return true;
    }
    
    // HR Employee can approve items in "Chờ duyệt" status
    if (isHREmployee()) {
      return true;
    }
    
    return false;
  };

  const handleSubmitForApproval = () => {
    setPendingAction('submit');
    setApprovalNotes('');
    setShowApprovalModal(true);
  };

  const handleApprove = (action) => {
    setPendingAction(action);
    setApprovalNotes('');
    setShowApprovalModal(true);
  };

  const getApprovalModalTitle = () => {
    const titles = {
      submit: 'Gửi duyệt đơn tăng ca',
      approve: 'Duyệt đơn tăng ca',
      reject: 'Từ chối đơn tăng ca',
      return: 'Trả lại đơn tăng ca'
    };
    return titles[pendingAction] || 'Nhập ghi chú';
  };

  const handleApprovalConfirm = async () => {
    try {
      setActionLoading(true);
      const notes = approvalNotes.trim() || null;
      
      switch (pendingAction) {
        case 'submit':
          await submitForApproval(id, notes);
          Alert.alert('Thành công', 'Gửi duyệt thành công', [
            { text: 'OK', onPress: () => {
              setShowApprovalModal(false);
              setPendingAction('');
              setApprovalNotes('');
              loadOvertimeRequest();
            }}
          ]);
          break;
        case 'approve':
        case 'reject':
        case 'return':
          await approveOvertimeRequest(id, pendingAction, notes);
          const actionText = pendingAction === 'approve' ? 'Duyệt' : pendingAction === 'reject' ? 'Từ chối' : 'Trả lại';
          Alert.alert('Thành công', `${actionText} thành công`, [
            { text: 'OK', onPress: () => {
              setShowApprovalModal(false);
              setPendingAction('');
              setApprovalNotes('');
              loadOvertimeRequest();
            }}
          ]);
          break;
      }
    } catch (error) {
      Alert.alert('Lỗi', 'Không thể thực hiện thao tác');
    } finally {
      setActionLoading(false);
    }
  };

  const handleApprovalCancel = () => {
    setShowApprovalModal(false);
    setPendingAction('');
    setApprovalNotes('');
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

  const formatDateTime = (dateString) => {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return '';
      return date.toLocaleString('vi-VN');
    } catch {
      return '';
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 0:
      case '0':
      case 'Tạo mới':
        return '#6c757d';
      case 1:
      case '1':
      case 'Chờ duyệt':
        return '#fb8c00';
      case 2:
      case '2':
      case 'Đã duyệt':
        return '#43a047';
      case 3:
      case '3':
      case 'Từ chối':
        return '#e53935';
      default:
        return '#6c757d';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 0:
      case '0':
      case 'Tạo mới':
        return 'Tạo mới';
      case 1:
      case '1':
      case 'Chờ duyệt':
        return 'Chờ duyệt';
      case 2:
      case '2':
      case 'Đã duyệt':
        return 'Đã duyệt';
      case 3:
      case '3':
      case 'Từ chối':
        return 'Từ chối';
      default:
        return status || 'Không xác định';
    }
  };


  if (loading) {
    return (
      <View style={styles.container}>
        <CustomHeader title="Chi tiết đơn tăng ca" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3498db" />
          <Text style={styles.loadingText}>Đang tải dữ liệu...</Text>
        </View>
      </View>
    );
  }

  if (error || !overtime) {
    return (
      <View style={styles.container}>
        <CustomHeader title="Chi tiết đơn tăng ca" />
        <View style={styles.errorContainer}>
          <Icon name="alert-circle" size={64} color="#e53935" />
          <Text style={styles.errorText}>{error || 'Không tìm thấy đơn tăng ca'}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={loadOvertimeRequest}>
            <Text style={styles.retryButtonText}>Thử lại</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CustomHeader title="Chi tiết đơn tăng ca" />
        
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <View style={styles.infoBox}>
          {/* Header */}
          <View style={styles.infoHeader}>
            <Text style={styles.voucherCode}>#{overtime.voucherCode}</Text>
            <Text style={[styles.status, { color: getStatusColor(overtime.approveStatus) }]}>
              {getStatusText(overtime.approveStatus)}
            </Text>
          </View>

          {/* Employee */}
          <View style={styles.infoRow}>
            <Text style={styles.label}>Nhân viên</Text>
            <Text style={styles.value}>{overtime.userName || overtime.employeeID}</Text>
          </View>

          {/* Overtime Type */}
          <View style={styles.infoRow}>
            <Text style={styles.label}>Loại tăng ca</Text>
            <Text style={styles.value}>{overtime.overtimeTypeName || 'N/A'}</Text>
          </View>

          {/* Overtime Form */}
          <View style={styles.infoRow}>
            <Text style={styles.label}>Hình thức tăng ca</Text>
            <Text style={styles.value}>{overtime.overtimeFormName || 'N/A'}</Text>
          </View>

          {/* Coefficient */}
          <View style={styles.infoRow}>
            <Text style={styles.label}>Hệ số</Text>
            <Text style={styles.value}>{overtime.coefficient || 'N/A'}</Text>
          </View>

          {/* Start Date */}
          <View style={styles.infoRow}>
            <Text style={styles.label}>Từ ngày</Text>
            <Text style={styles.value}>{formatDateTime(overtime.startDateTime)}</Text>
          </View>

          {/* End Date */}
          <View style={styles.infoRow}>
            <Text style={styles.label}>Đến ngày</Text>
            <Text style={styles.value}>{formatDateTime(overtime.endDateTime)}</Text>
          </View>

          {/* Reason */}
          <View style={styles.infoRow}>
            <Text style={styles.label}>Lý do</Text>
            <Text style={styles.value}>{overtime.reason || 'N/A'}</Text>
          </View>

          {/* Created Date */}
          <View style={styles.infoRow}>
            <Text style={styles.label}>Ngày tạo</Text>
            <Text style={styles.value}>{formatDateTime(overtime.createdDate)}</Text>
          </View>
        </View>

        {/* Actions */}
        <View style={styles.actionContainer}>
          {canSubmit() && (
            <TouchableOpacity style={[styles.actionButton, styles.submitButton]} onPress={handleSubmitForApproval}>
              <Icon name="send" size={20} color="#fff" />
              <Text style={styles.actionButtonText}>Gửi duyệt</Text>
            </TouchableOpacity>
          )}

          {canApprove() && (
            <>
              <TouchableOpacity style={[styles.actionButton, styles.approveButton]} onPress={() => handleApprove('approve')}>
                <Icon name="check" size={20} color="#fff" />
                <Text style={styles.actionButtonText}>Duyệt</Text>
              </TouchableOpacity>
              
              <TouchableOpacity style={[styles.actionButton, styles.rejectButton]} onPress={() => handleApprove('reject')}>
                <Icon name="close" size={20} color="#fff" />
                <Text style={styles.actionButtonText}>Từ chối</Text>
              </TouchableOpacity>
              
              <TouchableOpacity style={[styles.actionButton, styles.returnButton]} onPress={() => handleApprove('return')}>
                <Icon name="undo" size={20} color="#fff" />
                <Text style={styles.actionButtonText}>Trả lại</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </ScrollView>

      {/* Approval Notes Modal */}
      <Modal
        visible={showApprovalModal}
        animationType="slide"
        transparent={true}
        onRequestClose={handleApprovalCancel}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{getApprovalModalTitle()}</Text>
            </View>
            
            <ScrollView style={styles.modalBody}>
              <View style={styles.notesInputContainer}>
                <Text style={styles.notesLabel}>Ghi chú (tùy chọn)</Text>
                <TextInput
                  style={styles.notesInput}
                  multiline
                  numberOfLines={4}
                  placeholder="Nhập ghi chú..."
                  value={approvalNotes}
                  onChangeText={setApprovalNotes}
                  textAlignVertical="top"
                />
              </View>
            </ScrollView>
            
            <View style={styles.modalFooter}>
              <TouchableOpacity 
                style={[styles.modalButton, styles.cancelButton]} 
                onPress={handleApprovalCancel}
              >
                <Text style={styles.cancelButtonText}>Hủy</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modalButton, styles.modalConfirmButton]} 
                onPress={handleApprovalConfirm}
                disabled={actionLoading}
              >
                {actionLoading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.confirmButtonText}>Xác nhận</Text>
                )}
              </TouchableOpacity>
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
  scrollContent: { paddingBottom: 20 },
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
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  infoBox: { 
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
  infoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  voucherCode: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#3498db',
  },
  status: { 
    fontWeight: 'bold', 
    fontSize: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    backgroundColor: '#f5f5f5',
  },
  infoRow: {
    marginBottom: 12,
  },
  label: { 
    fontWeight: 'bold', 
    color: '#3498db', 
    marginBottom: 4,
    fontSize: 14,
  },
  value: { 
    color: '#333', 
    fontSize: 16, 
    lineHeight: 22,
  },
  actionContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    flexWrap: 'wrap',
    margin: 16,
    paddingHorizontal: 16,
    gap: 8,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    minWidth: 100,
    justifyContent: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    marginRight: 4,
    marginBottom: 4,
  },
  submitButton: {
    backgroundColor: '#3498db',
  },
  approveButton: {
    backgroundColor: '#43a047',
  },
  rejectButton: {
    backgroundColor: '#e53935',
  },
  returnButton: {
    backgroundColor: '#fb8c00',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
    marginLeft: 6,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    width: '100%',
    maxWidth: 400,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  modalHeader: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
  },
  modalBody: {
    padding: 16,
    maxHeight: 300,
  },
  notesInputContainer: {
    marginBottom: 16,
  },
  notesLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#3498db',
    marginBottom: 8,
  },
  notesInput: {
    backgroundColor: '#f6f8fa',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    minHeight: 100,
    textAlignVertical: 'top',
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    gap: 8,
  },
  modalButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    minWidth: 100,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#6c757d',
  },
  cancelButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  modalConfirmButton: {
    backgroundColor: '#3498db',
  },
  confirmButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
