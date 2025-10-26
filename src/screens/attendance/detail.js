import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useAttendanceData } from '../../composables/useAttendanceData';
import CustomHeader from '../../components/CustomHeader';

const fakeDetail = [
  { day: '3', date: '05/08', inout: '08:38 - 12:47', shift: 'n/a', work: '3.37/0.42', color: '#43a047', color2: '#e53935' },
  { day: '2', date: '04/08', inout: '08:23 - 17:43', shift: 'n/a', work: '8.00/1.00', color: '#43a047', color2: '#e53935' },
  { day: '6', date: '01/08', inout: '08:40 - 17:45', shift: 'n/a', work: '8.00/1.00', color: '#43a047', color2: '#e53935' },
];

export default function AttendanceDetail() {
  const { attendanceData, loading, error, fetchAttendanceData } = useAttendanceData();
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth() + 1);
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());

  useEffect(() => {
    loadAttendanceData();
  }, [currentMonth, currentYear]);

  const loadAttendanceData = async () => {
    await fetchAttendanceData({
      year: currentYear,
      month: currentMonth
    });
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return '';
      return date.toLocaleDateString('vi-VN');
    } catch (error) {
      console.error('Error formatting date:', error);
      return '';
    }
  };

  const formatTime = (dateString) => {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return '';
      return date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    } catch (error) {
      console.error('Error formatting time:', error);
      return '';
    }
  };

  const getDayOfWeek = (dateString) => {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return '';
      const days = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
      return days[date.getDay()];
    } catch (error) {
      console.error('Error getting day of week:', error);
      return '';
    }
  };

  const getTypeColor = (type) => {
    switch (type) {
      case 'ĐiLam':
        return '#43a047';
      case 'Về':
        return '#43a047';
      case 'Đi trễ':
        return '#e53935';
      case 'Về sớm':
        return '#e53935';
      default:
        return '#43a047';
    }
  };

  const handlePreviousMonth = () => {
    if (currentMonth === 1) {
      setCurrentMonth(12);
      setCurrentYear(currentYear - 1);
    } else {
      setCurrentMonth(currentMonth - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 12) {
      setCurrentMonth(1);
      setCurrentYear(currentYear + 1);
    } else {
      setCurrentMonth(currentMonth + 1);
    }
  };

  // Group attendance data by date and calculate work hours
  const processAttendanceData = () => {
    const groupedData = {};
    
    attendanceData.forEach(item => {
      if (!item.date) return;
      try {
        const date = new Date(item.date);
        if (isNaN(date.getTime())) return;
        const dateString = date.toISOString().split('T')[0];
        
        if (!groupedData[dateString]) {
          groupedData[dateString] = {
            date: item.date,
            checkIn: null,
            checkOut: null,
            shiftName: item.shiftName || 'N/A',
            workHours: 0
          };
        }
        
        if (item.type === 'ĐiLam' || item.type === 'Đi trễ') {
          if (item.scanTime) {
            const scanTime = new Date(item.scanTime);
            if (!isNaN(scanTime.getTime())) {
              groupedData[dateString].checkIn = item.scanTime;
            }
          }
        } else if (item.type === 'Về' || item.type === 'Về sớm') {
          if (item.scanTime) {
            const scanTime = new Date(item.scanTime);
            if (!isNaN(scanTime.getTime())) {
              groupedData[dateString].checkOut = item.scanTime;
            }
          }
        }
      } catch (error) {
        console.error('Error processing attendance item:', error);
      }
    });

    // Calculate work hours for each day
    Object.values(groupedData).forEach(day => {
      if (day.checkIn && day.checkOut) {
        try {
          const startTime = new Date(day.checkIn);
          const endTime = new Date(day.checkOut);
          if (!isNaN(startTime.getTime()) && !isNaN(endTime.getTime())) {
            const diffMs = endTime - startTime;
            const diffHours = diffMs / (1000 * 60 * 60);
            day.workHours = Math.max(0, diffHours);
          }
        } catch (error) {
          console.error('Error calculating work hours:', error);
        }
      }
    });

    return Object.values(groupedData).sort((a, b) => {
      try {
        return new Date(b.date) - new Date(a.date);
      } catch (error) {
        console.error('Error sorting dates:', error);
        return 0;
      }
    });
  };

  const processedData = processAttendanceData();

  if (loading) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.container}>
          <CustomHeader title="Chi tiết chấm công" />
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#008080" />
            <Text style={styles.loadingText}>Đang tải dữ liệu...</Text>
          </View>
        </View>
      </>
    );
  }

  if (error) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.container}>
          <CustomHeader title="Chi tiết chấm công" />
          <View style={styles.errorContainer}>
            <Icon name="alert-circle" size={64} color="#e53935" />
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={loadAttendanceData}>
              <Text style={styles.retryButtonText}>Thử lại</Text>
            </TouchableOpacity>
          </View>
        </View>
      </>
    );
  }

  return (
    <View style={styles.container}>
      <CustomHeader title="Chi tiết chấm công" />
        
        {/* Month Navigation */}
        <View style={styles.monthNavigation}>
          <TouchableOpacity style={styles.navButton} onPress={handlePreviousMonth}>
            <Icon name="chevron-left" size={24} color="#008080" />
          </TouchableOpacity>
          <Text style={styles.monthText}>
            {currentMonth < 10 ? `0${currentMonth}` : currentMonth}/{currentYear}
          </Text>
          <TouchableOpacity style={styles.navButton} onPress={handleNextMonth}>
            <Icon name="chevron-right" size={24} color="#008080" />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.card}>
            <View style={styles.tableHeader}>
              <Text style={[styles.th, { flex: 1 }]}>Thứ</Text>
              <Text style={[styles.th, { flex: 2 }]}>Ngày</Text>
              <Text style={[styles.th, { flex: 3 }]}>In/Out</Text>
              <Text style={[styles.th, { flex: 1 }]}>Ca</Text>
              <Text style={[styles.th, { flex: 2 }]}>Giờ công</Text>
            </View>
            {processedData.map((row, idx) => (
              <View key={idx} style={[styles.tableRow, idx % 2 === 0 && styles.tableRowAlt]}>
                <Text style={[styles.td, { flex: 1 }]}>{getDayOfWeek(row.date)}</Text>
                <Text style={[styles.td, { flex: 2 }]}>{formatDate(row.date)}</Text>
                <Text style={[styles.td, { flex: 3 }]}>
                  {row.checkIn ? (
                    <Text style={{ color: getTypeColor('ĐiLam') }}>{formatTime(row.checkIn)}</Text>
                  ) : (
                    <Text style={{ color: '#999' }}>--</Text>
                  )}
                  {' - '}
                  {row.checkOut ? (
                    <Text style={{ color: getTypeColor('Về') }}>{formatTime(row.checkOut)}</Text>
                  ) : (
                    <Text style={{ color: '#999' }}>--</Text>
                  )}
                </Text>
                <Text style={[styles.td, { flex: 1 }]}>{row.shiftName}</Text>
                <Text style={[styles.td, { flex: 2 }]}>{row.workHours.toFixed(1)}</Text>
              </View>
            ))}
            {processedData.length === 0 && (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>Không có dữ liệu chấm công</Text>
              </View>
            )}
          </View>
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
  monthNavigation: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  navButton: {
    padding: 8,
    borderRadius: 8,
  },
  monthText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#008080',
    marginHorizontal: 20,
  },
  scrollContent: { padding: 16 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 0,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
    marginBottom: 16,
    overflow: 'hidden',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#e0f2f1',
    borderBottomWidth: 1,
    borderColor: '#b2dfdb',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  th: {
    color: '#008080',
    fontWeight: 'bold',
    fontSize: 14,
    textAlign: 'center',
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderColor: '#f3f3f3',
    backgroundColor: '#fff',
  },
  tableRowAlt: {
    backgroundColor: '#f6f8fa',
  },
  td: {
    color: '#222',
    fontSize: 14,
    textAlign: 'center',
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
});
