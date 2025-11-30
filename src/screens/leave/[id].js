import { useNavigation, useRoute } from '@react-navigation/native';
import { useEffect, useState } from 'react';
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
import { useLeaveRequest } from '../../composables/useLeaveRequest';
import CustomHeader from '../../components/CustomHeader';

export default function LeaveDetailScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { id } = route.params;
  const { 
    getLeaveRequestById, 
    submitForApproval, 
    approveLeaveRequest,
    loading 
  } = useLeaveRequest();
  
  const [leave, setLeave] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(true);
  const [error, setError] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  
  // Approval modal state
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [pendingAction, setPendingAction] = useState(''); // 'submit', 'approve', 'reject', 'return'
  const [approvalNotes, setApprovalNotes] = useState('');

  // Load leave detail on mount
  useEffect(() => {
    loadLeaveDetail();
  }, [id]);

  const loadLeaveDetail = async () => {
    try {
      setLoadingDetail(true);
      setError(null);
      const data = await getLeaveRequestById(id);
      setLeave(data);
    } catch (err) {
      setError('Không thể tải thông tin đơn nghỉ phép');
    } finally {
      setLoadingDetail(false);
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

  // Logic tương tự leave.vue: chỉ cho phép gửi duyệt khi status = "Tạo mới"
  const canSubmit = leave?.approveStatus === 0 || leave?.approveStatus === '0' || leave?.approveStatus === 'Tạo mới';
  // Chỉ cho phép duyệt/từ chối khi status = "Chờ duyệt"
  const canApprove = leave?.approveStatus === 1 || leave?.approveStatus === '1' || leave?.approveStatus === 'Chờ duyệt';

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
      submit: 'Gửi duyệt đơn nghỉ phép',
      approve: 'Duyệt đơn nghỉ phép',
      reject: 'Từ chối đơn nghỉ phép',
      return: 'Trả lại đơn nghỉ phép'
    };
    return titles[pendingAction] || 'Nhập ghi chú';
  };

  const handleApprovalConfirm = async () => {
    try {
      setActionLoading(true);
      const notes = approvalNotes.trim() || null;
      
      switch (pendingAction) {
        case 'submit':
          await submitForApproval(leave.voucherCode, notes);
          Alert.alert('Thành công', 'Gửi duyệt thành công', [
            { text: 'OK', onPress: () => loadLeaveDetail() }
          ]);
          break;
        case 'approve':
        case 'reject':
        case 'return':
          await approveLeaveRequest(leave.voucherCode, pendingAction, notes);
          const actionText = pendingAction === 'approve' ? 'Duyệt' : pendingAction === 'reject' ? 'Từ chối' : 'Trả lại';
          Alert.alert('Thành công', `${actionText} thành công`, [
            { text: 'OK', onPress: () => loadLeaveDetail() }
          ]);
          break;
      }
      
      setShowApprovalModal(false);
      setPendingAction('');
      setApprovalNotes('');
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

  if (loadingDetail) {
    return (
      <View style={styles.container}>
        <CustomHeader title="Chi tiết đơn nghỉ phép" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3498db" />
          <Text style={styles.loadingText}>Đang tải dữ liệu...</Text>
        </View>
      </View>
    );
  }

  if (error || !leave) {
    return (
      <View style={styles.container}>
        <CustomHeader title="Chi tiết đơn nghỉ phép" />
        <View style={styles.errorContainer}>
          <Icon name="alert-circle" size={64} color="#e53935" />
          <Text style={styles.errorText}>{error || 'Không tìm thấy đơn nghỉ phép'}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={loadLeaveDetail}>
            <Text style={styles.retryButtonText}>Thử lại</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CustomHeader title="Chi tiết đơn nghỉ phép" />
        
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <View style={styles.infoBox}>
          {/* Header */}
          <View style={styles.infoHeader}>
            <Text style={styles.voucherCode}>#{leave.voucherCode}</Text>
            <Text style={[styles.status, { color: getStatusColor(leave.approveStatus) }]}>
              {getStatusText(leave.approveStatus)}
            </Text>
          </View>

          {/* Employee */}
          <View style={styles.infoRow}>
            <Text style={styles.label}>Nhân viên</Text>
            <Text style={styles.value}>{leave.userName || leave.employeeID}</Text>
          </View>

          {/* Leave Type */}
          <View style={styles.infoRow}>
            <Text style={styles.label}>Loại nghỉ phép</Text>
            <Text style={styles.value}>{leave.leaveTypeName || 'N/A'}</Text>
          </View>

          {/* Work Shift */}
          {leave.workShiftName && (
            <View style={styles.infoRow}>
              <Text style={styles.label}>Ca làm việc</Text>
              <Text style={styles.value}>{leave.workShiftName}</Text>
            </View>
          )}

          {/* Start Date */}
          <View style={styles.infoRow}>
            <Text style={styles.label}>Từ ngày</Text>
            <Text style={styles.value}>{formatDateTime(leave.startDateTime)}</Text>
          </View>

          {/* End Date */}
          <View style={styles.infoRow}>
            <Text style={styles.label}>Đến ngày</Text>
            <Text style={styles.value}>{formatDateTime(leave.endDateTime)}</Text>
          </View>

          {/* Reason */}
          <View style={styles.infoRow}>
            <Text style={styles.label}>Lý do</Text>
            <Text style={styles.value}>{leave.reason || 'N/A'}</Text>
          </View>

          {/* Created Date */}
          {leave.createdDate && (
            <View style={styles.infoRow}>
              <Text style={styles.label}>Ngày tạo</Text>
              <Text style={styles.value}>{formatDateTime(leave.createdDate)}</Text>
            </View>
          )}
        </View>

        {/* Actions */}
        {(canSubmit || canApprove) && (
          <View style={styles.actionContainer}>
            {canSubmit && (
              <TouchableOpacity style={[styles.actionButton, styles.submitButton]} onPress={handleSubmitForApproval} disabled={actionLoading}>
                <Icon name="send" size={20} color="#fff" />
                <Text style={styles.actionButtonText}>Gửi duyệt</Text>
              </TouchableOpacity>
            )}

            {canApprove && (
              <>
                <TouchableOpacity style={[styles.actionButton, styles.approveButton]} onPress={() => handleApprove('approve')} disabled={actionLoading}>
                  <Icon name="check" size={20} color="#fff" />
                  <Text style={styles.actionButtonText}>Duyệt</Text>
                </TouchableOpacity>
                
                <TouchableOpacity style={[styles.actionButton, styles.rejectButton]} onPress={() => handleApprove('reject')} disabled={actionLoading}>
                  <Icon name="close" size={20} color="#fff" />
                  <Text style={styles.actionButtonText}>Từ chối</Text>
                </TouchableOpacity>
                
                <TouchableOpacity style={[styles.actionButton, styles.returnButton]} onPress={() => handleApprove('return')} disabled={actionLoading}>
                  <Icon name="undo" size={20} color="#fff" />
                  <Text style={styles.actionButtonText}>Trả lại</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        )}
      </ScrollView>
      
      {/* Approval Notes Modal */}
      <Modal
        visible={showApprovalModal}
        animationType="slide"
        transparent={true}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
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
                style={[styles.modalButton, styles.modalCancelButton]} 
                onPress={handleApprovalCancel}
              >
                <Text style={styles.modalButtonText}>Hủy</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modalButton, styles.modalConfirmButton]} 
                onPress={handleApprovalConfirm}
                disabled={actionLoading}
              >
                {actionLoading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.modalButtonText}>Xác nhận</Text>
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
    justifyContent: 'space-around',
    margin: 16,
    paddingHorizontal: 16,
    flexWrap: 'wrap',
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
    margin: 4,
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
  // Approval modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
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
  modalHeader: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    backgroundColor: '#f8f9fa',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
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
    justifyContent: 'center',
  },
  modalCancelButton: {
    backgroundColor: '#6c757d',
  },
  modalConfirmButton: {
    backgroundColor: '#3498db',
  },
  modalButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
