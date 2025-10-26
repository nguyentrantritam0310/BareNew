import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useEffect, useState, useCallback } from 'react';
import { ActivityIndicator, Alert, FlatList, Modal, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useOvertimeRequest } from '../../composables/useOvertimeRequest';
import CustomHeader from '../../components/CustomHeader';

export default function OvertimeListScreen() {
  const navigation = useNavigation();
  const { 
    overtimeRequests, 
    loading, 
    error, 
    fetchOvertimeRequests, 
    refreshOvertimeRequests,
    clearError,
    deleteOvertimeRequest
  } = useOvertimeRequest();

  return <OvertimeListContent navigation={navigation} />;
}

function OvertimeListContent({ navigation }) {
  const { 
    overtimeRequests, 
    loading, 
    error, 
    fetchOvertimeRequests, 
    refreshOvertimeRequests,
    clearError,
    deleteOvertimeRequest
  } = useOvertimeRequest();
  
  const [refreshing, setRefreshing] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);

  // Load data on component mount
  useEffect(() => {
    loadOvertimeRequests();
  }, []);

  // Reload data when screen comes into focus (e.g., returning from add/edit screen)
  useFocusEffect(
    useCallback(() => {
      console.log('Overtime list screen focused, reloading data...');
      loadOvertimeRequests();
    }, [])
  );

  const loadOvertimeRequests = async () => {
    try {
      await fetchOvertimeRequests();
    } catch (err) {
      console.error('Error loading overtime requests:', err);
      Alert.alert('Lỗi', 'Không thể tải danh sách đơn tăng ca');
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refreshOvertimeRequests();
    } catch (err) {
      console.error('Error refreshing overtime requests:', err);
      Alert.alert('Lỗi', 'Không thể làm mới danh sách');
    } finally {
      setRefreshing(false);
    }
  };

  const handleEdit = (voucherCode) => {
    navigation.navigate('EditOvertime', { id: voucherCode });
  };

  const handleDelete = async (voucherCode) => {
    try {
      await deleteOvertimeRequest(voucherCode);
      setShowDeleteDialog(false);
      setSelectedItem(null);
      Alert.alert('Thành công', 'Xóa đơn tăng ca thành công');
    } catch (error) {
      console.error('Error deleting overtime request:', error);
      Alert.alert('Lỗi', 'Không thể xóa đơn tăng ca');
    }
  };

  const openDeleteDialog = (item) => {
    setSelectedItem(item);
    setShowDeleteDialog(true);
  };

  const confirmDelete = () => {
    if (selectedItem) {
      handleDelete(selectedItem.voucherCode);
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
        return '#6c757d'; // Tạo mới - gray
      case 1:
      case '1':
      case 'Chờ duyệt':
        return '#fb8c00'; // Chờ duyệt - orange
      case 2:
      case '2':
      case 'Đã duyệt':
        return '#43a047'; // Đã duyệt - green
      case 3:
      case '3':
      case 'Từ chối':
        return '#e53935'; // Từ chối - red
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

  const renderOvertimeItem = ({ item }) => (
    <View style={styles.card}>
      <TouchableOpacity 
        onPress={() => navigation.navigate('OvertimeDetail', { id: item.voucherCode })} 
        style={styles.cardContent}
      >
        <View style={styles.cardHeader}>
          <Text style={styles.voucherCode}>#{item.voucherCode}</Text>
          <Text style={[styles.status, { color: getStatusColor(item.approveStatus) }]}>
            {getStatusText(item.approveStatus)}
          </Text>
        </View>
        
        <Text style={styles.type}>{item.overtimeTypeName || 'Tăng ca'}</Text>
        <Text style={styles.form}>{item.overtimeFormName || 'Hình thức tăng ca'}</Text>
        <Text style={styles.coefficient}>Hệ số: {item.coefficient}</Text>
        <Text style={styles.employee}>Nhân viên: {item.userName || item.employeeID}</Text>
        <Text style={styles.date}>
          Từ: {formatDateTime(item.startDateTime)} - Đến: {formatDateTime(item.endDateTime)}
        </Text>
        {item.reason && (
          <Text style={styles.reason} numberOfLines={2}>
            Lý do: {item.reason}
          </Text>
        )}
      </TouchableOpacity>
      
      {/* Action buttons */}
      <View style={styles.actionButtons}>
        <TouchableOpacity 
          style={[styles.actionButton, styles.editButton]} 
          onPress={() => handleEdit(item.voucherCode)}
        >
          <Icon name="pencil" size={18} color="#fff" />
          <Text style={styles.actionButtonText}>Sửa</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.actionButton, styles.deleteButton]} 
          onPress={() => openDeleteDialog(item)}
        >
          <Icon name="delete" size={18} color="#fff" />
          <Text style={styles.actionButtonText}>Xóa</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  if (loading && !refreshing) {
    return (
      <View style={styles.container}>
        <CustomHeader title="Đơn tăng ca" />
        <View style={styles.addButtonContainer}>
          <TouchableOpacity style={styles.addBtn} onPress={() => navigation.navigate('AddOvertime')}> 
            <View style={styles.addBtnSolid}>
              <Icon name="plus-circle" size={32} color="#ffffff" />
            </View>
          </TouchableOpacity>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3498db" />
          <Text style={styles.loadingText}>Đang tải dữ liệu...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CustomHeader title="Đơn tăng ca" />
      <View style={styles.addButtonContainer}>
        <TouchableOpacity style={styles.addBtn} onPress={() => navigation.navigate('AddOvertime')}> 
          <View style={styles.addBtnSolid}>
            <Icon name="plus-circle" size={32} color="#ffffff" />
          </View>
        </TouchableOpacity>
      </View>

      {/* Error Message */}
      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={clearError} style={styles.errorCloseBtn}>
            <Icon name="close" size={20} color="#e53935" />
          </TouchableOpacity>
        </View>
      )}

      {/* Overtime List */}
      <FlatList
        data={overtimeRequests}
        keyExtractor={item => item.voucherCode}
        renderItem={renderOvertimeItem}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={['#008080']}
            tintColor="#008080"
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Icon name="clock-outline" size={64} color="#ccc" />
            <Text style={styles.emptyText}>Chưa có đơn tăng ca nào</Text>
            <TouchableOpacity 
              style={styles.emptyButton}
              onPress={() => navigation.navigate('AddOvertime')}
            >
              <Text style={styles.emptyButtonText}>Tạo đơn tăng ca</Text>
            </TouchableOpacity>
          </View>
        }
        contentContainerStyle={overtimeRequests.length === 0 ? styles.emptyListContainer : null}
      />
      
      {/* Delete Confirmation Modal */}
      <Modal
        visible={showDeleteDialog}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowDeleteDialog(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Xác nhận xóa</Text>
            </View>
            
            <View style={styles.modalContent}>
              <Text style={styles.modalMessage}>
                Bạn có chắc chắn muốn xóa đơn tăng ca{' '}
                <Text style={styles.modalVoucherCode}>#{selectedItem?.voucherCode}</Text>?
              </Text>
            </View>
            
            <View style={styles.modalActions}>
              <TouchableOpacity 
                style={[styles.modalButton, styles.cancelButton]} 
                onPress={() => setShowDeleteDialog(false)}
              >
                <Text style={styles.cancelButtonText}>Hủy</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.modalButton, styles.confirmButton]} 
                onPress={confirmDelete}
              >
                <Text style={styles.confirmButtonText}>Xóa</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
        </Modal>
    </View>
    );
  }

const styles = StyleSheet.create({
  container: { flex: 1, padding: 0 },
  addButtonContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#fff',
  },
  addBtn: { 
    borderRadius: 25,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  addBtnSolid: {
    padding: 8,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3498db',
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
    color: '#666',
  },
  errorContainer: {
    backgroundColor: '#ffebee',
    margin: 12,
    padding: 12,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  errorText: {
    color: '#e53935',
    fontSize: 14,
    flex: 1,
  },
  errorCloseBtn: {
    padding: 4,
  },
  card: { 
    backgroundColor: '#fff', 
    margin: 12, 
    borderRadius: 12, 
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  cardContent: {
    padding: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  voucherCode: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#008080',
  },
  type: { 
    fontWeight: 'bold', 
    fontSize: 16, 
    color: '#1976d2', 
    marginBottom: 4 
  },
  form: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  coefficient: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  employee: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  date: { 
    color: '#555', 
    marginBottom: 4,
    fontSize: 14,
  },
  reason: {
    color: '#666',
    fontSize: 13,
    fontStyle: 'italic',
    marginTop: 4,
  },
  status: { 
    fontWeight: 'bold', 
    fontSize: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: '#f5f5f5',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 16,
    color: '#888',
    marginTop: 16,
    marginBottom: 20,
    textAlign: 'center',
  },
  emptyButton: {
    backgroundColor: '#008080',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  emptyButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  emptyListContainer: {
    flexGrow: 1,
  },
  // Action buttons styles
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 16,
    paddingBottom: 16,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    minWidth: 80,
    justifyContent: 'center',
  },
  editButton: {
    backgroundColor: '#28a745',
  },
  deleteButton: {
    backgroundColor: '#dc3545',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
    marginLeft: 4,
  },
  // Modal styles
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
  modalContent: {
    padding: 20,
  },
  modalMessage: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
  },
  modalVoucherCode: {
    fontWeight: 'bold',
    color: '#008080',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: 20,
    paddingTop: 0,
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
  confirmButton: {
    backgroundColor: '#dc3545',
  },
  cancelButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  confirmButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
