import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useEffect, useState, useCallback, useMemo } from 'react';
import { ActivityIndicator, Alert, FlatList, Modal, RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View, Platform } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useLeaveRequest } from '../../composables/useLeaveRequest';
import { useAuth } from '../../contexts/AuthContext';
import CustomHeader from '../../components/CustomHeader';
import Pagination from '../../components/Pagination';

export default function LeaveListScreen() {
  const navigation = useNavigation();
  const { 
    leaveRequests, 
    loading, 
    error, 
    fetchLeaveRequests, 
    refreshLeaveRequests,
    clearError,
    deleteLeaveRequest
  } = useLeaveRequest();

  return <LeaveListContent navigation={navigation} />;
}

function LeaveListContent({ navigation }) {
  const { 
    leaveRequests, 
    loading, 
    error, 
    fetchLeaveRequests, 
    refreshLeaveRequests,
    clearError,
    deleteLeaveRequest,
    submitForApproval,
    approveLeaveRequest
  } = useLeaveRequest();
  
  const { user, isDirector, isHRManager, isHREmployee, isHRStaff } = useAuth();
  
  const [refreshing, setRefreshing] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  
  // Approval modal state
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [pendingAction, setPendingAction] = useState(''); // 'submit', 'approve', 'reject', 'return'
  const [approvalNotes, setApprovalNotes] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Filter state
  const [showFilter, setShowFilter] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [dateRange, setDateRange] = useState({
    start: null,
    end: null
  });
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);

  // Load data on component mount
  useEffect(() => {
    loadLeaveRequests();
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadLeaveRequests();
    }, [])
  );

  const loadLeaveRequests = async () => {
    try {
      await fetchLeaveRequests();
    } catch (err) {
      Alert.alert('Lỗi', 'Không thể tải danh sách đơn nghỉ phép');
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refreshLeaveRequests();
    } catch (err) {
      Alert.alert('Lỗi', 'Không thể làm mới danh sách');
    } finally {
      setRefreshing(false);
    }
  };

  const handleEdit = (voucherCode) => {
    navigation.navigate('EditLeave', { id: voucherCode });
  };

  const handleDelete = async (voucherCode) => {
    try {
      await deleteLeaveRequest(voucherCode);
      setShowDeleteDialog(false);
      setSelectedItem(null);
      Alert.alert('Thành công', 'Xóa đơn nghỉ phép thành công');
    } catch (error) {
      Alert.alert('Lỗi', 'Không thể xóa đơn nghỉ phép');
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

  // Permission helper functions - similar to leave.vue
  const canEditItem = useCallback((item) => {
    if (!item) return false;
    
    // Only allow edit if status is "Tạo mới" - không cho phép sửa đơn đã duyệt
    const isCreatedStatus = item.approveStatus === 'Tạo mới' || 
                           item.approveStatus === 0 || 
                           item.approveStatus === '0';
    if (!isCreatedStatus) return false;
    
    // Director can edit all items in "Tạo mới" status
    if (isDirector()) {
      return true;
    }
    
    // HR staff can edit all items in "Tạo mới" status
    if (isHRStaff()) {
      return true;
    }
    
    // Other users can only edit their own items
    return item.employeeID === user?.id || item.employeeCode === user?.id;
  }, [user, isDirector, isHRStaff]);

  const canDeleteItem = useCallback((item) => {
    if (!item) return false;
    
    // Only allow delete if status is "Tạo mới" - không cho phép xóa đơn đã duyệt
    const isCreatedStatus = item.approveStatus === 'Tạo mới' || 
                           item.approveStatus === 0 || 
                           item.approveStatus === '0';
    if (!isCreatedStatus) return false;
    
    // Director can delete all items in "Tạo mới" status
    if (isDirector()) {
      return true;
    }
    
    // HR staff can delete all items in "Tạo mới" status
    if (isHRStaff()) {
      return true;
    }
    
    // Other users can only delete their own items
    return item.employeeID === user?.id || item.employeeCode === user?.id;
  }, [user, isDirector, isHRStaff]);

  const canSubmitItem = useCallback((item) => {
    if (!item) return false;
    
    // Only allow submit if status is "Tạo mới"
    const isCreatedStatus = item.approveStatus === 'Tạo mới' || 
                           item.approveStatus === 0 || 
                           item.approveStatus === '0';
    if (!isCreatedStatus) return false;
    
    // Director can submit all items in "Tạo mới" status
    if (isDirector()) {
      return true;
    }
    
    // HR staff can submit all items in "Tạo mới" status
    if (isHRStaff()) {
      return true;
    }
    
    // Other users can only submit their own items
    return item.employeeID === user?.id || item.employeeCode === user?.id;
  }, [user, isDirector, isHRStaff]);

  const canApproveItem = useCallback((item) => {
    if (!item) return false;
    
    // Only allow approve if status is "Chờ duyệt"
    const isPendingStatus = item.approveStatus === 'Chờ duyệt' || 
                           item.approveStatus === 'Pending' || 
                           item.approveStatus === 1 || 
                           item.approveStatus === '1';
    if (!isPendingStatus) return false;
    
    // Director can approve all items in "Chờ duyệt" status
    if (isDirector()) {
      return true;
    }
    
    // HR Manager can approve items
    if (isHRManager()) {
      return true;
    }
    
    // HR Employee can approve items (depending on workflow)
    if (isHREmployee()) {
      return true;
    }
    
    // For now, only HR staff and Director can approve
    // You can add more complex logic here based on workflow
    return false;
  }, [isDirector, isHRManager, isHREmployee]);

  const handleSubmitForApproval = (item) => {
    setSelectedItem(item);
    setPendingAction('submit');
    setApprovalNotes('');
    setShowApprovalModal(true);
  };

  const handleApprove = (item, action) => {
    setSelectedItem(item);
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
    if (!selectedItem) return;
    
    try {
      setActionLoading(true);
      const notes = approvalNotes.trim() || null;
      
      switch (pendingAction) {
        case 'submit':
          await submitForApproval(selectedItem.voucherCode, notes);
          Alert.alert('Thành công', 'Gửi duyệt thành công', [
            { text: 'OK', onPress: () => loadLeaveRequests() }
          ]);
          break;
        case 'approve':
        case 'reject':
        case 'return':
          await approveLeaveRequest(selectedItem.voucherCode, pendingAction, notes);
          const actionText = pendingAction === 'approve' ? 'Duyệt' : pendingAction === 'reject' ? 'Từ chối' : 'Trả lại';
          Alert.alert('Thành công', `${actionText} thành công`, [
            { text: 'OK', onPress: () => loadLeaveRequests() }
          ]);
          break;
      }
      
      setShowApprovalModal(false);
      setPendingAction('');
      setApprovalNotes('');
      setSelectedItem(null);
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
    setSelectedItem(null);
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

  const getStatusColor = (status) => {
    switch (status) {
      case 0:
      case '0':
      case 'Tạo mới':
        return '#3498db'; // Tạo mới - blue
      case 1:
      case '1':
      case 'Chờ duyệt':
        return '#ffc107'; // Chờ duyệt - yellow
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

  // Filter logic with permissions (giống logic trong Leave.vue)
  const filteredLeaveRequests = useMemo(() => {
    if (!leaveRequests || leaveRequests.length === 0) return [];
    
    // Áp dụng phân quyền: filter dữ liệu theo quyền của user
    let result = [...leaveRequests];
    
    // Giám đốc, trưởng phòng HCNS, nhân viên HCNS: xem tất cả
    if (isDirector() || isHRManager() || isHREmployee()) {
      // Không filter, giữ nguyên tất cả
    } 
    // Chỉ huy công trình: xem của mình và công nhân
    else if (user?.role === 'manager' || user?.role === 'MANAGER' || user?.role === '4') {
      result = result.filter(item => {
        const isOwn = item.employeeID === user?.id || item.employeeCode === user?.id;
        const isWorker = item.role === 'worker' || item.submitterRole === 'worker' || 
                        item.role === 'WORKER' || item.submitterRole === 'WORKER' ||
                        item.role === '1' || item.submitterRole === '1';
        return isOwn || isWorker;
      });
    }
    // Nhân viên kỹ thuật, công nhân: chỉ xem của mình
    else {
      result = result.filter(item => 
        item.employeeID === user?.id || item.employeeCode === user?.id
      );
    }

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(request =>
        request.voucherCode?.toLowerCase().includes(query) ||
        request.employeeID?.toString().includes(query) ||
        request.userName?.toLowerCase().includes(query) ||
        request.leaveTypeName?.toLowerCase().includes(query) ||
        request.reason?.toLowerCase().includes(query)
      );
    }

    // Apply status filter
    if (statusFilter) {
      const statusMap = {
        'Tạo mới': [0, '0', 'Tạo mới', 'Created'],
        'Chờ duyệt': [1, '1', 'Chờ duyệt', 'Pending'],
        'Đã duyệt': [2, '2', 'Đã duyệt', 'Approved'],
        'Từ chối': [3, '3', 'Từ chối', 'Rejected']
      };
      const statusValues = statusMap[statusFilter] || [];
      result = result.filter(request => {
        const requestStatus = request.approveStatus;
        return statusValues.some(val => 
          requestStatus === val || String(requestStatus) === String(val)
        );
      });
    }

    // Apply date range filter
    if (dateRange.start && dateRange.end) {
      const start = new Date(dateRange.start);
      const end = new Date(dateRange.end);
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);

      result = result.filter(request => {
        if (!request.startDateTime) return false;
        const requestDate = new Date(request.startDateTime);
        return requestDate >= start && requestDate <= end;
      });
    }

    return result;
  }, [leaveRequests, searchQuery, statusFilter, dateRange, user, isDirector, isHRManager, isHREmployee]);

  // Pagination logic
  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filteredLeaveRequests.slice(startIndex, endIndex);
  }, [filteredLeaveRequests, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(filteredLeaveRequests.length / itemsPerPage);

  const handlePreviousPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  // Reset to first page when data changes
  useEffect(() => {
    setCurrentPage(1);
  }, [filteredLeaveRequests.length]);

  // Reset filters
  const resetFilters = () => {
    setSearchQuery('');
    setStatusFilter('');
    setDateRange({ start: null, end: null });
    setCurrentPage(1);
  };

  const renderLeaveItem = ({ item }) => (
    <View style={styles.card}>
      <TouchableOpacity 
        onPress={() => navigation.navigate('LeaveDetail', { id: item.voucherCode })} 
        style={styles.cardContent}
      >
        <View style={styles.cardHeader}>
          <Text style={styles.voucherCode}>#{item.voucherCode}</Text>
          <View style={[styles.statusBadge, { 
            backgroundColor: getStatusColor(item.approveStatus) === '#3498db' ? '#e3f2fd' : 
                           getStatusColor(item.approveStatus) === '#ffc107' ? '#fff8e1' :
                           getStatusColor(item.approveStatus) === '#43a047' ? '#e8f5e9' :
                           getStatusColor(item.approveStatus) === '#e53935' ? '#ffebee' : '#f5f5f5',
            borderColor: getStatusColor(item.approveStatus)
          }]}>
            <Text style={[styles.statusText, { color: getStatusColor(item.approveStatus) }]}>
              {getStatusText(item.approveStatus)}
            </Text>
          </View>
        </View>
        
        <Text style={styles.type}>{item.leaveTypeName || 'Nghỉ phép'}</Text>
        <Text style={styles.employee}>Nhân viên: {item.userName || item.employeeID}</Text>
        <Text style={styles.date}>
          Từ: {formatDate(item.startDateTime)} - Đến: {formatDate(item.endDateTime)}
        </Text>
        {item.reason && (
          <Text style={styles.reason} numberOfLines={2}>
            Lý do: {item.reason}
          </Text>
        )}
      </TouchableOpacity>
      
      {/* Action buttons */}
      <View style={styles.actionButtons}>
        {canEditItem(item) && (
          <TouchableOpacity 
            style={[styles.actionButton, styles.editButton]} 
            onPress={() => handleEdit(item.voucherCode)}
          >
            <Icon name="pencil" size={18} color="#fff" />
            <Text style={styles.actionButtonText}>Sửa</Text>
          </TouchableOpacity>
        )}
        
        {canDeleteItem(item) && (
          <TouchableOpacity 
            style={[styles.actionButton, styles.deleteButton]} 
            onPress={() => openDeleteDialog(item)}
          >
            <Icon name="delete" size={18} color="#fff" />
            <Text style={styles.actionButtonText}>Xóa</Text>
          </TouchableOpacity>
        )}

        {canSubmitItem(item) && (
          <TouchableOpacity 
            style={[styles.actionButton, styles.submitButton]} 
            onPress={() => handleSubmitForApproval(item)}
          >
            <Icon name="send" size={18} color="#fff" />
            <Text style={styles.actionButtonText}>Gửi duyệt</Text>
          </TouchableOpacity>
        )}

        {canApproveItem(item) && (
          <>
            <TouchableOpacity 
              style={[styles.actionButton, styles.approveButton]} 
              onPress={() => handleApprove(item, 'approve')}
            >
              <Icon name="check" size={18} color="#fff" />
              <Text style={styles.actionButtonText}>Duyệt</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.actionButton, styles.rejectButton]} 
              onPress={() => handleApprove(item, 'reject')}
            >
              <Icon name="close" size={18} color="#fff" />
              <Text style={styles.actionButtonText}>Từ chối</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.actionButton, styles.returnButton]} 
              onPress={() => handleApprove(item, 'return')}
            >
              <Icon name="undo" size={18} color="#fff" />
              <Text style={styles.actionButtonText}>Trả lại</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </View>
  );

  if (loading && !refreshing) {
    return (
      <View style={styles.container}>
        <CustomHeader title="Đơn nghỉ phép" />
        <View style={styles.toolbarContainer}>
          <TouchableOpacity 
            style={[styles.toolbarButton, styles.filterButton]} 
            onPress={() => setShowFilter(!showFilter)}
          >
            <Icon name="filter" size={20} color="#3498db" />
            <Text style={styles.toolbarButtonText}>Lọc</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.toolbarButton, styles.addButton]} 
            onPress={() => navigation.navigate('AddLeave')}
          >
            <Icon name="plus-circle" size={20} color="#ffffff" />
            <Text style={[styles.toolbarButtonText, styles.addButtonText]}>Thêm</Text>
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
      <CustomHeader title="Đơn nghỉ phép" />
      <View style={styles.toolbarContainer}>
        <TouchableOpacity 
          style={[styles.toolbarButton, styles.filterButton]} 
          onPress={() => setShowFilter(!showFilter)}
        >
          <Icon name="filter" size={20} color="#3498db" />
          <Text style={styles.toolbarButtonText}>Lọc</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.toolbarButton, styles.addButton]} 
          onPress={() => navigation.navigate('AddLeave')}
        >
          <Icon name="plus-circle" size={20} color="#ffffff" />
          <Text style={[styles.toolbarButtonText, styles.addButtonText]}>Thêm</Text>
        </TouchableOpacity>
      </View>

      {/* Filter Section */}
      {showFilter && (
        <View style={styles.filterSection}>
          <View style={styles.filterRow}>
            <TextInput
              style={styles.filterInput}
              placeholder="Tìm kiếm theo số phiếu, mã NV, tên..."
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholderTextColor="#999"
            />
          </View>
          <View style={styles.filterRow}>
            <View style={styles.filterSelectContainer}>
              <Text style={styles.filterLabel}>Trạng thái:</Text>
              <View style={styles.filterSelect}>
                <TouchableOpacity
                  style={[
                    styles.filterOption,
                    statusFilter === '' && styles.filterOptionActive
                  ]}
                  onPress={() => setStatusFilter('')}
                >
                  <Text style={[
                    styles.filterOptionText,
                    statusFilter === '' && styles.filterOptionTextActive
                  ]}>Tất cả</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.filterOption,
                    statusFilter === 'Tạo mới' && styles.filterOptionActive
                  ]}
                  onPress={() => setStatusFilter('Tạo mới')}
                >
                  <Text style={[
                    styles.filterOptionText,
                    statusFilter === 'Tạo mới' && styles.filterOptionTextActive
                  ]}>Tạo mới</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.filterOption,
                    statusFilter === 'Chờ duyệt' && styles.filterOptionActive
                  ]}
                  onPress={() => setStatusFilter('Chờ duyệt')}
                >
                  <Text style={[
                    styles.filterOptionText,
                    statusFilter === 'Chờ duyệt' && styles.filterOptionTextActive
                  ]}>Chờ duyệt</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.filterOption,
                    statusFilter === 'Đã duyệt' && styles.filterOptionActive
                  ]}
                  onPress={() => setStatusFilter('Đã duyệt')}
                >
                  <Text style={[
                    styles.filterOptionText,
                    statusFilter === 'Đã duyệt' && styles.filterOptionTextActive
                  ]}>Đã duyệt</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.filterOption,
                    statusFilter === 'Từ chối' && styles.filterOptionActive
                  ]}
                  onPress={() => setStatusFilter('Từ chối')}
                >
                  <Text style={[
                    styles.filterOptionText,
                    statusFilter === 'Từ chối' && styles.filterOptionTextActive
                  ]}>Từ chối</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
          <View style={styles.filterRow}>
            <View style={styles.dateFilterContainer}>
              <Text style={styles.filterLabel}>Từ ngày:</Text>
              <TouchableOpacity
                style={styles.dateInput}
                onPress={() => setShowStartDatePicker(true)}
              >
                <Text style={[
                  styles.dateInputText,
                  !dateRange.start && styles.dateInputPlaceholder
                ]}>
                  {dateRange.start 
                    ? new Date(dateRange.start).toLocaleDateString('vi-VN')
                    : 'Chọn ngày'
                  }
                </Text>
                <Icon name="calendar" size={20} color="#3498db" />
              </TouchableOpacity>
            </View>
            <View style={styles.dateFilterContainer}>
              <Text style={styles.filterLabel}>Đến ngày:</Text>
              <TouchableOpacity
                style={styles.dateInput}
                onPress={() => setShowEndDatePicker(true)}
              >
                <Text style={[
                  styles.dateInputText,
                  !dateRange.end && styles.dateInputPlaceholder
                ]}>
                  {dateRange.end 
                    ? new Date(dateRange.end).toLocaleDateString('vi-VN')
                    : 'Chọn ngày'
                  }
                </Text>
                <Icon name="calendar" size={20} color="#3498db" />
              </TouchableOpacity>
            </View>
          </View>
          <TouchableOpacity style={styles.resetFilterButton} onPress={resetFilters}>
            <Icon name="refresh" size={18} color="#3498db" />
            <Text style={styles.resetFilterText}>Đặt lại</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Date Pickers */}
      {showStartDatePicker && (
        <DateTimePicker
          value={dateRange.start ? new Date(dateRange.start) : new Date()}
          mode="date"
          display="default"
          onChange={(event, selectedDate) => {
            setShowStartDatePicker(Platform.OS === 'ios');
            if (selectedDate) {
              setDateRange(prev => ({ ...prev, start: selectedDate.toISOString() }));
            }
          }}
        />
      )}
      {showEndDatePicker && (
        <DateTimePicker
          value={dateRange.end ? new Date(dateRange.end) : new Date()}
          mode="date"
          display="default"
          onChange={(event, selectedDate) => {
            setShowEndDatePicker(Platform.OS === 'ios');
            if (selectedDate) {
              setDateRange(prev => ({ ...prev, end: selectedDate.toISOString() }));
            }
          }}
        />
      )}

      {/* Error Message */}
      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={clearError} style={styles.errorCloseBtn}>
            <Icon name="close" size={20} color="#e53935" />
          </TouchableOpacity>
        </View>
      )}

      {/* Leave List */}
      <FlatList
        data={paginatedData}
        keyExtractor={item => item.voucherCode}
        renderItem={renderLeaveItem}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={['#3498db']}
            tintColor="#3498db"
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Icon name="calendar-remove" size={64} color="#ccc" />
            <Text style={styles.emptyText}>Chưa có đơn nghỉ phép nào</Text>
            <TouchableOpacity 
              style={styles.emptyButton}
              onPress={() => navigation.navigate('AddLeave')}
            >
              <Text style={styles.emptyButtonText}>Tạo đơn nghỉ phép</Text>
            </TouchableOpacity>
          </View>
        }
        contentContainerStyle={filteredLeaveRequests.length === 0 ? styles.emptyListContainer : null}
        ListFooterComponent={
          filteredLeaveRequests.length > itemsPerPage ? (
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={filteredLeaveRequests.length}
              itemsPerPage={itemsPerPage}
              onPreviousPage={handlePreviousPage}
              onNextPage={handleNextPage}
            />
          ) : null
        }
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
                Bạn có chắc chắn muốn xóa đơn nghỉ phép{' '}
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
  container: { flex: 1, padding: 0, backgroundColor: '#f5f5f5' },
  toolbarContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#fff',
    gap: 8,
  },
  toolbarButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  filterButton: {
    backgroundColor: '#e3f2fd',
    borderWidth: 1,
    borderColor: '#3498db',
  },
  addButton: {
    backgroundColor: '#3498db',
  },
  toolbarButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3498db',
  },
  addButtonText: {
    color: '#ffffff',
  },
  filterSection: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 20,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  filterRow: {
    marginBottom: 12,
  },
  filterInput: {
    backgroundColor: '#f6f8fa',
    borderRadius: 10,
    padding: 14,
    fontSize: 14,
    borderWidth: 1.5,
    borderColor: '#e0e0e0',
    color: '#2c3e50',
  },
  filterSelectContainer: {
    marginBottom: 8,
  },
  filterLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: 8,
  },
  filterSelect: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterOption: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#f6f8fa',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  filterOptionActive: {
    backgroundColor: '#3498db',
    borderColor: '#3498db',
  },
  filterOptionText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  filterOptionTextActive: {
    color: '#ffffff',
  },
  dateFilterContainer: {
    marginBottom: 12,
  },
  dateInput: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f6f8fa',
    borderRadius: 10,
    padding: 14,
    borderWidth: 1.5,
    borderColor: '#e0e0e0',
  },
  dateInputText: {
    fontSize: 14,
    color: '#2c3e50',
  },
  dateInputPlaceholder: {
    color: '#999',
  },
  resetFilterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#f6f8fa',
    borderWidth: 1.5,
    borderColor: '#3498db',
    gap: 6,
    marginTop: 8,
  },
  resetFilterText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3498db',
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
    marginHorizontal: 16,
    borderRadius: 16, 
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  cardContent: {
    padding: 20,
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
    color: '#3498db',
  },
  type: { 
    fontWeight: 'bold', 
    fontSize: 16, 
    color: '#3498db', 
    marginBottom: 4 
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
  statusBadge: { 
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1.5,
  },
  statusText: { 
    fontWeight: '700', 
    fontSize: 12,
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
    backgroundColor: '#3498db',
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
    justifyContent: 'flex-start',
    flexWrap: 'wrap',
    paddingHorizontal: 20,
    paddingBottom: 20,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    gap: 8,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    minWidth: 85,
    justifyContent: 'center',
    marginRight: 4,
    marginBottom: 4,
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
    color: '#3498db',
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
  modalConfirmButton: {
    backgroundColor: '#3498db',
  },
});
