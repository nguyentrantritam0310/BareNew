import React, { useEffect, useState, useMemo } from 'react';
import { ActivityIndicator, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useOvertimeRequest } from '../../composables/useOvertimeRequest';
import CustomHeader from '../../components/CustomHeader';
import { useAuth } from '../../contexts/AuthContext';
import { useEmployee } from '../../composables/useEmployee';

export default function AttendanceOvertime() {
  const { overtimeRequests, loading, error, fetchOvertimeRequests } = useOvertimeRequest();
  const { user } = useAuth();
  const { employees, fetchAllEmployees } = useEmployee();
  
  // State cho tháng/năm
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedDay, setSelectedDay] = useState(null);
  const [dayOvertimeData, setDayOvertimeData] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState(null);

  useEffect(() => {
    loadOvertimeData();
    fetchAllEmployees();
  }, [month, year]);

  const loadOvertimeData = async () => {
    await fetchOvertimeRequests();
  };

  // Kiểm tra trạng thái đã duyệt
  const isOvertimeApproved = (status) => {
    return status === 'Đã duyệt' || 
           status === 'Approved' || 
           status === 2 ||
           status === '2';
  };

  // Lấy loại tăng ca - sử dụng logic giống tab "Bảng công tăng ca cá nhân"
  const getOvertimeType = (request) => {
    // Sử dụng overtimeFormName và overtimeFormID thay vì overtimeTypeName
    if (request.overtimeFormName?.toLowerCase().includes('tính lương') || request.overtimeFormID === 1) {
      return 'paid';  // Tăng ca tính lương - màu tím
    } else if (request.overtimeFormName?.toLowerCase().includes('nghỉ bù') || request.overtimeFormID === 2) {
      return 'compensatory';  // Tăng ca nghỉ bù - màu xanh lá
    } else {
      // Nếu không xác định được, mặc định là tính lương
      return 'paid';
    }
  };

  // Format ngày để so sánh
  const formatDateForComparison = (date) => {
    const d = new Date(date);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  // Lọc overtime requests theo tháng/năm và chỉ lấy của user hiện tại
  const filteredOvertimeRequests = useMemo(() => {
    if (!overtimeRequests || overtimeRequests.length === 0) return [];
    
    return overtimeRequests.filter(request => {
      // Chỉ lấy request đã được duyệt
      if (!isOvertimeApproved(request.approveStatus)) return false;
      
      // Lọc theo user hiện tại
      const requestEmployeeId = String(request.employeeID || '').trim();
      const currentUserId = String(user?.id || '').trim();
      if (requestEmployeeId !== currentUserId) return false;
      
      // Lọc theo tháng/năm
      const requestDate = new Date(request.startDateTime);
      if (isNaN(requestDate.getTime())) return false;
      
      const requestYear = requestDate.getFullYear();
      const requestMonth = requestDate.getMonth() + 1;
      
      return requestYear === year && requestMonth === month;
    });
  }, [overtimeRequests, month, year, user]);

  // Tạo dữ liệu calendar - sử dụng structure giống personalOvertimeData (weeks structure)
  const calendarData = useMemo(() => {
    const daysInMonth = new Date(year, month, 0).getDate();
    
    // Group overtime by date
    const overtimeByDate = {};
    filteredOvertimeRequests.forEach(request => {
      const requestDate = new Date(request.startDateTime);
      const dateKey = formatDateForComparison(requestDate);
      
      if (!overtimeByDate[dateKey]) {
        overtimeByDate[dateKey] = [];
      }
      overtimeByDate[dateKey].push(request);
    });
    
    // Create calendar structure - weeks as rows, days as columns
    const weeks = [];
    const firstDayOfMonth = new Date(year, month - 1, 1);
    const lastDayOfMonth = new Date(year, month - 1, daysInMonth);
    
    // Find the first Sunday of the calendar (might be in previous month)
    const firstSunday = new Date(firstDayOfMonth);
    firstSunday.setDate(firstDayOfMonth.getDate() - firstDayOfMonth.getDay());
    
    // Generate weeks
    let currentDate = new Date(firstSunday);
    while (currentDate <= lastDayOfMonth || currentDate.getDay() !== 0) {
      const week = [];
      
      // Generate 7 days for this week
      for (let dayOfWeek = 0; dayOfWeek < 7; dayOfWeek++) {
        const cellDate = new Date(currentDate);
        const day = cellDate.getDate();
        const cellMonth = cellDate.getMonth();
        const cellYear = cellDate.getFullYear();
        
        // Only show days that belong to the selected month
        const isCurrentMonth = cellMonth === month - 1 && cellYear === year;
        
        const dayData = {
          day: isCurrentMonth ? day : '',
          date: isCurrentMonth ? `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}` : '',
          fullDate: isCurrentMonth ? cellDate : null,
          isCurrentMonth: isCurrentMonth,
          dayOfWeek: dayOfWeek,
          overtime: null
        };
        
        // Add overtime data if it's a day in current month
        if (isCurrentMonth) {
          const dateKey = formatDateForComparison(cellDate);
          
          if (overtimeByDate[dateKey]) {
            const dayOvertime = overtimeByDate[dateKey];
            const approvedOvertime = dayOvertime.filter(ot => 
              isOvertimeApproved(ot.approveStatus)
            );
            
            if (approvedOvertime.length > 0) {
              const totalHours = approvedOvertime.reduce((total, ot) => {
                const startTime = new Date(ot.startDateTime);
                const endTime = new Date(ot.endDateTime);
                const hours = (endTime - startTime) / (1000 * 60 * 60);
                return total + hours;
              }, 0);
              
              // Phân loại theo hình thức tăng ca - sử dụng cùng logic với tab "Bảng công tăng ca"
              const firstRequest = approvedOvertime[0];
              let statusClass = 'paid'; // Mặc định là tính lương nếu không xác định được
              
              if (firstRequest.overtimeFormName?.toLowerCase().includes('tính lương') || firstRequest.overtimeFormID === 1) {
                statusClass = 'paid';  // Tăng ca tính lương - màu tím
              } else if (firstRequest.overtimeFormName?.toLowerCase().includes('nghỉ bù') || firstRequest.overtimeFormID === 2) {
                statusClass = 'compensatory';  // Tăng ca nghỉ bù - màu xanh lá
              }
              
              dayData.overtime = {
                status: statusClass,
                time: `${totalHours.toFixed(1)}h`,
                type: approvedOvertime[0].overtimeTypeName || approvedOvertime[0].overtimeFormName || '',
                class: statusClass,
                requests: approvedOvertime
              };
            } else {
              dayData.overtime = {
                status: '',
                time: '',
                type: '',
                class: 'empty'
              };
            }
          } else {
            dayData.overtime = {
              status: '',
              time: '',
              type: '',
              class: 'empty'
            };
          }
        }
        
        week.push(dayData);
        currentDate.setDate(currentDate.getDate() + 1);
      }
      
      weeks.push(week);
      
      // Break if we've passed the last day of the month and it's Sunday
      if (currentDate > lastDayOfMonth && currentDate.getDay() === 0) {
        break;
      }
    }
    
    return weeks;
  }, [filteredOvertimeRequests, year, month]);

  const handleDayPress = (dayData) => {
    if (!dayData || !dayData.isCurrentMonth || !dayData.day) return;
    if (!dayData.overtime || !dayData.overtime.requests || dayData.overtime.requests.length === 0) return;
    if (!user) return;
    
    setSelectedDay(dayData);
    setDayOvertimeData(dayData.overtime.requests || []);
    
    // Find employee info
    const employee = employees.find(emp => String(emp.id) === String(user.id)) || user;
    setSelectedEmployee({
      ...employee,
      name: employee.employeeName || employee.name || `${employee.firstName || ''} ${employee.lastName || ''}`.trim() || 'N/A',
      position: employee.roleName || employee.position || employee.title || 'Chưa có',
    });
    
    setModalVisible(true);
  };

  const adjustMonth = (direction) => {
    if (direction === 'prev') {
      if (month === 1) {
        setMonth(12);
        setYear(year - 1);
      } else {
        setMonth(month - 1);
      }
    } else {
      if (month === 12) {
        setMonth(1);
        setYear(year + 1);
      } else {
        setMonth(month + 1);
      }
    }
  };

  const handlePreviousMonth = () => adjustMonth('prev');
  const handleNextMonth = () => adjustMonth('next');
  
  const goToCurrentMonth = () => {
    const now = new Date();
    setMonth(now.getMonth() + 1);
    setYear(now.getFullYear());
  };

  const getOvertimeTypeColor = (type) => {
    switch (type) {
      case 'compensatory':
        return { bg: '#d4edda', color: '#155724', border: '#28a745' };
      case 'paid':
        return { bg: '#e3f2fd', color: '#1976d2', border: '#3498db' };
      default:
        return { bg: '#e0e0e0', color: '#6c757d', border: '#9e9e9e' };
    }
  };

  const getOvertimeTypeLabel = (type) => {
    switch (type) {
      case 'compensatory':
        return 'Nghỉ bù';
      case 'paid':
        return 'Tính lương';
      default:
        return 'Tăng ca';
    }
  };

  const formatTime = (dateString) => {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return '';
      return date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
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

  // Tính tổng hợp tăng ca - sử dụng logic từ personalOvertimeStatistics
  const calculateSummary = () => {
    const allDays = calendarData.flat().filter(d => d.isCurrentMonth && d.overtime && d.overtime.requests);
    
    let totalOvertimeHours = 0;
    let totalOvertimeHoursWithCoeff = 0;
    let totalCompensatoryDays = 0;
    let totalPaidDays = 0;
    
    allDays.forEach(dayData => {
      if (dayData.overtime && dayData.overtime.requests) {
        // Đếm số ngày theo loại
        if (dayData.overtime.class === 'compensatory') {
          totalCompensatoryDays += 1;
        } else if (dayData.overtime.class === 'paid') {
          totalPaidDays += 1;
        }
        
        // Tính tổng giờ tăng ca
        dayData.overtime.requests.forEach(ot => {
          const startTime = new Date(ot.startDateTime);
          const endTime = new Date(ot.endDateTime);
          const hours = (endTime - startTime) / (1000 * 60 * 60);
          const coefficient = ot.coefficient || 1;
          
          totalOvertimeHours += hours;
          totalOvertimeHoursWithCoeff += hours * coefficient;
        });
      }
    });
    
    // Tổng ngày tăng ca = tổng giờ tăng ca / 8 (không tính hệ số)
    const totalOvertimeDays = Math.round((totalOvertimeHours / 8) * 100) / 100;
    
    // Tổng ngày tăng ca có hệ số = tổng giờ tăng ca có hệ số / 8
    const totalOvertimeDaysWithCoeff = Math.round((totalOvertimeHoursWithCoeff / 8) * 100) / 100;
    
    const uniqueDays = allDays.length;

    return [
      { label: 'Tổng giờ tăng ca', value: `${Math.round(totalOvertimeHours * 10) / 10}h` },
      { label: 'Tổng giờ có hệ số', value: `${Math.round(totalOvertimeHoursWithCoeff * 10) / 10}h` },
      { label: 'Tổng ngày tăng ca', value: totalOvertimeDays.toFixed(2) },
      { label: 'Tổng ngày có hệ số', value: totalOvertimeDaysWithCoeff.toFixed(2) },
      { label: 'Số ngày có tăng ca', value: uniqueDays.toString() },
      { label: 'Số đơn đã duyệt', value: filteredOvertimeRequests.length.toString() },
    ];
  };

  const summaryData = calculateSummary();

  if (loading) {
    return (
      <View style={styles.container}>
        <CustomHeader title="Tăng ca" />
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
        <CustomHeader title="Tăng ca" />
        <View style={styles.errorContainer}>
          <Icon name="alert-circle" size={64} color="#e53935" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={loadOvertimeData}>
            <Text style={styles.retryButtonText}>Thử lại</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const weekdays = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

  return (
    <View style={styles.container}>
      <CustomHeader title="Tăng ca" />
        
        <ScrollView>
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
                Tháng {month < 10 ? `0${month}` : month}/{year}
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
          
          {/* Calendar grid */}
          <View style={styles.calendarWrap}>
            <Text style={styles.calendarTitle}>Bảng tăng ca tháng {month}/{year}</Text>
            {/* Dòng thứ */}
            <View style={styles.weekdaysRow}>
              {weekdays.map((d, i) => (
                <Text key={i} style={[styles.weekday, i === 6 && { color: '#e53935' }]}>{d}</Text>
              ))}
            </View>
            {/* Render lịch theo từng tuần */}
            <View style={styles.calendarGrid}>
              {calendarData.map((week, weekIdx) => (
                <View key={weekIdx} style={styles.calendarRow}>
                  {week.map((dayData, idx) => {
                    if (!dayData.isCurrentMonth) {
                      return <View key={idx} style={styles.dayBox} />;
                    }
                    
                    const colors = dayData.overtime && dayData.overtime.class !== 'empty'
                      ? getOvertimeTypeColor(dayData.overtime.class)
                      : { bg: '#f5f5f5', color: '#bdbdbd', border: '#bdbdbd' };
                    
                    const label = dayData.overtime && dayData.overtime.time
                      ? dayData.overtime.time
                      : '';
                    
                    return (
                      <TouchableOpacity
                        key={idx}
                        style={[
                          styles.dayBox, 
                          { 
                            backgroundColor: colors.bg, 
                            borderColor: colors.border 
                          }
                        ]}
                        activeOpacity={0.7}
                        onPress={() => handleDayPress(dayData)}
                        disabled={!dayData.overtime || !dayData.overtime.requests || dayData.overtime.requests.length === 0}
                      >
                        <Text style={[styles.dayNum, { color: colors.color }]}>{dayData.day}</Text>
                        {label && (
                          <Text style={[styles.dayLabel, { color: colors.color }]} numberOfLines={1}>
                            {label}
                          </Text>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ))}
            </View>
            {/* Chú thích màu */}
            <View style={styles.legendContainer}>
              <Text style={styles.legendTitle}>Chú thích</Text>
              <View style={styles.legendRow}>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: '#28a745', borderColor: '#28a745' }]} />
                  <Text style={styles.legendLabel}>Nghỉ bù</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: '#3498db', borderColor: '#3498db' }]} />
                  <Text style={styles.legendLabel}>Tính lương</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: '#bdbdbd', borderColor: '#bdbdbd' }]} />
                  <Text style={styles.legendLabel}>Không tăng ca</Text>
                </View>
              </View>
            </View>
          </View>
          
          {/* Summary grid */}
          <View style={styles.summaryGrid}>
            {summaryData.map((item, idx) => (
              <View key={idx} style={styles.summaryBox}>
                <Text style={styles.summaryValue}>{item.value}</Text>
                <Text style={styles.summaryLabel}>{item.label}</Text>
              </View>
            ))}
          </View>
          
          {/* Detail Modal */}
          <Modal
            visible={modalVisible}
            animationType="slide"
            transparent
            onRequestClose={() => setModalVisible(false)}
          >
            <View style={styles.modalOverlay}>
              <View style={styles.modalContent}>
                <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setModalVisible(false)}>
                  <Icon name="close" size={28} color="#3498db" />
                </TouchableOpacity>
                {selectedDay && (
                  <>
                    {/* Employee Header */}
                    <View style={styles.modalEmpHeader}>
                      <View style={styles.modalEmpAvatarWrapper}>
                        <View style={styles.modalEmpAvatar}>
                          <Icon name="account-circle" size={40} color="#3498db" />
                        </View>
                      </View>
                      <View style={styles.modalEmpInfo}>
                        <Text style={styles.empName}>
                          {selectedEmployee?.name || (user?.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : 'N/A')}
                        </Text>
                        <View style={styles.empDetailsRow}>
                          <Text style={styles.detailText}>
                            <Text style={styles.detailLabel}>Mã: </Text>
                            <Text style={styles.detailValue}>{selectedEmployee?.id || user?.id || 'N/A'}</Text>
                          </Text>
                          <Text style={styles.detailSeparator}> • </Text>
                          <Text style={styles.detailText}>
                            <Text style={styles.detailLabel}>Chức vụ: </Text>
                            <Text style={styles.detailValue}>{selectedEmployee?.position || 'Chưa có'}</Text>
                          </Text>
                        </View>
                      </View>
                      <View style={styles.modalEmpDate}>
                        <View style={styles.dateBadge}>
                          <Icon name="calendar-today" size={16} color="#3498db" />
                          <Text style={styles.dateValue}>{selectedDay.day}/{month}/{year}</Text>
                        </View>
                      </View>
                    </View>

                    {/* Day Statistics - Compact */}
                    {dayOvertimeData.length > 0 && (
                      <View style={styles.modalSection}>
                        <View style={styles.sectionTitleRow}>
                          <View style={styles.sectionIconWrapper}>
                            <Icon name="clock" size={18} color="#3498db" />
                          </View>
                          <Text style={styles.modalSectionTitle}>Chi tiết tăng ca</Text>
                        </View>
                        <View style={styles.modalStatsGridCompact}>
                          <View style={styles.modalStatCardCompact}>
                            <Icon name="clock-outline" size={20} color="#3498db" />
                            <View style={styles.modalStatContentCompact}>
                              <Text style={styles.modalStatValueCompact}>
                                {dayOvertimeData.reduce((total, item) => {
                                  const startTime = new Date(item.startDateTime);
                                  const endTime = new Date(item.endDateTime);
                                  const hours = Math.max(0, (endTime - startTime) / (1000 * 60 * 60));
                                  return total + hours;
                                }, 0).toFixed(1)}h
                              </Text>
                              <Text style={styles.modalStatLabelCompact}>Giờ tăng ca</Text>
                            </View>
                          </View>
                          <View style={styles.modalStatCardCompact}>
                            <Icon name="calendar-day" size={20} color="#3498db" />
                            <View style={styles.modalStatContentCompact}>
                              <Text style={styles.modalStatValueCompact}>
                                {Math.round((dayOvertimeData.reduce((total, item) => {
                                  const startTime = new Date(item.startDateTime);
                                  const endTime = new Date(item.endDateTime);
                                  const hours = Math.max(0, (endTime - startTime) / (1000 * 60 * 60));
                                  return total + hours;
                                }, 0) / 8) * 100) / 100}
                              </Text>
                              <Text style={styles.modalStatLabelCompact}>Ngày tăng ca</Text>
                            </View>
                          </View>
                          <View style={styles.modalStatCardCompact}>
                            <Icon name="calculator" size={20} color="#3498db" />
                            <View style={styles.modalStatContentCompact}>
                              <Text style={styles.modalStatValueCompact}>
                                {dayOvertimeData.reduce((total, item) => {
                                  const startTime = new Date(item.startDateTime);
                                  const endTime = new Date(item.endDateTime);
                                  const hours = Math.max(0, (endTime - startTime) / (1000 * 60 * 60));
                                  const coefficient = item.coefficient || 1;
                                  return total + (hours * coefficient);
                                }, 0).toFixed(1)}h
                              </Text>
                              <Text style={styles.modalStatLabelCompact}>Giờ có hệ số</Text>
                            </View>
                          </View>
                          {dayOvertimeData[0]?.coefficient && (
                            <View style={styles.modalStatCardCompact}>
                              <Icon name="percent" size={20} color="#3498db" />
                              <View style={styles.modalStatContentCompact}>
                                <Text style={styles.modalStatValueCompact}>{dayOvertimeData[0].coefficient}</Text>
                                <Text style={styles.modalStatLabelCompact}>Hệ số</Text>
                              </View>
                            </View>
                          )}
                        </View>
                      </View>
                    )}
                  </>
                )}
              </View>
            </View>
          </Modal>
        </ScrollView>
      </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f6f8fa' },
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
  legendContainer: {
    marginTop: 20,
    paddingTop: 16,
    paddingBottom: 12,
    borderTopWidth: 1.5,
    borderTopColor: '#e8f4f8',
    backgroundColor: '#f8fafb',
    borderRadius: 12,
    paddingHorizontal: 16,
    marginHorizontal: -4,
  },
  legendTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#2c3e50',
    marginBottom: 14,
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  legendRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    flexWrap: 'wrap',
    paddingHorizontal: 4,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    paddingHorizontal: 4,
    width: '48%',
  },
  legendDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    marginRight: 10,
    borderWidth: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  legendLabel: {
    fontSize: 12,
    color: '#2c3e50',
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  weekdaysRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
    marginHorizontal: 2,
  },
  weekday: {
    flex: 1,
    textAlign: 'center',
    color: '#888',
    fontWeight: 'bold',
    fontSize: 13,
    paddingBottom: 2,
  },
  calendarWrap: {
    backgroundColor: '#fff',
    borderRadius: 16,
    margin: 16,
    marginBottom: 8,
    padding: 12,
    shadowColor: '#3498db',
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  calendarTitle: {
    fontWeight: 'bold',
    color: '#3498db',
    fontSize: 22,
    marginBottom: 12,
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  calendarGrid: {
    flexDirection: 'column',
    gap: 0,
    marginHorizontal: 2,
  },
  calendarRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 0,
  },
  dayBox: {
    width: '12%',
    aspectRatio: 0.8,
    borderRadius: 10,
    marginBottom: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    position: 'relative',
    paddingTop: 4,
    minWidth: 38,
    maxWidth: 48,
  },
  modalSection: {
    marginBottom: 18,
  },
  modalSectionTitle: {
    fontWeight: 'bold',
    color: '#3498db',
    fontSize: 15,
    marginBottom: 8,
    marginTop: 2,
  },
  modalCard: {
    backgroundColor: '#f8fafd',
    borderRadius: 12,
    padding: 10,
    marginBottom: 10,
    shadowColor: '#3498db',
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  modalCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  modalTypeBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCardImg: {
    width: 38,
    height: 38,
    borderRadius: 8,
    marginRight: 10,
    backgroundColor: '#eee',
  },
  modalCardName: {
    fontWeight: 'bold',
    fontSize: 15,
    color: '#222',
    marginBottom: 2,
  },
  modalCardSub: {
    color: '#666',
    fontSize: 13,
    marginBottom: 1,
  },
  dayNum: {
    fontWeight: 'bold',
    fontSize: 15,
    marginBottom: 2,
  },
  dayLabel: {
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 14,
    minHeight: 28,
    fontWeight: '500',
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    padding: 12,
    gap: 12,
  },
  summaryBox: {
    width: '30%',
    backgroundColor: '#fff',
    borderRadius: 14,
    marginBottom: 12,
    alignItems: 'center',
    paddingVertical: 18,
    paddingHorizontal: 6,
    shadowColor: '#3498db',
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#f3e5f5',
  },
  summaryValue: {
    fontWeight: 'bold',
    color: '#3498db',
    fontSize: 18,
    marginBottom: 2,
  },
  summaryLabel: {
    color: '#888',
    fontSize: 13,
    textAlign: 'center',
    fontWeight: '500',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '98%',
    maxHeight: '95%',
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 10,
  },
  modalCloseBtn: {
    position: 'absolute',
    top: 12,
    right: 12,
    padding: 8,
    zIndex: 1,
    backgroundColor: '#f0f7ff',
    borderRadius: 20,
  },
  modalTitle: {
    fontWeight: 'bold',
    color: '#3498db',
    fontSize: 18,
    marginBottom: 12,
    textAlign: 'center',
  },
  modalEmpHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 40,
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1.5,
    borderBottomColor: '#e8f4f8',
  },
  modalEmpAvatarWrapper: {
    marginRight: 10,
  },
  modalEmpAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#f0f7ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalEmpInfo: {
    flex: 1,
    marginRight: 8,
  },
  empName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#2c3e50',
    marginBottom: 6,
  },
  empDetailsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  detailText: {
    fontSize: 12,
    color: '#666',
  },
  detailLabel: {
    fontSize: 12,
    color: '#666',
  },
  detailValue: {
    fontSize: 12,
    color: '#2c3e50',
    fontWeight: '600',
  },
  detailSeparator: {
    fontSize: 12,
    color: '#bdbdbd',
    marginHorizontal: 4,
  },
  modalEmpDate: {
    marginLeft: 'auto',
  },
  dateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f7ff',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  dateValue: {
    marginLeft: 6,
    fontSize: 13,
    fontWeight: '600',
    color: '#3498db',
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionIconWrapper: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#e3f2fd',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  modalStatsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
  },
  modalStatsGridCompact: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  modalStatCard: {
    width: '48%',
    backgroundColor: '#f8fafd',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  modalStatCardCompact: {
    flex: 1,
    minWidth: '45%',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafd',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    gap: 10,
  },
  modalStatCardFull: {
    width: '100%',
  },
  modalStatValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#3498db',
    marginTop: 8,
    marginBottom: 4,
  },
  modalStatValueCompact: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#3498db',
  },
  modalStatContentCompact: {
    flex: 1,
  },
  modalStatLabel: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
  modalStatLabelCompact: {
    fontSize: 11,
    color: '#666',
    marginTop: 2,
  },
  modalCardList: {
    gap: 12,
  },
  modalDataCard: {
    backgroundColor: '#f8fafd',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  modalDataCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  modalDataCardBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  modalDataCardShift: {
    fontWeight: 'bold',
    fontSize: 15,
    color: '#222',
    flex: 1,
  },
  modalDataCardBody: {
    marginLeft: 42,
  },
  modalDataCardInfoRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 6,
  },
  modalDataCardInfoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
    marginBottom: 4,
  },
  modalDataCardInfoText: {
    fontSize: 13,
    color: '#666',
    marginLeft: 6,
  },
  modalEmptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  modalEmptyText: {
    fontSize: 14,
    color: '#999',
    marginTop: 12,
  },
});
