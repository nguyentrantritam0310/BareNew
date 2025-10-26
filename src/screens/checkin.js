import axios from 'axios';
import { CameraView, useCameraPermissions } from 'expo-camera';
import Geolocation from '@react-native-community/geolocation';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Button,
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
import MapPlaceholder from '../components/MapPlaceholder';
import SimpleFaceRecognitionCamera from '../components/SimpleFaceRecognitionCamera';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
// import { LinearGradient } from 'expo-linear-gradient';
import { useWorkShift } from '../composables/useWorkShift';
import { getAttendanceMachines } from '../services/attendanceMachineService';
import { useAuth } from '../contexts/AuthContext';
import CustomHeader from '../components/CustomHeader';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Haversine formula
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

const InternalCameraCheckIn = ({ onPictureTaken, onClose }) => {
  const [facing, setFacing] = useState('front');
  const [permission, requestPermission] = useCameraPermissions();
  const [isCapturing, setIsCapturing] = useState(false);
  const [capturedImage, setCapturedImage] = useState(null);
  const [cameraReady, setCameraReady] = useState(false);
  
  const cameraRef = useRef(null);

  useEffect(() => {
    if (permission && !permission.granted) {
      requestPermission();
    }
  }, [permission]);

  const takePicture = async () => {
    if (!cameraRef.current || isCapturing) return;
    
    setIsCapturing(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.1, // 10% quality - rất thấp
        base64: true,
        skipProcessing: false, // Cho phép xử lý để nén tốt hơn
        exif: false
      });
      
      console.log(`📸 Captured image size: ${photo.base64.length} characters (${Math.round(photo.base64.length/1024)}KB)`);
      
      setCapturedImage(photo);
      onPictureTaken(photo);
    } catch (error) {
      console.error('Lỗi chụp ảnh:', error);
      Alert.alert('Lỗi', 'Không thể chụp ảnh. Vui lòng thử lại.');
    } finally {
      setIsCapturing(false);
    }
  };


  if (!permission) {
    return <View />;
  }

  if (!permission.granted) {
    return (
      <View style={internalCameraStyles.permissionContainer}>
        <Text style={internalCameraStyles.permissionText}>Cần quyền truy cập camera</Text>
        <Button onPress={requestPermission} title="Cấp quyền" />
      </View>
    );
  }



  const toggleCameraType = () => {
    setFacing(current => {
       // Đảm bảo chuyển đổi đúng giá trị
      const newFacing = current === 'back' ? 'front' : 'back';
      console.log('Chuyển camera từ', current, 'sang', newFacing);
      return newFacing;
  });
  };
   const handleCameraReady = () => {
    console.log('Camera đã sẵn sàng, loại camera:', facing);
    setCameraReady(true);
  };

  const handleClose = () => {
    setCapturedImage(null);
    if (onClose) onClose();
  };
 const cameraType = facing === 'front' ? 'front' : 'back';
  return (
    <View style={internalCameraStyles.container}>
      <CameraView
        ref={cameraRef} 
        style={internalCameraStyles.camera} 
        facing={cameraType}
        onCameraReady={handleCameraReady}
        ratio="16:9"
      >
        <View style={internalCameraStyles.header}>
          <TouchableOpacity style={internalCameraStyles.closeBtn} onPress={handleClose}>
            <Icon name="close" size={32} color="#fff" />
          </TouchableOpacity>
          
          {/* Hiển thị loại camera hiện tại */}
          <View style={internalCameraStyles.cameraTypeIndicator}>
            <Text style={internalCameraStyles.cameraTypeText}>
              Camera {facing === 'front' ? 'Trước' : 'Sau'}
            </Text>
          </View>
        </View>

        <View style={internalCameraStyles.footer}>
          <TouchableOpacity 
            style={internalCameraStyles.flipBtn} 
            onPress={toggleCameraType}
            disabled={!cameraReady}
          >
            <Icon name="camera-flip" size={28} color="#fff" />
            <Text style={internalCameraStyles.flipText}>Đổi camera</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[
              internalCameraStyles.captureBtn,
              (!cameraReady || isCapturing) && internalCameraStyles.captureBtnDisabled
            ]} 
            onPress={takePicture}
            disabled={!cameraReady || isCapturing}
          >
            <View style={internalCameraStyles.captureInnerCircle}>
              {isCapturing ? (
                <ActivityIndicator size="small" color="#000" />
              ) : (
                <Icon name="camera" size={30} color="#000" />
              )}
            </View>
          </TouchableOpacity>

        </View>


        {/* Simple Attendance Camera Status */}
        <View style={internalCameraStyles.statusIndicator}>
          <Text style={internalCameraStyles.statusText}>
            📸 Camera sẵn sàng - Chụp ảnh để chấm công đơn giản
          </Text>
          {isCapturing && (
            <Text style={internalCameraStyles.capturingText}>
              Đang chụp ảnh...
            </Text>
          )}
        </View>

        {!cameraReady && (
          <View style={internalCameraStyles.loadingOverlay}>
            <ActivityIndicator size="large" color="#fff" />
            <Text style={internalCameraStyles.loadingText}>Đang khởi động camera...</Text>
          </View>
        )}

        {isCapturing && (
          <View style={internalCameraStyles.capturingOverlay}>
            <ActivityIndicator size="large" color="#fff" />
            <Text style={internalCameraStyles.loadingText}>Đang chụp ảnh...</Text>
          </View>
        )}
      </CameraView>

      {capturedImage && (
        <View style={internalCameraStyles.previewContainer}>
          <Image source={{ uri: capturedImage }} style={internalCameraStyles.previewImage} />
          <Text style={internalCameraStyles.previewText}>Ảnh đã chụp</Text>
        </View>
      )}
    </View>
  );
};

const internalCameraStyles = StyleSheet.create({
 container: { 
    flex: 1, 
    backgroundColor: '#000' 
  },
  camera: { 
    flex: 1 
  },
  header: {
    position: 'absolute',
    top: 50,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    zIndex: 1
  },
  footer: {
    position: 'absolute',
    bottom: 40,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    zIndex: 1
  },
  permissionContainer: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center', 
    padding: 20,
    backgroundColor: '#fff'
  },
  permissionText: { 
    textAlign: 'center', 
    marginBottom: 20, 
    fontSize: 16,
    color: '#333'
  },
  closeBtn: { 
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 20,
    padding: 8
  },
  cameraTypeIndicator: {
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 15,
    paddingHorizontal: 12,
    paddingVertical: 6
  },
  cameraTypeText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold'
  },
  captureBtn: { 
    alignSelf: 'center' 
  },
  captureBtnDisabled: {
    opacity: 0.5
  },
  captureInnerCircle: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: 'rgba(255,255,255,0.5)'
  },
  flipBtn: { 
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 20,
    padding: 8,
    alignItems: 'center'
  },
  flipText: {
    color: '#fff',
    fontSize: 10,
    marginTop: 4
  },
  loadingOverlay: { 
    ...StyleSheet.absoluteFillObject, 
    backgroundColor: 'rgba(0,0,0,0.7)', 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  capturingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)', 
    justifyContent: 'center', 
    alignItems: 'center'
  },
  loadingText: { 
    color: '#fff', 
    marginTop: 12, 
    fontSize: 16 
  },
  previewContainer: { 
    position: 'absolute', 
    bottom: 130, 
    right: 20, 
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
    padding: 10,
    borderRadius: 12
  },
  previewImage: { 
    width: 60, 
    height: 60, 
    borderRadius: 8, 
    borderWidth: 2, 
    borderColor: '#fff' 
  },
  previewText: { 
    color: '#fff', 
    fontSize: 12, 
    marginTop: 4 
  },
  detectionIndicator: {
    position: 'absolute',
    top: 100,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 20,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1
  },
  detectionText: {
    color: '#4caf50',
    fontSize: 14,
    marginLeft: 8,
    fontWeight: '500'
  },
  statusIndicator: {
    position: 'absolute',
    top: 150,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 20,
    padding: 12,
    alignItems: 'center',
    zIndex: 1
  },
  statusText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center'
  },
  countdownStatus: {
    color: '#ffeb3b',
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 4,
    textAlign: 'center'
  },
  disabledText: {
    color: '#ff9800',
    fontSize: 14,
    fontWeight: '500',
    marginTop: 4,
    textAlign: 'center'
  },
  capturingText: {
    color: '#4caf50',
    fontSize: 14,
    fontWeight: 'bold',
    marginTop: 4,
    textAlign: 'center'
  },
});

export default function CheckInScreen({ route }) {
  const { user } = useAuth();
  const navigation = useNavigation();
  const [location, setLocation] = useState(null);
  const [locationLoading, setLocationLoading] = useState(true);
  const [machines, setMachines] = useState([]);
  const [machinesLoading, setMachinesLoading] = useState(true);
  const [isWithinRadius, setIsWithinRadius] = useState(false);
  const [activeMachineName, setActiveMachineName] = useState('');
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [isFaceRecognitionOpen, setIsFaceRecognitionOpen] = useState(false);
  const [capturedImage, setCapturedImage] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('testing');
  const [selectedShift, setSelectedShift] = useState(null);
  const [showShiftModal, setShowShiftModal] = useState(false);
  
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
      console.log('⚠️ No shifts found for today, showing all shifts as fallback');
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

  // Chuyển đổi tên ngày thành số
  const getDayOfWeekNumber = (dayName) => {
    if (!dayName) return -1;
    
    const days = {
      // Tiếng Việt
      'Chủ nhật': 0, 'chủ nhật': 0, 'CN': 0,
      'Thứ hai': 1, 'thứ hai': 1, 'Thứ 2': 1, 'thứ 2': 1, 'T2': 1,
      'Thứ ba': 2, 'thứ ba': 2, 'Thứ 3': 2, 'thứ 3': 2, 'T3': 2,
      'Thứ tư': 3, 'thứ tư': 3, 'Thứ 4': 3, 'thứ 4': 3, 'T4': 3,
      'Thứ năm': 4, 'thứ năm': 4, 'Thứ 5': 4, 'thứ 5': 4, 'T5': 4,
      'Thứ sáu': 5, 'thứ sáu': 5, 'Thứ 6': 5, 'thứ 6': 5, 'T6': 5,
      'Thứ bảy': 6, 'thứ bảy': 6, 'Thứ 7': 6, 'thứ 7': 6, 'T7': 6,
      
      // Tiếng Anh
      'Sunday': 0, 'sunday': 0, 'Sun': 0,
      'Monday': 1, 'monday': 1, 'Mon': 1,
      'Tuesday': 2, 'tuesday': 2, 'Tue': 2,
      'Wednesday': 3, 'wednesday': 3, 'Wed': 3,
      'Thursday': 4, 'thursday': 4, 'Thu': 4,
      'Friday': 5, 'friday': 5, 'Fri': 5,
      'Saturday': 6, 'saturday': 6, 'Sat': 6,
      
      // Số
      '0': 0, '1': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6
    };
    
    const result = days[dayName.trim()] ?? -1;
    console.log('🔄 Converting day:', dayName, '->', result);
    return result;
  };

  // Parse thời gian từ string (HH:mm) thành phút
  const parseTime = (timeString) => {
    const [hours, minutes] = timeString.split(':').map(Number);
    return hours * 60 + minutes;
  };

  const availableShifts = getTodayShifts();
  const currentTimeShifts = getCurrentTimeShifts();

  // Debug workShifts data
  useEffect(() => {
    console.log('🔍 Debug workShifts data:');
    console.log('📊 workShifts:', workShifts);
    console.log('📊 workShifts length:', workShifts?.length);
    console.log('📊 shiftsLoading:', shiftsLoading);
    console.log('📊 shiftsError:', shiftsError);
    
    if (workShifts && workShifts.length > 0) {
      console.log('📊 First shift example:', workShifts[0]);
      console.log('📊 First shift shiftDetails:', workShifts[0]?.shiftDetails);
      
      // Debug current day
      const currentDay = now.getDay();
      console.log('📅 Current day number:', currentDay);
      console.log('📅 Current day name:', ['Chủ nhật', 'Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy'][currentDay]);
      
      // Debug available shifts
      const todayShifts = getTodayShifts();
      console.log('📊 Today shifts:', todayShifts);
      console.log('📊 Today shifts length:', todayShifts.length);
      
      // Debug each shift's day mapping
      workShifts.forEach((shift, index) => {
        console.log(`📊 Shift ${index} (${shift.shiftName}):`);
        if (shift.shiftDetails) {
          shift.shiftDetails.forEach((detail, detailIndex) => {
            const dayNumber = getDayOfWeekNumber(detail.dayOfWeek);
            console.log(`  Detail ${detailIndex}: ${detail.dayOfWeek} -> ${dayNumber} (current: ${currentDay})`);
          });
        } else {
          console.log('  No shiftDetails');
        }
      });
    } else {
      console.log('❌ No workShifts data');
    }
  }, [workShifts, shiftsLoading, shiftsError]);

  useEffect(() => {
    const testServerConnection = async () => {
      console.log('🔍 Testing server connection...');
      
      // Bỏ qua test kết nối và đặt trạng thái connected
      // Mobile app sẽ test kết nối thực tế khi chấm công
      setConnectionStatus('connected');
      console.log('✅ Server connection assumed (will test on actual check-in)');
    };

    testServerConnection();
  }, []);

  useEffect(() => {
    const fetchLocation = async () => {
      setLocationLoading(true);
      try {
        Geolocation.getCurrentPosition(
          (position) => {
            setLocation({
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              accuracy: position.coords.accuracy,
              altitude: position.coords.altitude,
              altitudeAccuracy: position.coords.altitudeAccuracy,
              heading: position.coords.heading,
              speed: position.coords.speed,
            });
            setLocationLoading(false);
          },
          (error) => {
            console.error('Error fetching location:', error);
            Alert.alert('Lỗi', 'Không thể lấy vị trí');
            setLocationLoading(false);
          },
          { enableHighAccuracy: true, timeout: 20000, maximumAge: 1000 }
        );
      } catch (err) {
        console.error('Error fetching location:', err);
        Alert.alert('Lỗi', 'Không thể lấy vị trí');
        setLocationLoading(false);
      }
    };
    fetchLocation();
  }, []);

  useEffect(() => {
    const fetchMachines = async () => {
      setMachinesLoading(true);
      try {
        const data = await getAttendanceMachines();
        setMachines(data);
      } catch (err) {
        console.error('Error fetching machines:', err);
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
    const { imageBase64, recognitionResult } = data;
    
    if (!recognitionResult.success) {
      Alert.alert('Lỗi', 'Không thể nhận diện khuôn mặt');
      return;
    }

    console.log('✅ Face recognition successful:', recognitionResult);
    
    // Process check-in with face recognition
    await processCheckIn(imageBase64, recognitionResult);
  };

  const handlePictureTaken = async (photo) => {
    setIsCameraOpen(false);
    if (!photo || !photo.base64) {
      Alert.alert('Lỗi', 'Không thể lấy được ảnh đã xử lý.');
      return;
    }

    setCapturedImage(photo.uri);
    setUploadStatus(null);
    setIsUploading(true);
    
    // Process check-in with regular photo
    await processCheckIn(photo.base64);
  };

  const processCheckIn = async (imageBase64, recognitionResult = null) => {
    try {
      console.log('Bắt đầu chấm công...');
      
      // Kiểm tra kích thước ảnh trước khi gửi
      console.log(`📏 Check-in image size: ${imageBase64.length} characters (${Math.round(imageBase64.length/1024)}KB)`);
      
      // Sử dụng ảnh đã được nén từ camera với chất lượng thấp
      let finalBase64 = imageBase64;
      
      console.log(`📸 Final image size: ${finalBase64.length} characters (${Math.round(finalBase64.length/1024)}KB)`);
      
      // Log thông tin ảnh để debug
      if (finalBase64.length > 200000) { // 200KB warning
        console.log('⚠️ Image still large, but sending anyway for Simple Attendance API');
      } else {
        console.log('✅ Image size is acceptable for Simple Attendance API');
      }
      
      // Chuẩn bị dữ liệu chấm công theo đúng format API
      const currentDateTime = new Date().toISOString();
      const faceRecognitionInfo = recognitionResult ? 
        ` - Face Recognition: ${recognitionResult.employeeName} (Confidence: ${(recognitionResult.confidence * 100).toFixed(1)}%)` : 
        '';
      
      const checkInData = mode === 'checkin' ? {
        employeeId: user?.id || 'unknown-user',
        imageBase64: finalBase64,
        checkInDateTime: currentDateTime,
        latitude: location?.latitude || 0,
        longitude: location?.longitude || 0,
        location: activeMachineName || 'Unknown Location',
        attendanceMachineId: 2,
        notes: `Check-in from mobile app - Ca: ${selectedShift?.shiftName || 'Chưa chọn ca'}${faceRecognitionInfo}`
      } : {
        employeeId: user?.id || 'unknown-user',
        imageBase64: finalBase64,
        checkOutDateTime: currentDateTime,
        latitude: location?.latitude || 0,
        longitude: location?.longitude || 0,
        location: activeMachineName || 'Unknown Location',
        notes: `Check-out from mobile app - Ca: ${selectedShift?.shiftName || 'Chưa chọn ca'}${faceRecognitionInfo}`
      };

      // Validation dữ liệu cho Simple Attendance API
      if (!checkInData.employeeId) {
        throw new Error('employeeId is required');
      }
      if (!checkInData.imageBase64) {
        throw new Error('imageBase64 is required');
      }
      if (checkInData.imageBase64.length < 100) {
        throw new Error('imageBase64 too small, please retake photo');
      }
      console.log('👤 Current user:', user);
      console.log('🆔 User ID:', user?.id);
      console.log('📧 User Email:', user?.email);
      console.log('👤 User Full Name:', user?.fullName);
      
      if (!user?.id) {
        throw new Error('Vui lòng đăng nhập để chấm công');
      }
      
      if (!selectedShift) {
        throw new Error('Vui lòng chọn ca làm việc trước khi chấm công');
      }
      
      // Cảnh báo nếu chọn ca không phù hợp với thời gian hiện tại
      const isCurrentTime = currentTimeShifts.some(s => s.id === selectedShift.id);
      if (!isCurrentTime) {
        console.log('⚠️ Warning: Selected shift is not current time shift');
      }

      console.log('📤 Sending check-in data:', {
        mode: mode,
        employeeId: checkInData.employeeId,
        imageSize: checkInData.imageBase64.length,
        latitude: checkInData.latitude,
        longitude: checkInData.longitude,
        location: checkInData.location,
        checkInDateTime: checkInData.checkInDateTime,
        checkOutDateTime: checkInData.checkOutDateTime,
        notes: checkInData.notes
      });
      
      console.log('📋 Full checkInData object:', JSON.stringify(checkInData, null, 2));

      // Gửi dữ liệu chấm công lên Simple Attendance API với fallback
      let response;
      let workingUrl = null;
      
      // Chọn API endpoint dựa trên mode
      const apiEndpoint = mode === 'checkin' ? 'checkin' : 'checkout';
      const urls = [
        `https://xaydungvipro.id.vn/api/Attendance/${apiEndpoint}`
      ];
      
      for (const url of urls) {
        try {
          console.log(`Trying check-in URL: ${url}`);
          response = await fetch(url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(checkInData)
          });
          
          if (response.ok) {
            workingUrl = url;
            console.log(`✅ Check-in successful with URL: ${url}`);
            const result = await response.json();
            console.log('📥 Response data:', result);
            break;
          } else {
            console.log(`⚠️ Check-in response with URL: ${url}, status: ${response.status}`);
            const errorText = await response.text();
            console.log(`⚠️ Response text: ${errorText}`);
            
            // Kiểm tra nếu là lỗi business logic (400) nhưng có thể đã lưu dữ liệu
            if (response.status === 400) {
              try {
                const errorData = JSON.parse(errorText);
                if (errorData.message && errorData.message.includes('đã chấm công')) {
                  // Đây là trường hợp đã chấm công rồi, coi như thành công
                  workingUrl = url;
                  console.log(`✅ Check-in already done, treating as success`);
                  break;
                }
              } catch (parseError) {
                console.log('Could not parse error response as JSON');
              }
            }
          }
        } catch (error) {
          console.log(`❌ Check-in error with URL: ${url}, error: ${error.message}`);
        }
      }
      
      if (!workingUrl) {
        throw new Error('Không thể kết nối đến máy chấm công');
      }

      // Nếu có workingUrl thì đã thành công
      let result;
      try {
        result = await response.json();
      } catch (jsonError) {
        // Nếu không parse được JSON, tạo response giả
        result = { message: 'Check-in thành công' };
      }
      
      console.log('✅ Check-in thành công! Response:', result);
      console.log('🎯 Mode:', mode, '- Sẽ navigate về trang chủ...');
      
      // Kiểm tra nếu là trường hợp đã chấm công
      const isAlreadyCheckedIn = result.message && result.message.includes('đã chấm công');
      
      setUploadStatus('success');
      Alert.alert(
        isAlreadyCheckedIn ? 'Thông báo' : 'Thành công', 
        isAlreadyCheckedIn 
          ? `Bạn đã chấm công vào hôm nay!\nThời gian: ${new Date().toLocaleString('vi-VN')}`
          : `${mode === 'checkin' ? 'Check-in' : 'Check-out'} thành công!\nThời gian: ${new Date().toLocaleString('vi-VN')}`,
        [
          {
            text: 'OK',
            onPress: () => {
              // Reset captured image after successful check-in
              setTimeout(async () => {
                setCapturedImage(null);
                setUploadStatus(null);
                // Cập nhật trạng thái checkin trong AsyncStorage
                try {
                  const today = new Date().toDateString();
                  const newStatus = mode === 'checkin' ? true : false;
                  const checkinData = {
                    checkedIn: newStatus,
                    timestamp: new Date().toISOString(),
                    checkInTime: mode === 'checkin' ? new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false }) : null,
                    checkOutTime: mode === 'checkout' ? new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false }) : null
                  };
                  await AsyncStorage.setItem(`checkin_${today}`, JSON.stringify(checkinData));
                  console.log('✅ Updated AsyncStorage checkin status:', checkinData);
                } catch (error) {
                  console.error('Error updating checkin status:', error);
                }
                
                // Quay lại trang chủ sau khi thành công
                console.log('🔄 Navigating back to home...');
                try {
                  // Sử dụng replace thay vì back để đảm bảo quay về trang chủ
                  navigation.replace('(tabs)');
                } catch (error) {
                  console.error('Navigation error:', error);
                  // Fallback: navigate to home tab
                  navigation.navigate('(tabs)');
                }
              }, 1000);
            }
          }
        ]
      );
    } catch (error) {
      console.error('Check-in Error:', error);
      setUploadStatus('error');
      
      // Kiểm tra loại lỗi
      if (error.code === 'NETWORK_ERROR' || error.message.includes('Network Error') || error.message.includes('404') || error.message.includes('Không thể kết nối đến máy chấm công đơn giản')) {
        Alert.alert(
          'Lỗi kết nối',
          'Không thể kết nối đến máy chấm công đơn giản. Vui lòng kiểm tra:\n1. Kết nối mạng\n2. Server đang hoạt động\n3. Thử lại sau',
          [
            {
              text: 'Thử lại',
              onPress: () => {
                // Retry logic có thể thêm ở đây
              }
            },
            {
              text: 'OK',
              style: 'cancel'
            }
          ]
        );
      } else {
        Alert.alert('Lỗi', 'Không thể kết nối đến hệ thống chấm công đơn giản.');
      }
    } finally {
      setIsUploading(false);
    }
  };


  const renderWorkshiftItem = ({ item }) => (
    <View style={styles.shiftItem}>
      <Text style={styles.shiftName}>{item.shiftName}</Text>
      {item.shiftDetails && item.shiftDetails.map(detail => (
        <Text key={detail.id} style={styles.shiftDetail}>
          {detail.dayOfWeek}: {detail.startTime} - {detail.endTime}
        </Text>
      ))}
    </View>
  );

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
            <Text style={styles.userName}>Nguyễn Trần Trí Tâm</Text>
            <Text style={styles.userRole}>Nhân viên</Text>
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
            <MapPlaceholder
              latitude={location.latitude}
              longitude={location.longitude}
              markers={machines.map((machine, index) => ({
                latitude: parseFloat(machine.latitude),
                longitude: parseFloat(machine.longitude),
                title: machine.attendanceMachineName,
                color: machine.attendanceMachineName === activeMachineName ? 'green' : 'red'
              }))}
              style={styles.mapImg}
              activeMachineName={activeMachineName}
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

      {/* Connection Status */}
      {connectionStatus === 'testing' && (
        <View style={styles.connectionStatusBox}>
          <ActivityIndicator size="small" color="#f59e0b" />
          <Text style={styles.connectionStatusText}>Đang kiểm tra kết nối server...</Text>
        </View>
      )}

      {connectionStatus === 'failed' && (
        <View style={styles.connectionErrorBox}>
          <Icon name="wifi-off" size={20} color="#ef4444" />
          <Text style={styles.connectionErrorText}>Không thể kết nối đến server</Text>
        </View>
      )}

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
        <Text style={styles.shiftSelectionTitle}>Chọn ca làm việc</Text>
        <Text style={styles.shiftSelectionSubtitle}>
          Ca làm việc hôm nay ({date})
        </Text>
        
        {shiftsLoading ? (
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
              
              return (
                <TouchableOpacity
                  key={shift.id}
                  style={[
                    styles.shiftItem,
                    isSelected && styles.shiftItemSelected,
                    isCurrentTime && !isSelected && styles.shiftItemCurrentTime
                  ]}
                  onPress={() => setSelectedShift(shift)}
                >
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
                          <Text style={styles.currentTimeText}>Hiện tại</Text>
                        </View>
                      )}
                    </View>
                    {shift.shiftDetails && shift.shiftDetails
                      .filter(detail => {
                        const dayOfWeek = getDayOfWeekNumber(detail.dayOfWeek);
                        return dayOfWeek === now.getDay();
                      })
                      .map((detail, index) => (
                        <Text key={index} style={[
                          styles.shiftDetail,
                          isSelected && styles.shiftDetailSelected,
                          isCurrentTime && !isSelected && styles.shiftDetailCurrentTime
                        ]}>
                          {detail.startTime.substring(0, 5)} - {detail.endTime.substring(0, 5)}
                        </Text>
                      ))}
                    {/* Hiển thị tất cả ngày trong tuần nếu không có ca nào phù hợp với ngày hiện tại */}
                    {shift.shiftDetails && shift.shiftDetails
                      .filter(detail => {
                        const dayOfWeek = getDayOfWeekNumber(detail.dayOfWeek);
                        return dayOfWeek !== now.getDay();
                      })
                      .map((detail, index) => (
                        <Text key={`all-${index}`} style={[
                          styles.shiftDetail,
                          styles.shiftDetailOtherDay
                        ]}>
                          {detail.dayOfWeek}: {detail.startTime.substring(0, 5)} - {detail.endTime.substring(0, 5)}
                        </Text>
                      ))}
                  </View>
                  {isSelected && (
                    <Icon name="check-circle" size={24} color="#10b981" />
                  )}
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
            style={[styles.cameraBtn, isCheckInDisabled && styles.cameraBtnDisabled]} 
            disabled={isCheckInDisabled} 
            onPress={() => setIsCameraOpen(true)}
            activeOpacity={0.8}
          >
            <View style={[
              styles.cameraBtnGradient,
              { backgroundColor: isCheckInDisabled ? '#94a3b8' : '#3498db' }
            ]}>
              <Icon name="camera" size={32} color="#fff" />
              <Text style={styles.cameraBtnText}>{mode === 'checkin' ? 'Chấm công vào' : 'Chấm công ra'}</Text>
            </View>
          </TouchableOpacity>

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

      <Modal animationType="slide" transparent={false} visible={isCameraOpen} onRequestClose={() => setIsCameraOpen(false)}>
        <InternalCameraCheckIn 
          onPictureTaken={handlePictureTaken} 
          onClose={() => setIsCameraOpen(false)} 
        />
      </Modal>

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
  },
  mapImg: { width: '100%', height: 140 },
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
  connectionStatusBox: {
    marginHorizontal: 16,
    marginTop: 16,
    backgroundColor: '#fff3cd',
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#fbbf24',
  },
  connectionStatusText: {
    color: '#92400e',
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 8,
  },
  connectionErrorBox: {
    marginHorizontal: 16,
    marginTop: 16,
    backgroundColor: '#fef2f2',
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#fca5a5',
  },
  connectionErrorText: {
    color: '#dc2626',
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 8,
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
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    gap: 12,
  },
  faceBtn: { 
    flex: 1,
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
    backgroundColor: '#fff',
    padding: 8,
    marginVertical: 2,
    borderRadius: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  shiftItemSelected: {
    borderColor: '#10b981',
    backgroundColor: '#f0fdf4',
  },
  shiftInfo: {
    flex: 1,
  },
  shiftName: {
    fontWeight: 'bold',
    fontSize: 14,
    color: '#333',
  },
  shiftNameSelected: {
    color: '#10b981',
  },
  shiftDetail: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  shiftDetailSelected: {
    color: '#059669',
  },
  shiftSelectionBox: {
    marginHorizontal: 16,
    marginTop: 12,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  shiftSelectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 4,
  },
  shiftSelectionSubtitle: {
    fontSize: 12,
    color: '#3498db',
    marginBottom: 8,
    fontWeight: '500',
  },
  shiftHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  currentTimeBadge: {
    backgroundColor: '#3498db',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  currentTimeText: {
    fontSize: 12,
    color: '#fff',
    fontWeight: 'bold',
  },
  shiftItemCurrentTime: {
    borderColor: '#3498db',
    backgroundColor: '#e3f2fd',
  },
  shiftNameCurrentTime: {
    color: '#3498db',
  },
  shiftDetailCurrentTime: {
    color: '#2980b9',
  },
  shiftDetailOtherDay: {
    color: '#94a3b8',
    fontStyle: 'italic',
  },
  shiftList: {
    marginTop: 8,
  },
  shiftScrollContainer: {
    maxHeight: 120, // Chiều cao tối đa cho 2 ca (mỗi ca ~50px + margin)
    marginTop: 8,
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