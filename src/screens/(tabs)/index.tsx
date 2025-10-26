import { useNavigation } from '@react-navigation/native';
import React, { useState, useEffect } from 'react';
import { Image, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View, Alert, StatusBar, Dimensions } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
// import { LinearGradient } from 'expo-linear-gradient';
// import { BlurView } from 'expo-blur';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useAuth } from '../../contexts/AuthContext';
import HomeHeader from '../../components/common/HomeHeader';
import api from '../../api';

const { width: screenWidth } = Dimensions.get('window');

const mainIcons = [
  { 
    key: 'profile', 
    label: 'Hồ sơ', 
    icon: 'account-circle-outline', 
    primaryColor: '#3498db',
    secondaryColor: '#2980b9',
    gradient: ['#3498db', '#2980b9'],
    bgGradient: ['#e3f2fd', '#f0f8ff']
  },
  { 
    key: 'attendance', 
    label: 'Bảng công', 
    icon: 'calendar-check-outline', 
    primaryColor: '#2c3e50',
    secondaryColor: '#34495e',
    gradient: ['#2c3e50', '#34495e'],
    bgGradient: ['#ecf0f1', '#f8f9fa']
  },
  { 
    key: 'salary', 
    label: 'Phiếu lương', 
    icon: 'cash-multiple', 
    primaryColor: '#27ae60',
    secondaryColor: '#229954',
    gradient: ['#27ae60', '#229954'],
    bgGradient: ['#e8f5e8', '#f0fdf4']
  },
];

const subIcons = [
  { 
    key: 'leave', 
    label: 'Nghỉ phép', 
    icon: 'beach', 
    primaryColor: '#3498db',
    secondaryColor: '#2980b9',
    gradient: ['#3498db', '#2980b9'],
    bgGradient: ['#e3f2fd', '#f0f8ff']
  },
  { 
    key: 'overtime', 
    label: 'Tăng ca', 
    icon: 'clock-plus-outline', 
    primaryColor: '#2c3e50',
    secondaryColor: '#34495e',
    gradient: ['#2c3e50', '#34495e'],
    bgGradient: ['#ecf0f1', '#f8f9fa']
  },
  { 
    key: 'face-registration', 
    label: 'Đăng ký khuôn mặt', 
    icon: 'face-recognition', 
    primaryColor: '#e74c3c',
    secondaryColor: '#c0392b',
    gradient: ['#e74c3c', '#c0392b'],
    bgGradient: ['#fdf2f2', '#fef5f5']
  },
];

export default function HomeScreen() {
  const [checkedIn, setCheckedIn] = useState(false); // Mặc định chưa checkin
  const [actualCheckInTime, setActualCheckInTime] = useState(null); // Giờ checkin thực tế
  const { user, logout, isAuthenticated, isLoading } = useAuth();
  const userName = user?.fullName || 'Người dùng';
  const checkInTime = '08:40';
  const navigation = useNavigation() as any;

  // Kiểm tra authentication state và chuyển hướng nếu cần
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigation.replace('Login');
    } else if (isAuthenticated && user?.id) {
      // Kiểm tra trạng thái checkin khi đã đăng nhập
      checkTodayAttendanceStatus();
    }
  }, [isAuthenticated, isLoading, user?.id]);

  // Kiểm tra trạng thái checkin từ API
  const checkTodayAttendanceStatus = async () => {
    if (!user?.id) return;
    
    try {
      const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
      
      // Try API first, but don't let it break the app
      try {
        const response = await api.get(`/AttendanceData`);
        
        if (response.data && response.data.length > 0) {
          // Filter dữ liệu của user hôm nay
          const todayAttendance = response.data.find((item: any) => 
            item.employeeCode === user.id && 
            item.workDate === today
          );
          
          if (todayAttendance) {
            const hasCheckIn = todayAttendance.checkInTime !== null;
            const hasCheckOut = todayAttendance.checkOutTime !== null;
            
            console.log('📊 Today attendance status:', {
              hasCheckIn,
              hasCheckOut,
              checkInTime: todayAttendance.checkInTime,
              checkOutTime: todayAttendance.checkOutTime
            });
            
            if (hasCheckIn && !hasCheckOut) {
              // Đã checkin nhưng chưa checkout
              setCheckedIn(true);
              setActualCheckInTime(todayAttendance.checkInTime);
            } else if (hasCheckIn && hasCheckOut) {
              // Đã checkin và checkout rồi
              setCheckedIn(false);
              setActualCheckInTime(todayAttendance.checkInTime);
            } else {
              // Chưa checkin
              setCheckedIn(false);
              setActualCheckInTime(null);
            }
            return; // Exit early if API data is found
          }
        }
      } catch (apiError: any) {
        console.log('📱 API not available, using AsyncStorage fallback:', apiError?.message || 'Unknown error');
      }
      
      // Fallback: sử dụng AsyncStorage
      const todayStr = new Date().toDateString();
      const checkinData = await AsyncStorage.getItem(`checkin_${todayStr}`);
      if (checkinData) {
        const parsed = JSON.parse(checkinData);
        console.log('📱 Using AsyncStorage checkin data:', parsed);
        setCheckedIn(parsed.checkedIn);
        if (parsed.checkInTime) {
          setActualCheckInTime(parsed.checkInTime);
        }
      } else {
        // Default state - not checked in
        setCheckedIn(false);
        setActualCheckInTime(null);
      }
    } catch (error) {
      console.error('Error checking attendance status:', error);
      // Final fallback: sử dụng AsyncStorage
      const todayStr = new Date().toDateString();
      const checkinData = await AsyncStorage.getItem(`checkin_${todayStr}`);
      if (checkinData) {
        const parsed = JSON.parse(checkinData);
        console.log('📱 Final fallback - AsyncStorage checkin data:', parsed);
        setCheckedIn(parsed.checkedIn);
        if (parsed.checkInTime) {
          setActualCheckInTime(parsed.checkInTime);
        }
      } else {
        setCheckedIn(false);
        setActualCheckInTime(null);
      }
    }
  };

  // Reload checkin status khi focus vào screen
  useFocusEffect(
    React.useCallback(() => {
      if (isAuthenticated && user?.id) {
        checkTodayAttendanceStatus();
      }
    }, [user?.id, isAuthenticated])
  );

  // Save trạng thái checkin vào AsyncStorage
  const saveCheckinStatus = async (status: boolean) => {
    try {
      const today = new Date().toDateString();
      const checkinData = {
        checkedIn: status,
        timestamp: new Date().toISOString()
      };
      await AsyncStorage.setItem(`checkin_${today}`, JSON.stringify(checkinData));
      setCheckedIn(status);
    } catch (error) {
      console.error('Error saving checkin status:', error);
    }
  };

  // Hiển thị loading nếu đang kiểm tra authentication
  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text>Đang tải...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const handleLogout = () => {
    Alert.alert(
      'Đăng xuất',
      'Bạn có chắc chắn muốn đăng xuất?',
      [
        {
          text: 'Hủy',
          style: 'cancel',
        },
        {
          text: 'Đăng xuất',
          style: 'destructive',
          onPress: async () => {
            await logout();
            // Chuyển hướng về trang login sau khi đăng xuất
            navigation.replace('Login');
          },
        },
      ]
    );
  };
  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#ecf0f1" />
      <SafeAreaView style={styles.safeArea}>
        <ScrollView 
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
        {/* Header */}
        <HomeHeader 
          userName={userName}
          onLogoutPress={handleLogout}
          avatarSource={require('../../../assets/images/partial-react-logo.png')}
        />

        {/* Main icons */}
        <View style={styles.mainIconContainer}>
          <View style={styles.mainIconGrid}>
            {mainIcons.map((item, index) => (
              <TouchableOpacity
                key={item.key}
                style={styles.mainIconBtn}
                onPress={() => {
                  if (item.key === 'attendance') navigation.navigate('AttendanceLayout');
                  if (item.key === 'profile') navigation.navigate('Profile');
                  if (item.key === 'salary') navigation.navigate('Payslip');
                }}
                activeOpacity={0.8}
              >
                <View style={[styles.mainIconCircle, { backgroundColor: item.bgGradient[0] }]}>
                  <View style={[styles.mainIconInner, { backgroundColor: item.gradient[0] }]}>
                    <Icon name={item.icon} size={24} color="#ffffff" />
                  </View>
                </View>
                <Text style={[styles.mainIconLabel, { color: item.primaryColor }]}>{item.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Checkin/Checkout */}
        <TouchableOpacity
          style={styles.checkButton}
          onPress={() => {
            const mode = checkedIn ? 'checkout' : 'checkin';
            navigation.navigate('Checkin', { mode });
          }}
          activeOpacity={0.85}
        >
          <View style={styles.checkButtonBlur}>
            <View style={[styles.checkButtonContent, { backgroundColor: checkedIn ? '#e8f5e8' : '#e3f2fd' }]}>
              <View style={styles.checkBtnRow}>
                <View style={[styles.checkIconContainer, { backgroundColor: checkedIn ? '#27ae60' : '#3498db' }]}>
                  <Icon name="clock-outline" size={28} color="#ffffff" />
                </View>
                <View style={styles.checkTextContainer}>
                  <Text style={[styles.checkButtonText, checkedIn ? styles.checkedOutText : styles.checkedInText]}>
                    {checkedIn ? 'Check Out' : 'Check In'}
                  </Text>
                  <Text style={[styles.checkTime, checkedIn ? styles.checkedOutTime : styles.checkedInTime]}>
                    {checkedIn && actualCheckInTime 
                      ? `Giờ check in: ${(actualCheckInTime as string).substring(0, 5)}`
                      : checkedIn 
                        ? 'Giờ check in: --:--'
                        : 'Chưa check in'
                    }
                  </Text>
                </View>
                <View style={styles.checkArrowContainer}>
                  <Icon name="chevron-right" size={24} color={checkedIn ? "#27ae60" : "#3498db"} />
                </View>
              </View>
            </View>
          </View>
        </TouchableOpacity>

        {/* Sub icons */}
        <View style={styles.subIconContainer}>
          <View style={styles.subIconRow}>
            {subIcons.slice(0, 2).map((item, idx) => (
              <TouchableOpacity
                key={item.key}
                style={styles.subIconBtn}
                onPress={() => {
                  if (item.key === 'leave') navigation.navigate('Leave');
                  if (item.key === 'overtime') navigation.navigate('Overtime');
                  if (item.key === 'face-registration') navigation.navigate('FaceRegistration');
                }}
                activeOpacity={0.8}
              >
                <View style={styles.subIconBlur}>
                  <View style={[styles.subIconContent, { backgroundColor: item.bgGradient[0] }]}>
                    <View style={[styles.subIconInner, { backgroundColor: item.gradient[0] }]}>
                      <Icon name={item.icon} size={28} color="#ffffff" style={styles.subIconEmoji} />
                    </View>
                    <Text style={[styles.subIconLabel, { color: item.primaryColor }]}>{item.label}</Text>
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </View>
          <View style={styles.subIconRow}>
            {subIcons.slice(2).map((item, idx) => (
              <TouchableOpacity
                key={item.key}
                style={styles.subIconBtn}
                onPress={() => {
                  if (item.key === 'leave') navigation.navigate('Leave');
                  if (item.key === 'overtime') navigation.navigate('Overtime');
                  if (item.key === 'face-registration') navigation.navigate('FaceRegistration');
                }}
                activeOpacity={0.8}
              >
                <View style={styles.subIconBlur}>
                  <View style={[styles.subIconContent, { backgroundColor: item.bgGradient[0] }]}>
                    <View style={[styles.subIconInner, { backgroundColor: item.gradient[0] }]}>
                      <Icon name={item.icon} size={28} color="#ffffff" style={styles.subIconEmoji} />
                    </View>
                    <Text style={[styles.subIconLabel, { color: item.primaryColor }]}>{item.label}</Text>
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ecf0f1', // Thay thế gradient bằng solid color
  },
  safeArea: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    padding: 0,
    alignItems: 'center',
    paddingBottom: 32,
  },
  mainIconContainer: {
    marginHorizontal: 20,
    marginTop: 4,
    marginBottom: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mainIconGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    width: '100%',
  },
  mainIconBtn: {
    alignItems: 'center',
    paddingVertical: 0,
    paddingHorizontal: 12,
    minWidth: 100,
  },
  mainIconCircle: {
    width: 68,
    height: 68,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  mainIconInner: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  mainIconLabel: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 18,
    letterSpacing: 0.2,
  },
  checkButton: {
    width: '90%',
    alignSelf: 'center',
    borderRadius: 20,
    marginBottom: 28,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8,
  },
  checkButtonBlur: {
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  checkButtonContent: {
    paddingVertical: 24,
    borderRadius: 20,
    alignItems: 'center',
  },
  checkedIn: {
    // Style for checked in state
  },
  checkedOut: {
    // Style for checked out state
  },
  checkBtnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    paddingHorizontal: 24,
  },
  checkIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  checkedInIcon: {
    backgroundColor: '#dbeafe',
  },
  checkedOutIcon: {
    backgroundColor: '#fecaca',
  },
  checkTextContainer: {
    flex: 1,
  },
  checkButtonText: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 6,
    letterSpacing: 0.3,
  },
  checkedInText: {
    color: '#3498db',
  },
  checkedOutText: {
    color: '#27ae60',
  },
  checkTime: {
    fontSize: 15,
    fontWeight: '500',
    opacity: 0.8,
  },
  checkedInTime: {
    color: '#2c3e50',
  },
  checkedOutTime: {
    color: '#2c3e50',
  },
  checkArrowContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  subIconContainer: {
    marginHorizontal: 20,
    marginTop: 8,
    marginBottom: 32,
  },
  subIconRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  subIconBtn: {
    width: '48%',
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 6,
    },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 6,
  },
  subIconBlur: {
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  subIconContent: {
    flex: 1,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'column',
    paddingHorizontal: 20,
    paddingVertical: 24,
    minHeight: 120,
  },
  subIconInner: {
    width: 64,
    height: 64,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  subIconEmoji: {
    // Icon styling handled in component
  },
  subIconLabel: {
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
    letterSpacing: 0.2,
  },
});
