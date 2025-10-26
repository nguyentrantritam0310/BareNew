import { useRoute, useNavigation } from '@react-navigation/native';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useOvertimeRequest } from '../../composables/useOvertimeRequest';
import CustomHeader from '../../components/CustomHeader';

export default function OvertimeDetailScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { id } = route.params;
  const { getOvertimeRequestById, deleteOvertimeRequest, updateOvertimeRequest } = useOvertimeRequest();
  
  const [overtime, setOvertime] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadOvertimeRequest();
  }, [id]);

  const loadOvertimeRequest = async () => {
    try {
      setLoading(true);
      const data = await getOvertimeRequestById(id);
      setOvertime(data);
    } catch (err) {
      console.error('Error loading overtime request:', err);
      setError('Không thể tải thông tin đơn tăng ca');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = () => {
    navigation.navigate('EditOvertime', { id });
  };

  const handleDelete = async () => {
    Alert.alert(
      'Xác nhận xóa',
      'Bạn có chắc chắn muốn xóa đơn tăng ca này?',
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Xóa',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteOvertimeRequest(id);
              Alert.alert('Thành công', 'Xóa đơn tăng ca thành công', [
                { text: 'OK', onPress: () => navigation.goBack() }
              ]);
            } catch (error) {
              console.error('Error deleting overtime request:', error);
              Alert.alert('Lỗi', 'Không thể xóa đơn tăng ca');
            }
          }
        }
      ]
    );
  };

  const handleSubmitForApproval = async () => {
    try {
      await updateOvertimeRequest(id, { approveStatus: 'Chờ duyệt' });
      Alert.alert('Thành công', 'Gửi duyệt thành công', [
        { text: 'OK', onPress: () => loadOvertimeRequest() }
      ]);
    } catch (error) {
      console.error('Error submitting for approval:', error);
      Alert.alert('Lỗi', 'Không thể gửi duyệt');
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

  const canEdit = overtime?.approveStatus === 0 || overtime?.approveStatus === '0' || overtime?.approveStatus === 'Tạo mới';
  const canDelete = canEdit;
  const canSubmit = canEdit;

  if (loading) {
    return (
      <View style={styles.container}>
        <CustomHeader title="Chi tiết đơn tăng ca" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#008080" />
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
        {(canEdit || canDelete || canSubmit) && (
          <View style={styles.actionContainer}>
            {canEdit && (
              <TouchableOpacity style={[styles.actionButton, styles.editButton]} onPress={handleEdit}>
                <Icon name="pencil" size={20} color="#fff" />
                <Text style={styles.actionButtonText}>Sửa</Text>
              </TouchableOpacity>
            )}
            
            {canDelete && (
              <TouchableOpacity style={[styles.actionButton, styles.deleteButton]} onPress={handleDelete}>
                <Icon name="delete" size={20} color="#fff" />
                <Text style={styles.actionButtonText}>Xóa</Text>
              </TouchableOpacity>
            )}
            
            {canSubmit && (
              <TouchableOpacity style={[styles.actionButton, styles.submitButton]} onPress={handleSubmitForApproval}>
                <Icon name="send" size={20} color="#fff" />
                <Text style={styles.actionButtonText}>Gửi duyệt</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f6f8fa' },
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
    color: '#666',
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
    backgroundColor: '#008080',
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
    borderRadius: 12, 
    padding: 16, 
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
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
    color: '#008080',
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
    color: '#1976d2', 
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
  },
  editButton: {
    backgroundColor: '#28a745',
  },
  deleteButton: {
    backgroundColor: '#dc3545',
  },
  submitButton: {
    backgroundColor: '#008080',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
    marginLeft: 6,
  },
});
