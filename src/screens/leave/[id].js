import { useNavigation, useRoute } from '@react-navigation/native';
import { useEffect, useState } from 'react';
import { 
  ActivityIndicator, 
  Alert, 
  ScrollView, 
  StyleSheet, 
  Text, 
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
    deleteLeaveRequest, 
    submitForApproval, 
    approveLeaveRequest,
    loading 
  } = useLeaveRequest();
  
  const [leave, setLeave] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // Load leave detail on mount
  useEffect(() => {
    loadLeaveDetail();
  }, [id]);

  const loadLeaveDetail = async () => {
    try {
      setLoadingDetail(true);
      const data = await getLeaveRequestById(id);
      setLeave(data);
    } catch (error) {
      console.error('Error loading leave detail:', error);
      Alert.alert('Lỗi', 'Không thể tải chi tiết đơn nghỉ phép');
    } finally {
      setLoadingDetail(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('vi-VN');
  };

  const formatDateTime = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleString('vi-VN');
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 0:
      case '0':
        return '#6c757d'; // Tạo mới - gray
      case 1:
      case '1':
        return '#fb8c00'; // Chờ duyệt - orange
      case 2:
      case '2':
        return '#43a047'; // Đã duyệt - green
      case 3:
      case '3':
        return '#e53935'; // Từ chối - red
      default:
        return '#6c757d';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 0:
      case '0':
        return 'Tạo mới';
      case 1:
      case '1':
        return 'Chờ duyệt';
      case 2:
      case '2':
        return 'Đã duyệt';
      case 3:
      case '3':
        return 'Từ chối';
      default:
        return 'Không xác định';
    }
  };

  const canEdit = leave && (leave.approveStatus == 0 || leave.approveStatus === '0');
  const canSubmit = leave && (leave.approveStatus == 0 || leave.approveStatus === '0');
  const canApprove = leave && (leave.approveStatus == 1 || leave.approveStatus === '1');

  const handleDelete = () => {
    Alert.alert(
      'Xác nhận xóa',
      `Bạn có chắc chắn muốn xóa đơn nghỉ phép ${leave.voucherCode}?`,
      [
        { text: 'Hủy', style: 'cancel' },
        { 
          text: 'Xóa', 
          style: 'destructive',
          onPress: confirmDelete
        }
      ]
    );
  };

  const confirmDelete = async () => {
    try {
      setActionLoading(true);
      await deleteLeaveRequest(leave.voucherCode);
      Alert.alert('Thành công', 'Xóa đơn nghỉ phép thành công', [
        { text: 'OK', onPress: () => navigation.goBack() }
      ]);
    } catch (error) {
      console.error('Error deleting leave request:', error);
      Alert.alert('Lỗi', 'Không thể xóa đơn nghỉ phép');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSubmitForApproval = () => {
    Alert.alert(
      'Gửi duyệt',
      'Bạn có chắc chắn muốn gửi đơn nghỉ phép để duyệt?',
      [
        { text: 'Hủy', style: 'cancel' },
        { 
          text: 'Gửi duyệt', 
          onPress: confirmSubmitForApproval
        }
      ]
    );
  };

  const confirmSubmitForApproval = async () => {
    try {
      setActionLoading(true);
      await submitForApproval(leave.voucherCode);
      Alert.alert('Thành công', 'Gửi duyệt thành công', [
        { text: 'OK', onPress: () => loadLeaveDetail() }
      ]);
    } catch (error) {
      console.error('Error submitting for approval:', error);
      Alert.alert('Lỗi', 'Không thể gửi duyệt đơn nghỉ phép');
    } finally {
      setActionLoading(false);
    }
  };

  const handleApprove = (action) => {
    const actionText = action === 'approve' ? 'duyệt' : action === 'reject' ? 'từ chối' : 'trả lại';
    Alert.alert(
      `Xác nhận ${actionText}`,
      `Bạn có chắc chắn muốn ${actionText} đơn nghỉ phép này?`,
      [
        { text: 'Hủy', style: 'cancel' },
        { 
          text: actionText.charAt(0).toUpperCase() + actionText.slice(1), 
          onPress: () => confirmApprove(action)
        }
      ]
    );
  };

  const confirmApprove = async (action) => {
    try {
      setActionLoading(true);
      await approveLeaveRequest(leave.voucherCode, action);
      const actionText = action === 'approve' ? 'Duyệt' : action === 'reject' ? 'Từ chối' : 'Trả lại';
      Alert.alert('Thành công', `${actionText} thành công`, [
        { text: 'OK', onPress: () => loadLeaveDetail() }
      ]);
    } catch (error) {
      console.error('Error approving leave request:', error);
      Alert.alert('Lỗi', 'Không thể thực hiện thao tác');
    } finally {
      setActionLoading(false);
    }
  };

  if (loadingDetail) {
    return (
      <View style={styles.container}>
        <CustomHeader title="Chi tiết đơn nghỉ phép" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3498db" />
          <Text style={styles.loadingText}>Đang tải chi tiết...</Text>
        </View>
      </View>
    );
  }

  if (!leave) {
    return (
      <View style={styles.container}>
        <CustomHeader title="Chi tiết đơn nghỉ phép" />
        <View style={styles.errorContainer}>
          <Icon name="alert-circle" size={64} color="#e53935" />
          <Text style={styles.errorText}>Không tìm thấy đơn nghỉ phép</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={loadLeaveDetail}>
            <View style={styles.retryBtnSolid}>
              <Text style={styles.retryBtnText}>Thử lại</Text>
            </View>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CustomHeader title="Chi tiết đơn nghỉ phép" />

        {/* Content */}
        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Status Card */}
        <View style={styles.statusCard}>
          <View style={styles.statusHeader}>
            <Text style={styles.voucherCode}>#{leave.voucherCode}</Text>
            <View style={[styles.statusBadge, { backgroundColor: getStatusColor(leave.approveStatus) }]}>
              <Text style={styles.statusText}>{getStatusText(leave.approveStatus)}</Text>
            </View>
          </View>
        </View>

        {/* Info Card */}
        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Icon name="account" size={20} color="#666" />
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Nhân viên</Text>
              <Text style={styles.infoValue}>{leave.userName || leave.employeeID}</Text>
            </View>
          </View>

          <View style={styles.infoRow}>
            <Icon name="calendar" size={20} color="#666" />
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Loại nghỉ phép</Text>
              <Text style={styles.infoValue}>{leave.leaveTypeName || 'Nghỉ phép'}</Text>
            </View>
          </View>

          <View style={styles.infoRow}>
            <Icon name="clock-start" size={20} color="#666" />
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Từ ngày</Text>
              <Text style={styles.infoValue}>{formatDateTime(leave.startDateTime)}</Text>
            </View>
          </View>

          <View style={styles.infoRow}>
            <Icon name="clock-end" size={20} color="#666" />
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Đến ngày</Text>
              <Text style={styles.infoValue}>{formatDateTime(leave.endDateTime)}</Text>
            </View>
          </View>

          {leave.workShiftName && (
            <View style={styles.infoRow}>
              <Icon name="clock-outline" size={20} color="#666" />
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Ca làm việc</Text>
                <Text style={styles.infoValue}>{leave.workShiftName}</Text>
              </View>
            </View>
          )}

          <View style={styles.infoRow}>
            <Icon name="text" size={20} color="#666" />
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Lý do</Text>
              <Text style={styles.infoValue}>{leave.reason || 'Không có'}</Text>
            </View>
          </View>
        </View>

        {/* Actions */}
        {(canEdit || canSubmit || canApprove) && (
          <View style={styles.actionCard}>
            <Text style={styles.actionTitle}>Thao tác</Text>
            
            {canEdit && (
              <View style={styles.actionRow}>
                <TouchableOpacity 
                  style={[styles.actionBtn, styles.deleteBtn]} 
                  onPress={handleDelete}
                  disabled={actionLoading}
                >
                  <Icon name="delete" size={22} color="#fff" />
                  <Text style={styles.actionBtnText}>Xóa</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={[styles.actionBtn, styles.editBtn]} 
                  onPress={() => navigation.navigate('EditLeave', { id })}
                  disabled={actionLoading}
                >
                  <Icon name="pencil" size={22} color="#fff" />
                  <Text style={styles.actionBtnText}>Sửa</Text>
                </TouchableOpacity>
              </View>
            )}

            {canSubmit && (
              <TouchableOpacity 
                style={[styles.actionBtn, styles.submitBtn]} 
                onPress={handleSubmitForApproval}
                disabled={actionLoading}
              >
                {actionLoading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Icon name="send" size={22} color="#fff" />
                    <Text style={styles.actionBtnText}>Gửi duyệt</Text>
                  </>
                )}
              </TouchableOpacity>
            )}

            {canApprove && (
              <View style={styles.actionRow}>
                <TouchableOpacity 
                  style={[styles.actionBtn, styles.approveBtn]} 
                  onPress={() => handleApprove('approve')}
                  disabled={actionLoading}
                >
                  <Icon name="check" size={22} color="#fff" />
                  <Text style={styles.actionBtnText}>Duyệt</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={[styles.actionBtn, styles.rejectBtn]} 
                  onPress={() => handleApprove('reject')}
                  disabled={actionLoading}
                >
                  <Icon name="close" size={22} color="#fff" />
                  <Text style={styles.actionBtnText}>Từ chối</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}
      </ScrollView>
      </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollView: { flex: 1 },
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
  retryBtn: {
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  retryBtnSolid: {
    backgroundColor: '#3498db',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  retryBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  statusCard: {
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
  statusHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  voucherCode: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#3498db',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  statusText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  infoCard: {
    backgroundColor: '#fff',
    margin: 16,
    marginTop: 0,
    borderRadius: 12,
    padding: 16,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  infoContent: {
    flex: 1,
    marginLeft: 12,
  },
  infoLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 16,
    color: '#2c3e50',
    fontWeight: '600',
  },
  actionCard: {
    backgroundColor: '#fff',
    margin: 16,
    marginTop: 0,
    borderRadius: 12,
    padding: 16,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 16,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    padding: 12,
    flex: 1,
    marginHorizontal: 4,
  },
  actionBtnText: {
    marginLeft: 8,
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
  deleteBtn: {
    backgroundColor: '#e53935',
  },
  editBtn: {
    backgroundColor: '#3498db',
  },
  submitBtn: {
    backgroundColor: '#1976d2',
    marginBottom: 12,
  },
  approveBtn: {
    backgroundColor: '#43a047',
  },
  rejectBtn: {
    backgroundColor: '#e53935',
  },
});
