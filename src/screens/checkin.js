import api from '../api';
import Geolocation from '@react-native-community/geolocation';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Dimensions
} from 'react-native';
import SimpleMapView from '../components/SimpleMapView';
import SimpleFaceRecognitionCamera from '../components/SimpleFaceRecognitionCamera';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useWorkShift } from '../composables/useWorkShift';
import { getAttendanceMachines } from '../services/attendanceMachineService';
import { useAuth } from '../contexts/AuthContext';
import CustomHeader from '../components/CustomHeader';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ==================== Helper Functions ====================

// Haversine formula - tính khoảng cách giữa 2 điểm GPS
function getDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3;
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Chuyển đổi tên ngày thành số (0 = Chủ nhật, 1 = Thứ 2, ...)
function getDayOfWeekNumber(dayName) {
  if (!dayName) return -1;
  
  const days = {
    'Chủ nhật': 0, 'chủ nhật': 0, 'CN': 0,
    'Thứ hai': 1, 'thứ hai': 1, 'Thứ 2': 1, 'thứ 2': 1, 'T2': 1,
    'Thứ ba': 2, 'thứ ba': 2, 'Thứ 3': 2, 'thứ 3': 2, 'T3': 2,
    'Thứ tư': 3, 'thứ tư': 3, 'Thứ 4': 3, 'thứ 4': 3, 'T4': 3,
    'Thứ năm': 4, 'thứ năm': 4, 'Thứ 5': 4, 'thứ 5': 4, 'T5': 4,
    'Thứ sáu': 5, 'thứ sáu': 5, 'Thứ 6': 5, 'thứ 6': 5, 'T6': 5,
    'Thứ bảy': 6, 'thứ bảy': 6, 'Thứ 7': 6, 'thứ 7': 6, 'T7': 6,
    'Sunday': 0, 'sunday': 0, 'Sun': 0,
    'Monday': 1, 'monday': 1, 'Mon': 1,
    'Tuesday': 2, 'tuesday': 2, 'Tue': 2,
    'Wednesday': 3, 'wednesday': 3, 'Wed': 3,
    'Thursday': 4, 'thursday': 4, 'Thu': 4,
    'Friday': 5, 'friday': 5, 'Fri': 5,
    'Saturday': 6, 'saturday': 6, 'Sat': 6,
    '0': 0, '1': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6
  };
  
  return days[dayName.trim()] ?? -1;
}

// Parse thời gian từ string (HH:mm) thành phút
function parseTime(timeString) {
  const [hours, minutes] = timeString.split(':').map(Number);
  return hours * 60 + minutes;
}

// Tạo location object từ position
function createLocationObject(position) {
  return {
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
    accuracy: position.coords.accuracy,
    altitude: position.coords.altitude,
    altitudeAccuracy: position.coords.altitudeAccuracy,
    heading: position.coords.heading,
    speed: position.coords.speed,
  };
}

// Lưu check-in status vào AsyncStorage (với user ID để tránh lẫn lộn giữa các users)
async function saveCheckInStatus(mode, userId) {
  try {
    if (!userId) return;
    const today = new Date().toDateString();
    const checkinData = {
      userId: userId, // Thêm user ID để security
      checkedIn: mode === 'checkin',
      timestamp: new Date().toISOString(),
      checkInTime: mode === 'checkin' ? new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false }) : null,
      checkOutTime: mode === 'checkout' ? new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false }) : null
    };
    await AsyncStorage.setItem(`checkin_${userId}_${today}`, JSON.stringify(checkinData));
  } catch (error) {
    // Handle error silently
  }
}


export default function CheckInScreen({ route }) {
  const { user } = useAuth();
  const navigation = useNavigation();
  const [location, setLocation] = useState(null);
  const [locationLoading, setLocationLoading] = useState(true);
  const [machines, setMachines] = useState([]);
  const [machinesLoading, setMachinesLoading] = useState(true);
  const [isWithinRadius, setIsWithinRadius] = useState(false);
  const [activeMachineName, setActiveMachineName] = useState('');
  const [isFaceRecognitionOpen, setIsFaceRecognitionOpen] = useState(false);
  const [capturedImage, setCapturedImage] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState(null);
  const [selectedShift, setSelectedShift] = useState(null);
  const [checkedShiftIds, setCheckedShiftIds] = useState([]); // Danh sách ca đã check-in/checkout hôm nay
  
  // Watch ID để clear khi unmount
  const watchIdRef = useRef(null);
  
  // Lấy mode từ route params (checkin hoặc checkout)
  const mode = route?.params?.mode || 'checkin';

  const { workShifts, loading: shiftsLoading, error: shiftsError } = useWorkShift();
  const now = new Date();
  const time = now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false });
  const date = now.toLocaleDateString('vi-VN');

  // Lấy ca làm việc của thứ hiện tại
  const getTodayShifts = () => {
    if (!workShifts || workShifts.length === 0) return [];
    
    const currentDay = now.getDay(); // 0 = Chủ nhật, 1 = Thứ 2, ...
    
    const todayShifts = workShifts.filter(shift => {
      if (!shift.shiftDetails || shift.shiftDetails.length === 0) return false;
      
      // Chỉ lấy ca có lịch làm việc trong thứ hiện tại
      return shift.shiftDetails.some(detail => {
        const dayOfWeek = getDayOfWeekNumber(detail.dayOfWeek);
        return dayOfWeek === currentDay;
      });
    });
    
    // Nếu không có ca nào phù hợp với ngày hiện tại, hiển thị tất cả ca
    if (todayShifts.length === 0) {
      return workShifts.filter(shift => shift.shiftDetails && shift.shiftDetails.length > 0);
    }
    
    return todayShifts;
  };

  // Lọc các ca làm việc phù hợp với thời gian hiện tại (để highlight)
  const getCurrentTimeShifts = () => {
    if (!workShifts || workShifts.length === 0) return [];
    
    const currentTime = now.getHours() * 60 + now.getMinutes(); // Thời gian hiện tại tính bằng phút
    const currentDay = now.getDay(); // 0 = Chủ nhật, 1 = Thứ 2, ...
    
    return workShifts.filter(shift => {
      if (!shift.shiftDetails || shift.shiftDetails.length === 0) return false;
      
      // Kiểm tra xem có ca nào phù hợp với ngày hiện tại không
      return shift.shiftDetails.some(detail => {
        const dayOfWeek = getDayOfWeekNumber(detail.dayOfWeek);
        if (dayOfWeek !== currentDay) return false;
        
        // Kiểm tra thời gian check-in (trước giờ bắt đầu ca 30 phút đến sau giờ bắt đầu ca 30 phút)
        const startTime = parseTime(detail.startTime);
        const checkInStart = startTime - 30; // 30 phút trước ca
        const checkInEnd = startTime + 30; // 30 phút sau khi ca bắt đầu
        
        return currentTime >= checkInStart && currentTime <= checkInEnd;
      });
    });
  };


  // Lọc các ca đã check-in/checkout khi ở mode check-in
  const getFilteredShifts = () => {
    const todayShifts = getTodayShifts();
    if (mode === 'checkin' && checkedShiftIds.length > 0) {
      // Ẩn các ca đã check-in/checkout
      return todayShifts.filter(shift => !checkedShiftIds.includes(shift.id));
    }
    return todayShifts;
  };

  const availableShifts = getFilteredShifts();
  const currentTimeShifts = getCurrentTimeShifts();



  // Fetch danh sách ca đã check-in/checkout hôm nay (để ẩn khi check-in)
  useEffect(() => {
    const fetchCheckedShifts = async () => {
      if (mode === 'checkin' && user?.id) {
        try {
          const response = await api.get(`/Attendance/today-shifts/${user.id}`);
          if (response.data && response.data.checkedShiftIds) {
            setCheckedShiftIds(response.data.checkedShiftIds);
          }
        } catch (error) {
          // Handle error silently
        }
      }
    };

    fetchCheckedShifts();
  }, [mode, user?.id]);

  // Tự động chọn ca khi checkout dựa trên ca đã chọn khi check-in
  useEffect(() => {
    const fetchTodayAttendanceAndSetShift = async () => {
      if (mode === 'checkout' && user?.id && workShifts && workShifts.length > 0 && !selectedShift) {
        try {
          const response = await api.get(`/Attendance/today/${user.id}`);
          
          if (response.data) {
            if (response.data.workShiftID) {
              const shift = workShifts.find(s => s.id === response.data.workShiftID);
              if (shift) {
                setSelectedShift(shift);
              }
            } else {
              if (response.data.checkOutDateTime) {
                // Already checked out
              } else if (response.data.checkInDateTime) {
                Alert.alert(
                  'Thông báo',
                  'Bản ghi chấm công vào không có thông tin ca làm việc. Vui lòng liên hệ quản trị viên.',
                  [{ text: 'OK' }]
                );
              }
            }
          }
        } catch (error) {
          // Handle error silently
        }
      }
    };

    fetchTodayAttendanceAndSetShift();
  }, [mode, user?.id, workShifts, selectedShift]);

  useEffect(() => {
    const requestLocationPermission = async () => {
      try {
        if (Geolocation.requestAuthorization) {
          await Geolocation.requestAuthorization();
        }
      } catch (permError) {
        // Permission may already be granted
      }
    };

    const startLocationWatch = (lastKnownLocation) => {
      if (watchIdRef.current !== null) return;
      
      watchIdRef.current = Geolocation.watchPosition(
        (watchPosition) => {
          const newAcc = watchPosition.coords.accuracy;
          const currentAcc = lastKnownLocation?.accuracy || Infinity;
          
          if (!lastKnownLocation || newAcc < currentAcc || newAcc < 50) {
            const updatedLocation = createLocationObject(watchPosition);
            setLocation(updatedLocation);
            lastKnownLocation = updatedLocation;
          }
        },
        () => {
          // Keep old location on watch error
        },
        {
          enableHighAccuracy: false,
          timeout: 20000,
          maximumAge: 10000,
          distanceFilter: 5,
        }
      );
    };

    const fetchLocation = async () => {
      setLocationLoading(true);
      
      try {
        await requestLocationPermission();
      } catch (permErr) {
        // Continue anyway
      }
      
      let retryCount = 0;
      const maxRetries = 2;
      let lastKnownLocation = null;
      
      const tryGetLocation = (useCached = true) => {
        try {
          Geolocation.getCurrentPosition(
            (position) => {
              const newLocation = createLocationObject(position);
              setLocation(newLocation);
              lastKnownLocation = newLocation;
              setLocationLoading(false);
              startLocationWatch(lastKnownLocation);
            },
            (error) => {
              if (lastKnownLocation && retryCount === 0) {
                setLocation(lastKnownLocation);
                setLocationLoading(false);
                startLocationWatch(lastKnownLocation);
              }
              
              if (retryCount < maxRetries - 1) {
                retryCount++;
                setTimeout(() => tryGetLocation(true), 1000);
              } else {
                if (lastKnownLocation) {
                  setLocation(lastKnownLocation);
                  setLocationLoading(false);
                  startLocationWatch(lastKnownLocation);
                } else {
                  Geolocation.getCurrentPosition(
                    (position) => {
                      const fallbackLocation = createLocationObject(position);
                      setLocation(fallbackLocation);
                      lastKnownLocation = fallbackLocation;
                      setLocationLoading(false);
                      startLocationWatch(lastKnownLocation);
                    },
                    () => {
                      setLocationLoading(false);
                      if (lastKnownLocation) {
                        setLocation(lastKnownLocation);
                      }
                    },
                    {
                      enableHighAccuracy: false,
                      timeout: 8000,
                      maximumAge: 300000,
                    }
                  );
                }
              }
            },
            {
              enableHighAccuracy: false,
              timeout: 10000,
              maximumAge: useCached ? 30000 : 0,
            }
          );
        } catch (err) {
          if (lastKnownLocation) {
            setLocation(lastKnownLocation);
            setLocationLoading(false);
            startLocationWatch(lastKnownLocation);
          } else if (retryCount < maxRetries - 1) {
            retryCount++;
            setTimeout(() => tryGetLocation(true), 1000);
          } else {
            setLocationLoading(false);
          }
        }
      };
      
      tryGetLocation(true);
    };
    
    fetchLocation();
    
    return () => {
      if (watchIdRef.current !== null) {
        Geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const fetchMachines = async () => {
      setMachinesLoading(true);
      try {
        const data = await getAttendanceMachines();
        setMachines(data);
        } catch (err) {
          Alert.alert('Lỗi', 'Không thể tải danh sách máy chấm công');
        } finally {
        setMachinesLoading(false);
      }
    };
    fetchMachines();
  }, []);

  useEffect(() => {
    if (location && machines.length > 0) {
      let inRange = false;
      let machineName = '';
      for (const machine of machines) {
        const distance = getDistance(
          location.latitude, 
          location.longitude, 
          parseFloat(machine.latitude), 
          parseFloat(machine.longitude)
        );
        if (distance <= parseFloat(machine.allowedRadius)) {
          inRange = true;
          machineName = machine.attendanceMachineName;
          break;
        }
      }
      setIsWithinRadius(inRange);
      setActiveMachineName(machineName);
    }
  }, [location, machines]);

  const handleFaceRecognized = async (data) => {
    setIsFaceRecognitionOpen(false);
    const { recognitionResult } = data;
    
    if (!recognitionResult.success) {
      Alert.alert('Lỗi', recognitionResult.message || 'Không thể xác minh khuôn mặt');
      return;
    }

    if (!recognitionResult.isMatch) {
      Alert.alert(
        'Nhận diện thất bại',
        recognitionResult.message || `Không nhận diện được khuôn mặt (Độ chính xác: ${(recognitionResult.confidence * 100).toFixed(1)}%)`
      );
      return;
    }
    
    // Check if attendance was already processed by SimpleFaceRecognitionCamera
    if (recognitionResult.attendance) {
      setUploadStatus('success');
      Alert.alert(
        'Thành công',
        `${mode === 'checkin' ? 'Check-in' : 'Check-out'} thành công!\nNhận diện: ${(recognitionResult.confidence * 100).toFixed(1)}%\nThời gian: ${new Date().toLocaleString('vi-VN')}`,
        [
          {
            text: 'OK',
            onPress: async () => {
              await saveCheckInStatus(mode, user?.id);
              navigation.goBack();
            }
          }
        ]
      );
      return;
    }
    
    // Process attendance if not already processed
    await processCheckInNoImage(recognitionResult);
  };



  const formatDateTimeForVietnam = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
  };

  const createVerificationMetadata = (recognitionResult) => {
    const now = new Date();
    const faceInfo = recognitionResult 
      ? ` - Face Recognition: ${recognitionResult.employeeName} (Confidence: ${(recognitionResult.confidence * 100).toFixed(1)}%)` 
      : '';
    const verificationToken = `${user.id}_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
    const verificationTimestamp = now.toISOString();
    
    return {
      faceInfo,
      verificationToken,
      verificationTimestamp,
    };
  };

  const processCheckInNoImage = async (recognitionResult) => {
    try {
      setIsUploading(true);
      
      if (!user?.id) {
        throw new Error('Vui lòng đăng nhập để chấm công');
      }
      
      if (!selectedShift) {
        if (mode === 'checkin') {
          throw new Error('Vui lòng chọn ca làm việc trước khi chấm công');
        } else {
          throw new Error('Không tìm thấy ca đã chấm công vào. Vui lòng chấm công vào trước.');
        }
      }

      if (typeof api === 'undefined' || !api?.post) {
        throw new Error('API service is not available');
      }

      const now = new Date();
      const currentDateTime = formatDateTimeForVietnam(now);
      const { faceInfo, verificationToken, verificationTimestamp } = createVerificationMetadata(recognitionResult);
      
      const baseData = {
        EmployeeId: user.id,
        Latitude: location?.latitude || 0,
        Longitude: location?.longitude || 0,
        Location: activeMachineName || 'Unknown Location',
        Notes: `${mode === 'checkin' ? 'Check-in' : 'Check-out'} from mobile app - Ca: ${selectedShift.shiftName}${faceInfo}`,
        MatchedFaceId: recognitionResult?.matchedFaceId || '',
        MatchConfidence: recognitionResult?.confidence || 0,
        VerificationTimestamp: verificationTimestamp,
        VerificationToken: verificationToken,
      };

      const data = mode === 'checkin' 
        ? {
            ...baseData,
            CheckInDateTime: currentDateTime,
            AttendanceMachineId: 2,
            WorkShiftID: selectedShift.id,
          }
        : {
            ...baseData,
            CheckOutDateTime: currentDateTime,
            WorkShiftID: selectedShift?.id, // Gửi WorkShiftID khi checkout để xác định ca cụ thể
          };

      const endpoint = mode === 'checkin' ? '/Attendance/checkin-noimage' : '/Attendance/checkout-noimage';
      const response = await api.post(endpoint, data);

      if (response.data?.success) {
        setUploadStatus('success');
        Alert.alert(
          'Thành công',
          `${mode === 'checkin' ? 'Check-in' : 'Check-out'} thành công!\nThời gian: ${now.toLocaleString('vi-VN')}`,
          [
            {
              text: 'OK',
              onPress: async () => {
                setCapturedImage(null);
                setUploadStatus(null);
                await saveCheckInStatus(mode, user?.id);
                setTimeout(() => {
                  navigation.goBack();
                }, 1500);
              }
            }
          ]
        );
      } else {
        setUploadStatus('error');
        Alert.alert('Lỗi', response.data?.message || 'Không thể chấm công');
      }
    } catch (error) {
      setUploadStatus('error');
      const errorMessage = error.response?.data?.message || 
                          error.response?.data?.Message || 
                          error.message || 
                          'Không thể chấm công';
      Alert.alert('Lỗi', errorMessage);
    } finally {
      setIsUploading(false);
    }
  };



  const isCheckInDisabled = !isWithinRadius || locationLoading || machinesLoading || !selectedShift;

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <CustomHeader title={mode === 'checkin' ? 'CHẤM CÔNG VÀO' : 'CHẤM CÔNG RA'} />
        
        <ScrollView 
          style={styles.scrollContainer}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          <View style={styles.userRow}>
        <View style={[styles.userRowGradient, { backgroundColor: '#fff' }]}>
          <View style={styles.avatar}>
            <View style={[styles.avatarGradient, { backgroundColor: '#3498db' }]}>
              <Icon name="account-circle" size={40} color="#ffffff" />
            </View>
          </View>
          <View style={styles.userInfo}>
            <Text style={styles.userName}>{user?.fullName || 'Người dùng'}</Text>
            <Text style={styles.userRole}>{user?.role || 'Nhân viên'}</Text>
          </View>
        </View>
      </View>

      <View style={styles.mapBox}>
        {locationLoading ? (
          <View style={[styles.mapImg, { justifyContent: 'center', alignItems: 'center' }]}>
            <ActivityIndicator size="large" color="#2563eb" />
            <Text style={styles.loadingText}>Đang tải vị trí...</Text>
          </View>
        ) : location ? (
          <View style={styles.mapContainer}>
            <SimpleMapView
              latitude={location.latitude}
              longitude={location.longitude}
              markers={machines.map((machine) => ({
                latitude: parseFloat(machine.latitude),
                longitude: parseFloat(machine.longitude),
                title: machine.attendanceMachineName,
                color: machine.attendanceMachineName === activeMachineName ? 'green' : 'red'
              }))}
              style={styles.mapImg}
            />
          </View>
        ) : (
          <View style={[styles.mapImg, { alignItems: 'center', justifyContent: 'center' }]}>
            <Icon name="map-marker-off" size={48} color="#94a3b8" />
            <Text style={styles.errorText}>Không lấy được vị trí</Text>
          </View>
        )}
        <View style={styles.privacyContainer}>
          <Icon name="shield-check" size={16} color="#2563eb" />
          <Text style={styles.privacy}>Quyền riêng tư</Text>
        </View>
      </View>

      <View style={styles.locationStatusBox}>
        {locationLoading || machinesLoading ? (
          <View style={styles.statusLoadingContainer}>
            <ActivityIndicator size="small" color="#2563eb" />
            <Text style={styles.statusLoadingText}>Đang kiểm tra vị trí...</Text>
          </View>
        ) : isWithinRadius ? (
          <View style={[styles.statusSuccessContainer, { backgroundColor: '#10b981' }]}>
            <Icon name="check-circle" size={20} color="#fff" />
            <Text style={styles.statusTextSuccess}>
              Bạn đang ở trong khu vực chấm công: {activeMachineName}
            </Text>
          </View>
        ) : (
          <View style={[styles.statusErrorContainer, { backgroundColor: '#ef4444' }]}>
            <Icon name="alert-circle" size={20} color="#fff" />
            <Text style={styles.statusTextError}>
              Bạn không ở trong khu vực chấm công
            </Text>
          </View>
        )}
      </View>

      {capturedImage && (
        <View style={styles.previewContainer}>
          <Image source={{ uri: capturedImage }} style={styles.previewImage} />
          {isUploading && <ActivityIndicator size="large" color="#008080" style={styles.uploadSpinner} />}
          {uploadStatus === 'success' && <Icon name="check-circle" size={40} color="#43a047" style={styles.statusIcon} />}
          {uploadStatus === 'error' && <Icon name="close-circle" size={40} color="#e53935" style={styles.statusIcon} />}
        </View>
      )}

      {/* Work Shift Selection */}
      <View style={styles.shiftSelectionBox}>
        <Text style={styles.shiftSelectionTitle}>
          {mode === 'checkout' ? 'Ca làm việc đã chấm công' : 'Chọn ca làm việc'}
        </Text>
        <Text style={styles.shiftSelectionSubtitle}>
          {mode === 'checkout' ? 'Ca đã chấm công vào hôm nay' : `Ca làm việc hôm nay (${date})`}
        </Text>
        
        {mode === 'checkout' ? (
          // Checkout mode: Chỉ hiển thị ca đã check-in (read-only)
          selectedShift ? (
            <View style={[styles.shiftItem, styles.shiftItemSelected, { opacity: 0.8 }]}>
              <View style={styles.shiftLeftContent}>
                <View style={styles.shiftIconContainer}>
                  <Icon name="clock-outline" size={24} color="#2563eb" />
                </View>
                <View style={styles.shiftInfo}>
                  <Text style={styles.shiftName}>{selectedShift.shiftName}</Text>
                  {selectedShift.shiftDetails?.find(detail => {
                    const dayOfWeek = getDayOfWeekNumber(detail.dayOfWeek);
                    return dayOfWeek === now.getDay();
                  }) && (
                    <Text style={styles.shiftTime}>
                      {selectedShift.shiftDetails.find(detail => {
                        const dayOfWeek = getDayOfWeekNumber(detail.dayOfWeek);
                        return dayOfWeek === now.getDay();
                      }).startTime.substring(0, 5)} - {selectedShift.shiftDetails.find(detail => {
                        const dayOfWeek = getDayOfWeekNumber(detail.dayOfWeek);
                        return dayOfWeek === now.getDay();
                      }).endTime.substring(0, 5)}
                    </Text>
                  )}
                </View>
              </View>
              <Icon name="check-circle" size={24} color="#10b981" />
            </View>
          ) : (
            <View style={styles.noShiftContainer}>
              <Icon name="alert-circle" size={48} color="#ef4444" />
              <Text style={styles.noShiftText}>
                Không tìm thấy ca đã chấm công vào
              </Text>
            </View>
          )
        ) : shiftsLoading ? (
          <View style={styles.noShiftContainer}>
            <ActivityIndicator size="large" color="#3498db" />
            <Text style={styles.noShiftText}>
              Đang tải ca làm việc...
            </Text>
          </View>
        ) : shiftsError ? (
          <View style={styles.noShiftContainer}>
            <Icon name="alert-circle" size={48} color="#ef4444" />
            <Text style={styles.noShiftText}>
              Lỗi tải ca làm việc
            </Text>
            <Text style={styles.noShiftSubText}>
              {shiftsError.message || 'Không thể kết nối đến server'}
            </Text>
          </View>
        ) : availableShifts.length > 0 ? (
          <ScrollView 
            style={styles.shiftScrollContainer}
            showsVerticalScrollIndicator={true}
            nestedScrollEnabled={true}
          >
            {availableShifts.map((shift) => {
              const isCurrentTime = currentTimeShifts.some(s => s.id === shift.id);
              const isSelected = selectedShift?.id === shift.id;
              
              const todayDetail = shift.shiftDetails?.find(detail => {
                const dayOfWeek = getDayOfWeekNumber(detail.dayOfWeek);
                return dayOfWeek === now.getDay();
              });

              return (
                <TouchableOpacity
                  key={shift.id}
                  style={[
                    styles.shiftItem,
                    isSelected && styles.shiftItemSelected,
                    isCurrentTime && !isSelected && styles.shiftItemCurrentTime
                  ]}
                  onPress={() => setSelectedShift(shift)}
                  activeOpacity={0.7}
                >
                  <View style={styles.shiftLeftContent}>
                    <View style={styles.shiftIconContainer}>
                      <Icon 
                        name="clock-outline" 
                        size={22} 
                        color={isSelected ? '#10b981' : isCurrentTime ? '#2563eb' : '#64748b'} 
                      />
                    </View>
                    <View style={styles.shiftInfo}>
                      <View style={styles.shiftHeader}>
                        <Text style={[
                          styles.shiftName,
                          isSelected && styles.shiftNameSelected,
                          isCurrentTime && !isSelected && styles.shiftNameCurrentTime
                        ]}>
                          {shift.shiftName}
                        </Text>
                        {isCurrentTime && (
                          <View style={styles.currentTimeBadge}>
                            <Icon name="pulse" size={12} color="#fff" style={{ marginRight: 4 }} />
                            <Text style={styles.currentTimeText}>Hiện tại</Text>
                          </View>
                        )}
                      </View>
                      {/* Chỉ hiển thị giờ làm của thứ hiện tại */}
                      {todayDetail ? (
                        <View style={styles.shiftTimeContainer}>
                          <Text style={[
                            styles.shiftDetail,
                            isSelected && styles.shiftDetailSelected,
                            isCurrentTime && !isSelected && styles.shiftDetailCurrentTime
                          ]}>
                            {todayDetail.startTime.substring(0, 5)} - {todayDetail.endTime.substring(0, 5)}
                          </Text>
                        </View>
                      ) : (
                        <Text style={[
                          styles.shiftDetail,
                          styles.shiftDetailOtherDay
                        ]}>
                          Không có lịch cho hôm nay
                        </Text>
                      )}
                    </View>
                  </View>
                  <View style={styles.shiftRightContent}>
                    {isSelected && (
                      <View style={styles.checkIconContainer}>
                        <Icon name="check-circle" size={28} color="#10b981" />
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        ) : (
          <View style={styles.noShiftContainer}>
            <Icon name="clock-outline" size={48} color="#94a3b8" />
            <Text style={styles.noShiftText}>
              Không có ca làm việc
            </Text>
            <Text style={styles.noShiftSubText}>
              {workShifts?.length === 0 ? 'Không có dữ liệu ca làm việc' : 'Không có ca làm việc phù hợp'}
            </Text>
          </View>
        )}
      </View>

      <View style={styles.timeBox}>
        <View style={styles.timeContainer}>
          <Text style={styles.time}>{time}</Text>
          <Text style={styles.date}>{date}</Text>
        </View>
        
        <View style={styles.buttonContainer}>
          <TouchableOpacity 
            style={[styles.faceBtn, isCheckInDisabled && styles.faceBtnDisabled]} 
            disabled={isCheckInDisabled} 
            onPress={() => setIsFaceRecognitionOpen(true)}
            activeOpacity={0.8}
          >
            <View style={[
              styles.faceBtnGradient,
              { backgroundColor: isCheckInDisabled ? '#94a3b8' : '#10b981' }
            ]}>
              <Icon name="face-recognition" size={32} color="#fff" />
              <Text style={styles.faceBtnText}>Nhận diện mặt</Text>
            </View>
          </TouchableOpacity>
        </View>
      </View>
        </ScrollView>

      <Modal animationType="slide" transparent={false} visible={isFaceRecognitionOpen} onRequestClose={() => setIsFaceRecognitionOpen(false)}>
        <SimpleFaceRecognitionCamera 
          onFaceRecognized={handleFaceRecognized} 
          onClose={() => setIsFaceRecognitionOpen(false)}
          user={user}
        />
      </Modal>
      </SafeAreaView>
    </View>
  );
}

const { width } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: { 
    flex: 1,
    backgroundColor: '#ecf0f1', // Thay thế gradient bằng solid color
  },
  safeArea: { flex: 1 },
  userRow: { 
    marginHorizontal: 16, 
    marginTop: 20, 
    borderRadius: 16, 
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  userRowGradient: {
    flexDirection: 'row', 
    alignItems: 'center', 
    padding: 16, 
    borderRadius: 16,
    backgroundColor: '#fff', // Thay thế gradient bằng solid color
  },
  avatar: { 
    width: 56, 
    height: 56, 
    borderRadius: 28, 
    marginRight: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  avatarGradient: {
    width: '100%',
    height: '100%',
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3498db',
  },
  userInfo: {
    flex: 1,
  },
  userName: { 
    fontWeight: 'bold', 
    fontSize: 18, 
    color: '#2c3e50',
    marginBottom: 2,
  },
  userRole: {
    fontSize: 14,
    color: '#3498db',
    fontWeight: '600',
  },
  mapBox: { 
    backgroundColor: '#fff', 
    marginHorizontal: 16, 
    borderRadius: 16, 
    overflow: 'hidden', 
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    marginTop: 16,
  },
  mapContainer: {
    position: 'relative',
    width: '100%',
    height: 180,
  },
  mapImg: { width: '100%', height: 180 },
  mapOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 40,
  },
  mapPlaceholderText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#3498db',
    marginTop: 8,
  },
  mapPlaceholderSubtext: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
    textAlign: 'center',
  },
  privacyContainer: {
    position: 'absolute',
    right: 12,
    top: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  privacy: { 
    color: '#3498db', 
    fontSize: 12, 
    fontWeight: '600',
    marginLeft: 4,
  },
  loadingText: {
    color: '#3498db',
    fontSize: 14,
    fontWeight: '500',
    marginTop: 8,
  },
  errorText: {
    color: '#2c3e50',
    fontSize: 14,
    fontWeight: '500',
    marginTop: 8,
  },
  locationStatusBox: { 
    marginHorizontal: 16, 
    borderRadius: 16, 
    marginTop: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  statusLoadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 16,
  },
  statusLoadingText: {
    marginLeft: 8,
    color: '#3498db',
    fontSize: 14,
    fontWeight: '500',
  },
  statusSuccessContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  statusErrorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    shadowColor: '#ef4444',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  statusTextSuccess: { 
    flex: 1,
    textAlign: 'center', 
    fontSize: 14, 
    color: '#fff', 
    fontWeight: '600',
    marginLeft: 8,
  },
  statusTextError: { 
    flex: 1,
    textAlign: 'center', 
    fontSize: 14, 
    color: '#fff', 
    fontWeight: '600',
    marginLeft: 8,
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  timeBox: { 
    alignItems: 'center', 
    marginTop: 24, 
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  timeContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  time: { 
    fontSize: 48, 
    fontWeight: 'bold', 
    color: '#2c3e50',
    letterSpacing: 2,
  },
  date: { 
    fontSize: 18, 
    color: '#3498db', 
    marginTop: 4,
    fontWeight: '600',
  },
  cameraBtn: { 
    flex: 1,
    borderRadius: 24,
    shadowColor: '#3498db',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  cameraBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    paddingHorizontal: 24,
    borderRadius: 24,
  },
  cameraBtnText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 8,
    letterSpacing: 1,
  },
  cameraBtnDisabled: { 
    shadowOpacity: 0.1,
    elevation: 2,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  faceBtn: { 
    width: '100%',
    borderRadius: 24,
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  faceBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    paddingHorizontal: 24,
    borderRadius: 24,
  },
  faceBtnText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 8,
    letterSpacing: 1,
  },
  faceBtnDisabled: { 
    shadowOpacity: 0.1,
    elevation: 2,
  },
  previewContainer: {
    marginHorizontal: 16,
    marginTop: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    position: 'relative',
    minHeight: 160,
  },
  previewImage: {
    width: 120,
    height: 120,
    borderRadius: 12,
    borderWidth: 3,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  uploadSpinner: {
    position: 'absolute',
  },
  statusIcon: {
    position: 'absolute',
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 24,
    padding: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  shiftItem: {
    backgroundColor: '#ffffff',
    padding: 16,
    marginVertical: 6,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 2,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  shiftItemSelected: {
    borderColor: '#10b981',
    backgroundColor: '#f0fdf4',
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  shiftLeftContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  shiftIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  shiftInfo: {
    flex: 1,
  },
  shiftName: {
    fontWeight: '600',
    fontSize: 15,
    color: '#1e293b',
    letterSpacing: 0.2,
  },
  shiftNameSelected: {
    color: '#059669',
    fontWeight: '700',
  },
  shiftTimeContainer: {
    marginTop: 4,
  },
  shiftDetail: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '500',
    letterSpacing: 0.3,
  },
  shiftDetailSelected: {
    color: '#047857',
    fontWeight: '600',
  },
  shiftSelectionBox: {
    marginHorizontal: 16,
    marginTop: 16,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  shiftSelectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 6,
    letterSpacing: 0.3,
  },
  shiftSelectionSubtitle: {
    fontSize: 13,
    color: '#64748b',
    marginBottom: 12,
    fontWeight: '500',
    letterSpacing: 0.2,
  },
  shiftHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  currentTimeBadge: {
    backgroundColor: '#2563eb',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#2563eb',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 2,
  },
  currentTimeText: {
    fontSize: 11,
    color: '#fff',
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  shiftRightContent: {
    marginLeft: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkIconContainer: {
    width: 28,
    height: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  shiftItemCurrentTime: {
    borderColor: '#2563eb',
    backgroundColor: '#eff6ff',
  },
  shiftNameCurrentTime: {
    color: '#1e40af',
    fontWeight: '700',
  },
  shiftDetailCurrentTime: {
    color: '#1d4ed8',
    fontWeight: '600',
  },
  shiftDetailOtherDay: {
    color: '#94a3b8',
    fontStyle: 'italic',
  },
  shiftList: {
    marginTop: 8,
  },
  shiftScrollContainer: {
    maxHeight: 200,
    marginTop: 4,
  },
  noShiftContainer: {
    alignItems: 'center',
    padding: 20,
  },
  noShiftText: {
    fontSize: 16,
    color: '#2c3e50',
    textAlign: 'center',
    marginTop: 12,
    fontWeight: '600',
  },
  noShiftSubText: {
    fontSize: 14,
    color: '#3498db',
    textAlign: 'center',
    marginTop: 4,
    fontWeight: '500',
  },
  debugContainer: {
    marginTop: 16,
    padding: 12,
    backgroundColor: '#f1f5f9',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  debugText: {
    fontSize: 12,
    color: '#2c3e50',
    marginBottom: 4,
    fontWeight: '500',
  },
});