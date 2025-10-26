import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useAttendanceData } from '../../composables/useAttendanceData';
import CustomHeader from '../../components/CustomHeader';

const fakeSummary = [
  { label: 'Mã chấm công', value: '123456' },
  { label: 'Ngày vào làm', value: '29/05/2025' },
  { label: 'Tổng ngày công chuẩn', value: '23.5' },
  { label: 'Ngày thường', value: '2' },
  { label: 'Thứ 7, Chủ Nhật', value: '1' },
  { label: 'Ngày lễ', value: '0' },
  { label: 'Ngày Tết', value: '0' },
  { label: 'Nghỉ không lương', value: '0' },
  { label: 'Phép năm', value: '0' },
  { label: 'Công tác', value: '0' },
  { label: 'Nghỉ Lễ', value: '0' },
  { label: 'Tổng ngày công', value: '7.42' },
  { label: 'Ngày đi làm', value: '7.42' },
  { label: 'Vắng không lý do', value: '0.5' },
  { label: 'Tổng giờ công', value: '19.37' },
  { label: 'Tổng ngày tăng ca nghỉ bù (ngày)', value: '0' },
  { label: 'Số phút đi trễ', value: '0' },
  { label: 'Số phút về sớm', value: '0' },
  { label: 'Số lần đi trễ', value: '0' },
  { label: 'Số lần về sớm', value: '0' },
];

export default function AttendanceSummary() {
  const { attendanceData, loading, error, fetchAttendanceData } = useAttendanceData();
  
  // State cho tháng/năm
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedDay, setSelectedDay] = useState(null);
  const [dayDetailData, setDayDetailData] = useState([]);
  const [dayDetailLoading, setDayDetailLoading] = useState(false);

  useEffect(() => {
    loadAttendanceData();
  }, [month, year]);

  const loadAttendanceData = async () => {
    await fetchAttendanceData({
      year: year,
      month: month
    });
  };

  // Tìm thứ đầu tháng (0=CN, 1=T2...)
  const firstDay = new Date(year, month - 1, 1).getDay();
  // Số ngày trong tháng
  const daysInMonth = new Date(year, month, 0).getDate();
  
  // Tạo mảng ngày, chèn ô trống đầu tháng để căn thẳng thứ
  const calendarData = [];
  for (let i = 0; i < (firstDay === 0 ? 6 : firstDay - 1); i++) {
    calendarData.push(null);
  }
  
  for (let i = 1; i <= daysInMonth; i++) {
    const currentDate = new Date(year, month - 1, i);
    const dateString = currentDate.toISOString().split('T')[0];
    
    // Tìm dữ liệu chấm công cho ngày này
    const dayData = attendanceData.filter(item => {
      if (!item.date) return false;
      try {
        const itemDate = new Date(item.date);
        if (isNaN(itemDate.getTime())) return false;
        const itemDateString = itemDate.toISOString().split('T')[0];
        return itemDateString === dateString;
      } catch (error) {
        console.error('Error processing attendance data:', error);
        return false;
      }
    });

    if (dayData.length === 0) {
      // Không có dữ liệu chấm công
      calendarData.push({ day: i, status: 'absent' });
    } else {
      // Có dữ liệu chấm công
      const checkIn = dayData.find(item => item.type === 'ĐiLam' || item.type === 'Đi trễ');
      const checkOut = dayData.find(item => item.type === 'Về' || item.type === 'Về sớm');
      
      if (checkIn && checkOut) {
        calendarData.push({ 
          day: i, 
          status: 'present', 
          checkin: formatTime(checkIn.scanTime), 
          checkout: formatTime(checkOut.scanTime),
          data: dayData
        });
      } else if (checkIn) {
        calendarData.push({ 
          day: i, 
          status: 'miss_checkout', 
          checkin: formatTime(checkIn.scanTime),
          data: dayData
        });
      } else if (checkOut) {
        calendarData.push({ 
          day: i, 
          status: 'miss_checkin', 
          checkout: formatTime(checkOut.scanTime),
          data: dayData
        });
      } else {
        calendarData.push({ day: i, status: 'absent' });
      }
    }
  }

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

  const handleDayPress = async (item) => {
    setSelectedDay(item);
    setModalVisible(true);
    
    if (item.data) {
      setDayDetailData(item.data);
    } else {
      setDayDetailData([]);
    }
  };

  const handlePreviousMonth = () => {
    if (month === 1) {
      setMonth(12);
      setYear(year - 1);
    } else {
      setMonth(month - 1);
    }
  };

  const handleNextMonth = () => {
    if (month === 12) {
      setMonth(1);
      setYear(year + 1);
    } else {
      setMonth(month + 1);
    }
  };

  // Tính toán summary data từ attendanceData
  const calculateSummary = () => {
    if (!attendanceData || attendanceData.length === 0) {
      return [
        { label: 'Tổng ngày công', value: '0' },
        { label: 'Ngày đi làm', value: '0' },
        { label: 'Vắng không lý do', value: '0' },
        { label: 'Tổng giờ công', value: '0' },
        { label: 'Số phút đi trễ', value: '0' },
        { label: 'Số phút về sớm', value: '0' },
        { label: 'Số lần đi trễ', value: '0' },
        { label: 'Số lần về sớm', value: '0' },
      ];
    }

    const uniqueDays = new Set();
    let totalWorkHours = 0;
    let lateMinutes = 0;
    let earlyMinutes = 0;
    let lateCount = 0;
    let earlyCount = 0;

    attendanceData.forEach(item => {
      if (!item.date) return;
      try {
        const date = new Date(item.date);
        if (isNaN(date.getTime())) return;
        const dateString = date.toISOString().split('T')[0];
        uniqueDays.add(dateString);
        
        if (item.type === 'Đi trễ') {
          lateCount++;
          // Giả sử giờ chuẩn là 8:00
          const standardTime = new Date(item.date);
          standardTime.setHours(8, 0, 0, 0);
          if (item.scanTime) {
            const scanTime = new Date(item.scanTime);
            if (!isNaN(scanTime.getTime())) {
              const diffMinutes = Math.max(0, (scanTime - standardTime) / (1000 * 60));
              lateMinutes += diffMinutes;
            }
          }
        }
        
        if (item.type === 'Về sớm') {
          earlyCount++;
          // Giả sử giờ chuẩn là 17:00
          const standardTime = new Date(item.date);
          standardTime.setHours(17, 0, 0, 0);
          if (item.scanTime) {
            const scanTime = new Date(item.scanTime);
            if (!isNaN(scanTime.getTime())) {
              const diffMinutes = Math.max(0, (standardTime - scanTime) / (1000 * 60));
              earlyMinutes += diffMinutes;
            }
          }
        }
      } catch (error) {
        console.error('Error processing attendance item:', error);
      }
    });

    const totalDays = uniqueDays.size;
    const workDays = Math.floor(totalDays * 0.8); // Giả sử 80% ngày làm việc
    const absentDays = totalDays - workDays;

    return [
      { label: 'Tổng ngày công', value: totalDays.toString() },
      { label: 'Ngày đi làm', value: workDays.toString() },
      { label: 'Vắng không lý do', value: absentDays.toString() },
      { label: 'Tổng giờ công', value: (totalDays * 8).toFixed(1) },
      { label: 'Số phút đi trễ', value: Math.round(lateMinutes).toString() },
      { label: 'Số phút về sớm', value: Math.round(earlyMinutes).toString() },
      { label: 'Số lần đi trễ', value: lateCount.toString() },
      { label: 'Số lần về sớm', value: earlyCount.toString() },
    ];
  };

  const summaryData = calculateSummary();

  if (loading) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.container}>
          <CustomHeader title="Tổng kết chấm công" />
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
          <CustomHeader title="Tổng kết chấm công" />
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

  // Dòng thứ
  const weekdays = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

  return (
    <View style={styles.container}>
      <CustomHeader title="Tổng kết chấm công" />
        
        <ScrollView>
          {/* Bộ lọc tháng */}
          <View style={styles.monthFilterRow}>
            <TouchableOpacity style={styles.monthBtn} onPress={handlePreviousMonth}>
              <Icon name="chevron-left" size={22} color="#008080" />
            </TouchableOpacity>
            <Text style={styles.monthText}>{month < 10 ? `0${month}` : month}/{year}</Text>
            <TouchableOpacity style={styles.monthBtn} onPress={handleNextMonth}>
              <Icon name="chevron-right" size={22} color="#008080" />
            </TouchableOpacity>
          </View>
          
          {/* Calendar grid */}
          <View style={styles.calendarWrap}>
            <Text style={styles.calendarTitle}>Bảng chấm công tháng {month}/{year}</Text>
            {/* Dòng thứ */}
            <View style={styles.weekdaysRow}>
              {weekdays.map((d, i) => (
                <Text key={i} style={[styles.weekday, i === 6 && { color: '#e53935' }]}>{d}</Text>
              ))}
            </View>
            {/* Render lịch theo từng tuần, mỗi hàng 7 ô */}
            <View style={styles.calendarGrid}>
              {Array.from({ length: Math.ceil(calendarData.length / 7) }).map((_, weekIdx) => (
                <View key={weekIdx} style={styles.calendarRow}>
                  {calendarData.slice(weekIdx * 7, weekIdx * 7 + 7).map((item, idx) => {
                    if (!item) return <View key={idx} style={styles.dayBox} />;
                    let bg = '#e0e0e0', color = '#888', border = 'transparent', label = '';
                    if (item.status === 'present') { bg = '#e8f5e9'; color = '#43a047'; border = '#43a047'; label = `${item.checkin}\n${item.checkout}`; }
                    if (item.status === 'miss_checkout') { bg = '#ffebee'; color = '#e53935'; border = '#e53935'; label = `${item.checkin}\n--`; }
                    if (item.status === 'miss_checkin') { bg = '#ffebee'; color = '#e53935'; border = '#e53935'; label = `--\n${item.checkout}`; }
                    if (item.status === 'leave') { bg = '#e3f2fd'; color = '#1976d2'; border = '#1976d2'; label = 'NP'; }
                    if (item.status === 'absent') { bg = '#f5f5f5'; color = '#bdbdbd'; border = '#bdbdbd'; label = '--'; }
                    return (
                      <TouchableOpacity
                        key={idx}
                        style={[styles.dayBox, { backgroundColor: bg, borderColor: border }]}
                        activeOpacity={0.7}
                        onPress={() => handleDayPress(item)}
                      >
                        <Text style={[styles.dayNum, { color }]}>{item.day}</Text>
                        <Text style={[styles.dayLabel, { color }]}>{label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ))}
            </View>
            {/* Chú thích màu */}
            <View style={styles.legendRow}>
              <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: '#43a047' }]} /><Text style={styles.legendLabel}>Đi làm</Text></View>
              <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: '#e53935' }]} /><Text style={styles.legendLabel}>Quên checkin/out</Text></View>
              <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: '#bdbdbd' }]} /><Text style={styles.legendLabel}>Vắng</Text></View>
              <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: '#1976d2' }]} /><Text style={styles.legendLabel}>Nghỉ phép</Text></View>
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
                  <Icon name="close" size={28} color="#008080" />
                </TouchableOpacity>
                {selectedDay && (
                  <>
                    <Text style={styles.modalTitle}>Chi tiết ngày {selectedDay.day}</Text>
                    <View style={styles.modalSection}>
                      <Text style={styles.modalSectionTitle}>Lịch sử chấm công</Text>
                      {dayDetailData.map((item, idx) => (
                        <View key={idx} style={styles.modalCard}>
                          <View style={styles.modalCardRow}>
                            <Image 
                              source={require('../../../assets/images/checkin.png')} 
                              style={styles.modalCardImg} 
                            />
                            <View style={{ flex: 1 }}>
                              <Text style={styles.modalCardName}>
                                {item.employeeName || 'Nhân viên'} - {item.location || 'N/A'}
                              </Text>
                              <Text style={styles.modalCardSub}>
                                {item.shiftName || 'Ca làm việc'} - 
                                <Text style={{ color: getTypeColor(item.type) }}> {item.type || 'Đi làm'}</Text>
                              </Text>
                              <Text style={styles.modalCardSub}>
                                <Icon name="calendar" size={14} color="#888" /> {formatDate(item.date)} {formatTime(item.scanTime)}
                              </Text>
                              <Text style={styles.modalCardSub}>
                                <Icon name="qrcode-scan" size={14} color="#888" /> Máy quét: {item.refCode || 'N/A'}
                              </Text>
                            </View>
                          </View>
                        </View>
                      ))}
                      {dayDetailData.length === 0 && (
                        <View style={styles.modalCard}>
                          <Text style={styles.modalCardName}>Không có dữ liệu chấm công</Text>
                        </View>
                      )}
                    </View>
                  </>
                )}
              </View>
            </View>
          </Modal>
        </ScrollView>
      </View>
  );

  function getTypeColor(type) {
    switch (type) {
      case 'ĐiLam':
      case 'Về':
        return '#43a047';
      case 'Đi trễ':
      case 'Về sớm':
        return '#e53935';
      default:
        return '#43a047';
    }
  }

  function formatDate(dateString) {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return '';
      return date.toLocaleDateString('vi-VN');
    } catch (error) {
      console.error('Error formatting date:', error);
      return '';
    }
  }
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
  monthFilterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    marginBottom: 2,
  },
  monthBtn: {
    padding: 6,
    borderRadius: 8,
  },
  monthText: {
    fontWeight: 'bold',
    fontSize: 16,
    color: '#008080',
    marginHorizontal: 16,
    letterSpacing: 0.5,
  },
  legendRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 2,
    paddingHorizontal: 2,
    flexWrap: 'wrap',
    gap: 8,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 10,
    marginBottom: 2,
  },
  legendDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    marginRight: 5,
    borderWidth: 1,
    borderColor: '#eee',
  },
  legendLabel: {
    fontSize: 13,
    color: '#555',
    fontWeight: '500',
    marginRight: 2,
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
    shadowColor: '#008080',
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  calendarTitle: {
    fontWeight: 'bold',
    color: '#008080',
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
    color: '#008080',
    fontSize: 15,
    marginBottom: 8,
    marginTop: 2,
  },
  modalCard: {
    backgroundColor: '#f8fafd',
    borderRadius: 12,
    padding: 10,
    marginBottom: 10,
    shadowColor: '#008080',
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  modalCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
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
    fontSize: 12,
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
    shadowColor: '#008080',
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#e0f2f1',
  },
  summaryValue: {
    fontWeight: 'bold',
    color: '#008080',
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
    width: '90%',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#008080',
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  modalCloseBtn: {
    position: 'absolute',
    top: 12,
    right: 12,
    padding: 8,
  },
  modalTitle: {
    fontWeight: 'bold',
    color: '#008080',
    fontSize: 18,
    marginBottom: 12,
    textAlign: 'center',
  },
  modalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  modalLabel: {
    color: '#555',
    fontSize: 14,
    fontWeight: '500',
  },
  modalValue: {
    color: '#008080',
    fontSize: 14,
    fontWeight: '500',
  },
  modalImgRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 12,
  },
  modalImgPlaceholder: {
    width: 64,
    height: 64,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalImg: {
    width: 64,
    height: 64,
    borderRadius: 8,
  },
});
