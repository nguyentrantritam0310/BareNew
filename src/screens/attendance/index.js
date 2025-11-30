import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useAttendanceData } from '../../composables/useAttendanceData';
import CustomHeader from '../../components/CustomHeader';
import Pagination from '../../components/Pagination';
import { useAuth } from '../../contexts/AuthContext';

export default function AttendanceScreen() {
  const { user, isDirector, isHRManager, isHREmployee } = useAuth();
  const { attendanceData, loading, error, fetchAttendanceData } = useAttendanceData();
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth() + 1);
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [transformedData, setTransformedData] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 6;

  useEffect(() => {
    loadAttendanceData();
  }, [currentMonth, currentYear]);

  useEffect(() => {
    processAttendanceData();
  }, [attendanceData]);

  const loadAttendanceData = async () => {
    await fetchAttendanceData({
      year: currentYear,
      month: currentMonth
    });
  };

  // Transform data giống như tab "Dữ liệu chấm công" - service đã transform thành 2 records riêng biệt
  const processAttendanceData = () => {
    if (!attendanceData || attendanceData.length === 0) {
      setTransformedData([]);
      return;
    }

    // Filter data based on user role (giống AttendanceSummaryView.vue)
    const hasHRPermission = isDirector() || isHRManager() || isHREmployee();
    
    let filteredData = attendanceData;
    if (!hasHRPermission && user?.id) {
      filteredData = attendanceData.filter(item => {
        const itemEmployeeId = item.employeeCode || item.employeeID || item.employeeId || item.id;
        return String(itemEmployeeId) === String(user.id);
      });
    }

    const transformed = [];
    let sttCounter = 1;

    filteredData.forEach(item => {
      // Parse location để lấy latitude/longitude nếu có
      const parseLocation = (locationStr) => {
        if (!locationStr) return { lat: null, lng: null, name: null };
        
        // Kiểm tra xem có phải là coordinates không (format: "lat,lng" hoặc "lat, lng")
        const coordMatch = locationStr.match(/^(-?\d+\.?\d*),\s*(-?\d+\.?\d*)$/);
        if (coordMatch) {
          return {
            lat: parseFloat(coordMatch[1]),
            lng: parseFloat(coordMatch[2]),
            name: locationStr
          };
        }
        
        // Nếu không phải coordinates, trả về như tên địa điểm
        return { lat: null, lng: null, name: locationStr };
      };

      // Service đã transform thành records riêng biệt, mỗi record có type là 'ĐiLam' hoặc 'Về'
      const locationInfo = parseLocation(item.location);
      const scanTime = item.scanTime ? new Date(item.scanTime) : null;
      const scanTimeStr = scanTime ? scanTime.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : '-';
      
      // Xác định type dựa trên item.type từ service
      let displayType = 'Vào';
      if (item.type === 'Về' || item.type === 'Về sớm') {
        displayType = 'Ra';
      } else if (item.type === 'Đi trễ') {
        displayType = 'Vào';
      }

      transformed.push({
        stt: sttCounter++,
        id: item.employeeCode || item.employeeID || item.id || '-',
        name: item.employeeName || '-',
        shift: item.shiftName || '-',
        date: formatDate(item.date || item.workDate),
        scanTime: scanTimeStr,

        location: item.location || '-',
        locationLat: locationInfo.lat,
        locationLng: locationInfo.lng,
        type: displayType
      });
    });

    setTransformedData(transformed);
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return '-';
      return date.toLocaleDateString('vi-VN');
    } catch {
      return '-';
    }
  };

  const adjustMonth = (direction) => {
    if (direction === 'prev') {
      if (currentMonth === 1) {
        setCurrentMonth(12);
        setCurrentYear(currentYear - 1);
      } else {
        setCurrentMonth(currentMonth - 1);
      }
    } else {
      if (currentMonth === 12) {
        setCurrentMonth(1);
        setCurrentYear(currentYear + 1);
      } else {
        setCurrentMonth(currentMonth + 1);
      }
    }
    setCurrentPage(1); // Reset to first page when changing month
  };

  const handlePreviousMonth = () => adjustMonth('prev');
  const handleNextMonth = () => adjustMonth('next');
  
  const goToCurrentMonth = () => {
    const now = new Date();
    setCurrentMonth(now.getMonth() + 1);
    setCurrentYear(now.getFullYear());
    setCurrentPage(1);
  };

  // Pagination
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedData = transformedData.slice(startIndex, endIndex);
  const totalPages = Math.ceil(transformedData.length / itemsPerPage);

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

  if (loading) {
    return (
      <View style={styles.container}>
        <CustomHeader title="Dữ liệu chấm công" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3498db" />
          <Text style={styles.loadingText}>Đang tải dữ liệu...</Text>
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <CustomHeader title="Dữ liệu chấm công" />
        <View style={styles.errorContainer}>
          <Icon name="alert-circle" size={64} color="#e53935" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={loadAttendanceData}>
            <Icon name="refresh" size={20} color="#fff" style={{ marginRight: 8 }} />
            <Text style={styles.retryButtonText}>Thử lại</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CustomHeader title="Dữ liệu chấm công" />
      
      {/* Month Navigation Card */}
      <View style={styles.monthCard}>
        <TouchableOpacity 
          style={styles.navButton} 
          onPress={handlePreviousMonth}
          activeOpacity={0.7}
        >
          <Icon name="chevron-left" size={24} color="white" />
        </TouchableOpacity>
        <View style={styles.monthInfo}>
          <Icon name="calendar-month" size={20} color="white" style={{ marginRight: 8 }} />
          <Text style={styles.monthText}>
            Tháng {currentMonth < 10 ? `0${currentMonth}` : currentMonth}/{currentYear}
          </Text>
        </View>
        <View style={styles.monthNavRight}>
          <TouchableOpacity 
            style={styles.navButton} 
            onPress={handleNextMonth}
            activeOpacity={0.7}
          >
            <Icon name="chevron-right" size={24} color="white" />
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.navButton} 
            onPress={goToCurrentMonth}
            activeOpacity={0.7}
            title="Tháng hiện tại"
          >
            <Icon name="calendar-today" size={20} color="white" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Stats Card */}
        {transformedData.length > 0 && (
          <View style={styles.statsCard}>
            <View style={styles.statItem}>
              <View style={[styles.statIcon, { backgroundColor: '#e3f2fd' }]}>
                <Icon name="file-document-multiple" size={24} color="#3498db" />
              </View>
              <View style={styles.statContent}>
                <Text style={styles.statValue}>{transformedData.length}</Text>
                <Text style={styles.statLabel}>Tổng bản ghi</Text>
              </View>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <View style={[styles.statIcon, { backgroundColor: '#e3f2fd' }]}>
                <Icon name="login" size={24} color="#3498db" />
              </View>
              <View style={styles.statContent}>
                <Text style={styles.statValue}>
                  {transformedData.filter(item => item.type === 'Vào').length}
                </Text>
                <Text style={styles.statLabel}>Lần vào</Text>
              </View>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <View style={[styles.statIcon, { backgroundColor: '#e3f2fd' }]}>
                <Icon name="logout" size={24} color="#3498db" />
              </View>
              <View style={styles.statContent}>
                <Text style={styles.statValue}>
                  {transformedData.filter(item => item.type === 'Ra').length}
                </Text>
                <Text style={styles.statLabel}>Lần ra</Text>
              </View>
            </View>
          </View>
        )}

        {/* Data Table Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Icon name="table" size={20} color="#3498db" />
            <Text style={styles.cardTitle}>Danh sách chấm công</Text>
          </View>
          
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={true}
            contentContainerStyle={styles.tableContainer}
          >
            <View>
              <View style={styles.tableHeader}>
                <Text style={[styles.th, styles.thStt]}>STT</Text>
                <Text style={[styles.th, styles.thId]}>Mã NV</Text>
                <Text style={[styles.th, styles.thName]}>Tên NV</Text>
                <Text style={[styles.th, styles.thShift]}>Ca</Text>
                <Text style={[styles.th, styles.thDate]}>Ngày</Text>
                <Text style={[styles.th, styles.thTime]}>Giờ quét</Text>
                <Text style={[styles.th, styles.thLocation]}>Máy chấm công</Text>
                <Text style={[styles.th, styles.thType]}>Loại</Text>
              </View>
              {paginatedData.map((row, idx) => (
                <View key={idx} style={[styles.tableRow, idx % 2 === 0 && styles.tableRowAlt]}>
                  <Text style={[styles.td, styles.tdStt]}>{row.stt}</Text>
                  <Text style={[styles.td, styles.tdId]} numberOfLines={1}>{row.id}</Text>
                  <Text style={[styles.td, styles.tdName]} numberOfLines={1}>{row.name}</Text>
                  <Text style={[styles.td, styles.tdShift]} numberOfLines={1}>{row.shift}</Text>
                  <Text style={[styles.td, styles.tdDate]}>{row.date}</Text>
                  <Text style={[styles.td, styles.tdTime, { color: row.type === 'Vào' ? '#3498db' : '#2c3e50', fontWeight: '600' }]}>
                    {row.scanTime}
                  </Text>
                  <Text style={[styles.td, styles.tdLocation]} numberOfLines={1}>{row.location}</Text>
                  <View style={[styles.td, styles.tdType]}>
                    <View style={[styles.typeBadge, row.type === 'Vào' ? styles.typeBadgeIn : styles.typeBadgeOut]}>
                      <Icon 
                        name={row.type === 'Vào' ? 'login' : 'logout'} 
                        size={14} 
                        color="#fff" 
                      />
                      <Text style={styles.typeBadgeText}>{row.type}</Text>
                    </View>
                  </View>
                </View>
              ))}
              {paginatedData.length === 0 && (
                <View style={styles.emptyContainer}>
                  <Icon name="information-outline" size={48} color="#999" />
                  <Text style={styles.emptyText}>Không có dữ liệu chấm công</Text>
                </View>
              )}
            </View>
          </ScrollView>
        </View>

        {/* Pagination Card */}
        {transformedData.length > 0 && (
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={transformedData.length}
            itemsPerPage={itemsPerPage}
            onPreviousPage={handlePreviousPage}
            onNextPage={handleNextPage}
          />
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#f5f5f5' 
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
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
    marginBottom: 24,
    textAlign: 'center',
    fontWeight: '500',
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3498db',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
    shadowColor: '#3498db',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  monthCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2c3e50',
    paddingVertical: 15,
    paddingHorizontal: 20,
    marginBottom: 10,
    borderRadius: 12,
    marginHorizontal: 16,
    marginTop: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  navButton: {
    padding: 8,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  monthInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  monthNavRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  monthText: {
    fontWeight: 'bold',
    fontSize: 16,
    color: 'white',
    letterSpacing: 0.5,
  },
  scrollContent: { 
    padding: 16,
    paddingBottom: 24,
  },
  statsCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
    borderLeftWidth: 4,
    borderLeftColor: '#3498db',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  statContent: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#2c3e50',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#6c757d',
    fontWeight: '500',
  },
  statDivider: {
    width: 1,
    backgroundColor: '#e0e0e0',
    marginHorizontal: 12,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 2,
    borderBottomColor: '#e0e0e0',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#2c3e50',
    marginLeft: 8,
  },
  tableContainer: {
    paddingVertical: 8,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f8f9fa',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderBottomWidth: 2,
    borderBottomColor: '#dee2e6',
  },
  th: {
    color: '#2c3e50',
    fontWeight: '700',
    fontSize: 13,
    textAlign: 'center',
  },
  thStt: { width: 50 },
  thId: { width: 80 },
  thName: { width: 140 },
  thShift: { width: 100 },
  thDate: { width: 100 },
  thTime: { width: 90 },
  thLocation: { width: 150 },
  thType: { width: 90 },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    backgroundColor: '#fff',
    alignItems: 'center',
  },
  tableRowAlt: {
    backgroundColor: '#f8f9fa',
  },
  td: {
    color: '#2c3e50',
    fontSize: 13,
    textAlign: 'center',
  },
  tdStt: { width: 50, fontWeight: '600' },
  tdId: { width: 80 },
  tdName: { width: 140, fontWeight: '500' },
  tdShift: { width: 100 },
  tdDate: { width: 100 },
  tdTime: { width: 90, fontWeight: '700' },
  tdMachine: { width: 120 },
  tdLocation: { width: 150 },
  tdType: { width: 90, alignItems: 'center', justifyContent: 'center' },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 4,
  },
  typeBadgeIn: {
    backgroundColor: '#3498db',
  },
  typeBadgeOut: {
    backgroundColor: '#2c3e50',
  },
  typeBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  emptyContainer: {
    padding: 48,
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  emptyText: {
    fontSize: 15,
    color: '#6c757d',
    textAlign: 'center',
    marginTop: 12,
    fontWeight: '500',
  },
});
