import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useAttendanceData } from '../../composables/useAttendanceData';
import { useWorkShift } from '../../composables/useWorkShift';
import CustomHeader from '../../components/CustomHeader';
import Pagination from '../../components/Pagination';
import { useAuth } from '../../contexts/AuthContext';

export default function AttendanceDetail() {
  const { user, isDirector, isHRManager, isHREmployee } = useAuth();
  const { attendanceData, loading, error, fetchAttendanceData } = useAttendanceData();
  const { workShifts, fetchWorkShifts } = useWorkShift();
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth() + 1);
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [processedData, setProcessedData] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    loadData();
  }, [currentMonth, currentYear]);

  useEffect(() => {
    if (attendanceData && workShifts) {
      processDetailData();
    }
  }, [attendanceData, workShifts]);

  const loadData = async () => {
    await Promise.all([
      fetchAttendanceData({
      year: currentYear,
      month: currentMonth
      }),
      fetchWorkShifts()
    ]);
  };

  // Tính toán giờ công, ngày công, số phút đi trễ và về sớm (giống calculateWorkDetails)
  const calculateWorkDetails = (item) => {
    const checkInTimeStr = item.checkInTime; // Format: "HH:mm"
    const checkOutTimeStr = item.checkOutTime; // Format: "HH:mm"
    
    if (!checkInTimeStr || !checkOutTimeStr) {
      return { hours: 0, days: 0, late: 0, early: 0 };
    }

    // Parse time string (HH:mm) to Date object
    const parseTime = (timeStr) => {
      const parts = timeStr.split(':');
      if (parts.length >= 2) {
        return new Date(`2000-01-01T${parts[0]}:${parts[1]}:00`);
      }
      return null;
    };

    const checkInTime = parseTime(checkInTimeStr);
    const checkOutTime = parseTime(checkOutTimeStr);
    
    if (!checkInTime || !checkOutTime) {
      return { hours: 0, days: 0, late: 0, early: 0 };
    }
    
    // Tính workDays sử dụng logic giống calculateWorkDaysFromAttendanceData
    let workDays = 0;
    let workHours = 0;
    
    if (item.workShiftID && workShifts && workShifts.length > 0) {
      const workShift = workShifts.find(shift => shift.id === item.workShiftID);
      
      if (workShift && workShift.shiftDetails) {
        const workDate = new Date(item.workDate);
        const dayOfWeek = workDate.getDay();
        const dayNames = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];
        const currentDayName = dayNames[dayOfWeek];
        
        const dayShiftDetail = workShift.shiftDetails.find(detail => detail.dayOfWeek === currentDayName);
        
        if (dayShiftDetail && dayShiftDetail.startTime !== '00:00:00' && dayShiftDetail.endTime !== '00:00:00') {
          const shiftStart = new Date(`2000-01-01T${dayShiftDetail.startTime}`);
          const shiftEnd = new Date(`2000-01-01T${dayShiftDetail.endTime}`);
          
          // Calculate standard work hours
          let standardWorkHours = (shiftEnd - shiftStart) / (1000 * 60 * 60);
          if (dayShiftDetail.breakStart && dayShiftDetail.breakEnd && 
              dayShiftDetail.breakStart !== '00:00:00' && dayShiftDetail.breakEnd !== '00:00:00') {
            const breakStart = new Date(`2000-01-01T${dayShiftDetail.breakStart}`);
            const breakEnd = new Date(`2000-01-01T${dayShiftDetail.breakEnd}`);
            const breakHours = (breakEnd - breakStart) / (1000 * 60 * 60);
            standardWorkHours -= breakHours;
          }
          
          // Tính thời gian chấm công vào/ra hiệu quả
          const effectiveCheckInTime = checkInTime < shiftStart ? shiftStart : checkInTime;
          const effectiveCheckOutTime = checkOutTime < shiftEnd ? checkOutTime : shiftEnd;
          
          let totalTimeHours = (effectiveCheckOutTime - effectiveCheckInTime) / (1000 * 60 * 60);
          if (totalTimeHours < 0) {
            totalTimeHours = 0;
          }
          
          // Subtract lunch break if applicable
          let actualWorkHours = totalTimeHours;
          if (dayShiftDetail.breakStart && dayShiftDetail.breakEnd && 
              dayShiftDetail.breakStart !== '00:00:00' && dayShiftDetail.breakEnd !== '00:00:00') {
            const breakStart = new Date(`2000-01-01T${dayShiftDetail.breakStart}`);
            const breakEnd = new Date(`2000-01-01T${dayShiftDetail.breakEnd}`);
            if (effectiveCheckInTime <= breakEnd && effectiveCheckOutTime >= breakStart) {
              const actualBreakStart = effectiveCheckInTime > breakStart ? effectiveCheckInTime : breakStart;
              const actualBreakEnd = effectiveCheckOutTime < breakEnd ? effectiveCheckOutTime : breakEnd;
              const actualBreakHours = (actualBreakEnd - actualBreakStart) / (1000 * 60 * 60);
              actualWorkHours = totalTimeHours - Math.max(0, actualBreakHours);
            }
          }
          
          if (actualWorkHours < 0) {
            actualWorkHours = 0;
          }
          
          workHours = actualWorkHours;
          // Tính ngày công: chia cho 8 giờ chuẩn
          workDays = Math.round((actualWorkHours / 8) * 100) / 100;
        } else {
          // Fallback: tính từ thời gian thực tế
          workHours = (checkOutTime - checkInTime) / (1000 * 60 * 60);
          if (workHours < 0) workHours = 0;
          workDays = Math.round((workHours / 8) * 100) / 100;
        }
      } else {
        // Fallback: calculate from actual time
        workHours = (checkOutTime - checkInTime) / (1000 * 60 * 60);
        if (workHours < 0) workHours = 0;
        workDays = Math.round((workHours / 8) * 100) / 100;
      }
    } else {
      // Fallback: calculate from actual time
      workHours = (checkOutTime - checkInTime) / (1000 * 60 * 60);
      if (workHours < 0) workHours = 0;
      workDays = Math.round((workHours / 8) * 100) / 100;
    }
    
    // Tính late và early minutes
    let lateMinutes = 0;
    let earlyMinutes = 0;
    
    if (item.workShiftID && workShifts && workShifts.length > 0) {
      const workShift = workShifts.find(shift => shift.id === item.workShiftID);
      
      if (workShift && workShift.shiftDetails) {
        const workDate = new Date(item.workDate);
        const dayOfWeek = workDate.getDay();
        const dayNames = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];
        const currentDayName = dayNames[dayOfWeek];
        
        const dayShiftDetail = workShift.shiftDetails.find(detail => detail.dayOfWeek === currentDayName);
        
        if (dayShiftDetail && dayShiftDetail.startTime !== '00:00:00' && dayShiftDetail.endTime !== '00:00:00') {
          const shiftStart = new Date(`2000-01-01T${dayShiftDetail.startTime}`);
          const shiftEnd = new Date(`2000-01-01T${dayShiftDetail.endTime}`);
          
          // Tính số phút đi trễ (chấm công vào sau giờ bắt đầu ca)
          if (checkInTime > shiftStart) {
            lateMinutes = Math.round((checkInTime - shiftStart) / (1000 * 60));
          }
          
          // Tính số phút về sớm (chấm công ra trước giờ kết thúc ca)
          if (checkOutTime < shiftEnd) {
            earlyMinutes = Math.round((shiftEnd - checkOutTime) / (1000 * 60));
          }
        }
      }
    }

    return {
      hours: Math.round(workHours * 100) / 100,
      days: workDays,
      late: lateMinutes,
      early: earlyMinutes
    };
  };

  // Transform data giống như tab "Bảng công chi tiết" - group records theo date và employeeCode
  const processDetailData = () => {
    if (!attendanceData || attendanceData.length === 0) {
      setProcessedData([]);
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

    // Group records by date and employeeCode (service đã transform thành records riêng biệt)
    const groupedData = {};
    filteredData.forEach(item => {
      const date = item.date || item.workDate;
      const employeeCode = item.employeeCode || item.employeeID || item.id;
      const key = `${date}_${employeeCode}`;
      
      if (!groupedData[key]) {
        groupedData[key] = {
          date: date,
          workDate: date,
          employeeCode: employeeCode,
          employeeName: item.employeeName || '-',
          shiftName: item.shiftName || '-',
          workShiftID: item.workShiftID || null,
          checkInTime: null,
          checkOutTime: null,
          checkInTimeStr: null,
          checkOutTimeStr: null
        };
      }
      
      // Xác định checkIn hoặc checkOut dựa trên type
      const scanTime = item.scanTime ? new Date(item.scanTime) : null;
      if (scanTime && !isNaN(scanTime.getTime())) {
        const timeStr = scanTime.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
        
        if (item.type === 'ĐiLam' || item.type === 'Đi trễ') {
          // Check-in
          if (!groupedData[key].checkInTime || scanTime < new Date(groupedData[key].checkInTime)) {
            groupedData[key].checkInTime = scanTime.toISOString();
            groupedData[key].checkInTimeStr = timeStr;
          }
        } else if (item.type === 'Về' || item.type === 'Về sớm') {
          // Check-out
          if (!groupedData[key].checkOutTime || scanTime > new Date(groupedData[key].checkOutTime)) {
            groupedData[key].checkOutTime = scanTime.toISOString();
            groupedData[key].checkOutTimeStr = timeStr;
          }
        }
      }
    });

    // Chỉ giữ lại những records có cả checkIn và checkOut
    const transformed = [];
    let sttCounter = 1;

    Object.values(groupedData).forEach(item => {
      if (item.checkInTime && item.checkOutTime) {
        // Tính toán giờ công, ngày công, đi trễ, về sớm
        const calculated = calculateWorkDetails({
          checkInTime: item.checkInTimeStr,
          checkOutTime: item.checkOutTimeStr,
          workDate: item.workDate,
          workShiftID: item.workShiftID
        });
        
        transformed.push({
          stt: sttCounter++,
          id: item.employeeCode || '-',
          name: item.employeeName || '-',
          shift: item.shiftName || '-',
          workShiftID: item.workShiftID,
          date: formatDate(item.date),
          workDate: item.workDate,
          checkInTime: item.checkInTimeStr,
          checkOutTime: item.checkOutTimeStr,
          hours: calculated.hours,
          days: calculated.days,
          late: calculated.late,
          early: calculated.early
        });
      }
    });

    setProcessedData(transformed);
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
  const paginatedData = processedData.slice(startIndex, endIndex);
  const totalPages = Math.ceil(processedData.length / itemsPerPage);

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

  // Calculate summary stats
  const totalHours = processedData.reduce((sum, item) => sum + (item.hours || 0), 0);
  const totalDays = processedData.reduce((sum, item) => sum + (item.days || 0), 0);
  const totalLate = processedData.filter(item => item.late > 0).length;
  const totalEarly = processedData.filter(item => item.early > 0).length;

  if (loading) {
    return (
      <View style={styles.container}>
        <CustomHeader title="Bảng công chi tiết" />
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
        <CustomHeader title="Bảng công chi tiết" />
        <View style={styles.errorContainer}>
          <Icon name="alert-circle" size={64} color="#e53935" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={loadData}>
            <Icon name="refresh" size={20} color="#fff" style={{ marginRight: 8 }} />
            <Text style={styles.retryButtonText}>Thử lại</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CustomHeader title="Bảng công chi tiết" />
        
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
        {/* Summary Stats Card */}
        {processedData.length > 0 && (
          <View style={styles.statsCard}>
            <View style={styles.statItem}>
              <View style={[styles.statIcon, { backgroundColor: '#e3f2fd' }]}>
                <Icon name="clock-outline" size={24} color="#3498db" />
              </View>
              <View style={styles.statContent}>
                <Text style={styles.statValue}>{totalHours.toFixed(1)}h</Text>
                <Text style={styles.statLabel}>Tổng giờ</Text>
              </View>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <View style={[styles.statIcon, { backgroundColor: '#e3f2fd' }]}>
                <Icon name="calendar-check" size={24} color="#3498db" />
              </View>
              <View style={styles.statContent}>
                <Text style={styles.statValue}>{totalDays.toFixed(1)}</Text>
                <Text style={styles.statLabel}>Tổng ngày</Text>
              </View>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <View style={[styles.statIcon, { backgroundColor: '#fff3cd' }]}>
                <Icon name="clock-alert-outline" size={24} color="#ff9800" />
              </View>
              <View style={styles.statContent}>
                <Text style={styles.statValue}>{totalLate}</Text>
                <Text style={styles.statLabel}>Đi trễ</Text>
              </View>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <View style={[styles.statIcon, { backgroundColor: '#ffebee' }]}>
                <Icon name="clock-fast" size={24} color="#e53935" />
              </View>
              <View style={styles.statContent}>
                <Text style={styles.statValue}>{totalEarly}</Text>
                <Text style={styles.statLabel}>Về sớm</Text>
              </View>
            </View>
          </View>
        )}

        {/* Data Table Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Icon name="table" size={20} color="#3498db" />
            <Text style={styles.cardTitle}>Chi tiết công</Text>
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
                <Text style={[styles.th, styles.thTime]}>Giờ vào</Text>
                <Text style={[styles.th, styles.thTime]}>Giờ ra</Text>
                <Text style={[styles.th, styles.thHours]}>Số giờ</Text>
                <Text style={[styles.th, styles.thDays]}>Số ngày</Text>
                <Text style={[styles.th, styles.thLate]}>Đi trễ</Text>
                <Text style={[styles.th, styles.thEarly]}>Về sớm</Text>
              </View>
              {paginatedData.map((row, idx) => (
              <View key={idx} style={[styles.tableRow, idx % 2 === 0 && styles.tableRowAlt]}>
                  <Text style={[styles.td, styles.tdStt]}>{row.stt}</Text>
                  <Text style={[styles.td, styles.tdId]} numberOfLines={1}>{row.id}</Text>
                  <Text style={[styles.td, styles.tdName]} numberOfLines={1}>{row.name}</Text>
                  <Text style={[styles.td, styles.tdShift]} numberOfLines={1}>{row.shift}</Text>
                  <Text style={[styles.td, styles.tdDate]}>{row.date}</Text>
                  <Text style={[styles.td, styles.tdTime, { color: '#3498db', fontWeight: '600' }]}>
                    {row.checkInTime}
                  </Text>
                  <Text style={[styles.td, styles.tdTime, { color: '#2c3e50', fontWeight: '600' }]}>
                    {row.checkOutTime}
                  </Text>
                  <Text style={[styles.td, styles.tdHours, styles.boldText]}>
                    {row.hours > 0 ? `${row.hours}h` : '0h'}
                  </Text>
                  <Text style={[styles.td, styles.tdDays, styles.boldText]}>
                    {row.days > 0 ? row.days : '0'}
                  </Text>
                  <View style={[styles.td, styles.tdLate]}>
                    {row.late > 0 ? (
                      <View style={styles.statusBadgeWarning}>
                        <Icon name="clock-alert" size={12} color="#ff9800" />
                        <Text style={styles.statusBadgeTextWarning}>{row.late} phút</Text>
                      </View>
                    ) : (
                      <View style={styles.statusBadgeSuccess}>
                        <Icon name="check-circle" size={12} color="#3498db" />
                        <Text style={styles.statusBadgeTextSuccess}>Đúng giờ</Text>
                      </View>
                    )}
                  </View>
                  <View style={[styles.td, styles.tdEarly]}>
                    {row.early > 0 ? (
                      <View style={styles.statusBadgeDanger}>
                        <Icon name="clock-fast" size={12} color="#e53935" />
                        <Text style={styles.statusBadgeTextDanger}>{row.early} phút</Text>
                      </View>
                    ) : (
                      <View style={styles.statusBadgeSuccess}>
                        <Icon name="check-circle" size={12} color="#3498db" />
                        <Text style={styles.statusBadgeTextSuccess}>Đúng giờ</Text>
                      </View>
                    )}
                  </View>
              </View>
            ))}
              {paginatedData.length === 0 && (
              <View style={styles.emptyContainer}>
                  <Icon name="information-outline" size={48} color="#999" />
                  <Text style={styles.emptyText}>Không có dữ liệu bảng công chi tiết</Text>
              </View>
            )}
          </View>
          </ScrollView>
        </View>

        {/* Pagination Card */}
        {processedData.length > 0 && (
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={processedData.length}
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
    fontSize: 18,
    fontWeight: '700',
    color: '#2c3e50',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 11,
    color: '#6c757d',
    fontWeight: '500',
  },
  statDivider: {
    width: 1,
    backgroundColor: '#e0e0e0',
    marginHorizontal: 8,
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
    fontSize: 12,
    textAlign: 'center',
  },
  thStt: { width: 50 },
  thId: { width: 80 },
  thName: { width: 140 },
  thShift: { width: 100 },
  thDate: { width: 100 },
  thTime: { width: 90 },
  thHours: { width: 80 },
  thDays: { width: 80 },
  thLate: { width: 110 },
  thEarly: { width: 110 },
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
    fontSize: 12,
    textAlign: 'center',
  },
  tdStt: { width: 50, fontWeight: '600' },
  tdId: { width: 80 },
  tdName: { width: 140, fontWeight: '500' },
  tdShift: { width: 100 },
  tdDate: { width: 100 },
  tdTime: { width: 90 },
  tdHours: { width: 80 },
  tdDays: { width: 80 },
  tdLate: { width: 110, alignItems: 'center', justifyContent: 'center' },
  tdEarly: { width: 110, alignItems: 'center', justifyContent: 'center' },
  boldText: {
    fontWeight: '700',
  },
  statusBadgeSuccess: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e3f2fd',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  statusBadgeWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff3cd',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  statusBadgeDanger: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffebee',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  statusBadgeTextSuccess: {
    color: '#3498db',
    fontSize: 10,
    fontWeight: '700',
  },
  statusBadgeTextWarning: {
    color: '#ff9800',
    fontSize: 10,
    fontWeight: '700',
  },
  statusBadgeTextDanger: {
    color: '#e53935',
    fontSize: 10,
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
