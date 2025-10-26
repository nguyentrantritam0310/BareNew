import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Alert,
  ActivityIndicator,
  Image,
  TextInput,
  Modal
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import faceRecognitionService from '../services/faceRecognitionService';

const FaceRegistrationScreen = ({ navigation }) => {
  const [facing, setFacing] = useState('front');
  const [permission, requestPermission] = useCameraPermissions();
  const [isCapturing, setIsCapturing] = useState(false);
  const [capturedImage, setCapturedImage] = useState(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [employeeId, setEmployeeId] = useState('');
  const [employeeName, setEmployeeName] = useState('');
  const [showCamera, setShowCamera] = useState(false);
  
  const cameraRef = useRef(null);

  const toggleCameraType = () => {
    setFacing(current => (current === 'back' ? 'front' : 'back'));
  };

  const takePicture = async () => {
    if (!cameraRef.current || isCapturing || !cameraReady) return;
    
    setIsCapturing(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.8,
        base64: true,
        skipProcessing: true
      });
      
      setCapturedImage(photo.uri);
      setShowCamera(false);
    } catch (error) {
      console.error('Lỗi khi chụp ảnh:', error);
      Alert.alert('Lỗi', 'Không thể chụp ảnh');
    } finally {
      setIsCapturing(false);
    }
  };

  const handleRegisterFace = async () => {
    if (!capturedImage || !employeeId.trim()) {
      Alert.alert('Lỗi', 'Vui lòng nhập ID nhân viên và chụp ảnh khuôn mặt');
      return;
    }

    setIsUploading(true);
    try {
      // Convert image to base64
      const response = await fetch(capturedImage);
      const blob = await response.blob();
      const base64 = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result.split(',')[1]);
        reader.readAsDataURL(blob);
      });

      const result = await faceRecognitionService.registerFace(employeeId.trim(), base64);
      
      if (result.success) {
        Alert.alert(
          'Thành công', 
          `Đăng ký khuôn mặt thành công cho nhân viên ${employeeId}`,
          [
            {
              text: 'OK',
              onPress: () => {
                // Reset form
                setCapturedImage(null);
                setEmployeeId('');
                setEmployeeName('');
              }
            }
          ]
        );
      } else {
        Alert.alert('Thất bại', result.message || 'Không thể đăng ký khuôn mặt');
      }
    } catch (error) {
      console.error('Lỗi khi đăng ký:', error);
      Alert.alert('Lỗi', 'Có lỗi xảy ra khi đăng ký khuôn mặt');
    } finally {
      setIsUploading(false);
    }
  };

  const CameraModal = () => (
    <Modal
      animationType="slide"
      transparent={false}
      visible={showCamera}
      onRequestClose={() => setShowCamera(false)}
    >
      <View style={styles.cameraContainer}>
        <CameraView
          ref={cameraRef}
          style={styles.camera}
          facing={facing}
          onCameraReady={() => setCameraReady(true)}
          ratio="16:9"
        >
          <View style={styles.cameraHeader}>
            <TouchableOpacity 
              style={styles.closeBtn} 
              onPress={() => setShowCamera(false)}
            >
              <Icon name="close" size={32} color="#fff" />
            </TouchableOpacity>
            
            <View style={styles.cameraTypeIndicator}>
              <Text style={styles.cameraTypeText}>
                Camera {facing === 'front' ? 'Trước' : 'Sau'}
              </Text>
            </View>
          </View>

          <View style={styles.cameraFooter}>
            <TouchableOpacity 
              style={styles.flipBtn} 
              onPress={toggleCameraType}
              disabled={!cameraReady}
            >
              <Icon name="camera-flip" size={28} color="#fff" />
              <Text style={styles.flipText}>Đổi camera</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[
                styles.captureBtn,
                (!cameraReady || isCapturing) && styles.captureBtnDisabled
              ]} 
              onPress={takePicture}
              disabled={!cameraReady || isCapturing}
            >
              <View style={styles.captureInnerCircle}>
                {isCapturing ? (
                  <ActivityIndicator size="small" color="#000" />
                ) : (
                  <Icon name="camera" size={30} color="#000" />
                )}
              </View>
            </TouchableOpacity>

            <View style={{ width: 40 }} />
          </View>

          {!cameraReady && (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="large" color="#fff" />
              <Text style={styles.loadingText}>Đang khởi động camera...</Text>
            </View>
          )}

          {isCapturing && (
            <View style={styles.capturingOverlay}>
              <ActivityIndicator size="large" color="#fff" />
              <Text style={styles.loadingText}>Đang chụp ảnh...</Text>
            </View>
          )}
        </CameraView>
      </View>
    </Modal>
  );

  if (!permission) {
    return <View />;
  }

  if (!permission.granted) {
    return (
      <View style={styles.permissionContainer}>
        <Text style={styles.permissionText}>Cần quyền truy cập camera để đăng ký khuôn mặt</Text>
        <TouchableOpacity style={styles.permissionBtn} onPress={requestPermission}>
          <Text style={styles.permissionBtnText}>Cấp quyền</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backBtn} 
          onPress={() => navigation?.goBack?.()}
        >
          <Icon name="arrow-left" size={28} color="#008080" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>ĐĂNG KÝ KHUÔN MẶT</Text>
        <View style={{ width: 28 }} />
      </View>

      <View style={styles.content}>
        <Text style={styles.sectionTitle}>Thông tin nhân viên</Text>
        
        <View style={styles.inputContainer}>
          <Text style={styles.inputLabel}>ID Nhân viên *</Text>
          <TextInput
            style={styles.input}
            value={employeeId}
            onChangeText={setEmployeeId}
            placeholder="Nhập ID nhân viên"
            autoCapitalize="none"
          />
        </View>

        <View style={styles.inputContainer}>
          <Text style={styles.inputLabel}>Tên nhân viên</Text>
          <TextInput
            style={styles.input}
            value={employeeName}
            onChangeText={setEmployeeName}
            placeholder="Nhập tên nhân viên"
          />
        </View>

        <Text style={styles.sectionTitle}>Chụp ảnh khuôn mặt</Text>
        
        {!capturedImage ? (
          <TouchableOpacity 
            style={styles.cameraButton}
            onPress={() => setShowCamera(true)}
          >
            <Icon name="camera" size={48} color="#008080" />
            <Text style={styles.cameraButtonText}>Chụp ảnh khuôn mặt</Text>
            <Text style={styles.cameraButtonSubtext}>
              Đảm bảo khuôn mặt rõ ràng, đủ ánh sáng
            </Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.imagePreview}>
            <Image source={{ uri: capturedImage }} style={styles.previewImage} />
            <View style={styles.imageActions}>
              <TouchableOpacity 
                style={styles.retakeBtn}
                onPress={() => {
                  setCapturedImage(null);
                  setShowCamera(true);
                }}
              >
                <Icon name="camera" size={20} color="#008080" />
                <Text style={styles.retakeBtnText}>Chụp lại</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        <TouchableOpacity 
          style={[
            styles.registerBtn,
            (!capturedImage || !employeeId.trim() || isUploading) && styles.registerBtnDisabled
          ]}
          onPress={handleRegisterFace}
          disabled={!capturedImage || !employeeId.trim() || isUploading}
        >
          {isUploading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Icon name="face-recognition" size={24} color="#fff" />
          )}
          <Text style={styles.registerBtnText}>
            {isUploading ? 'Đang đăng ký...' : 'Đăng ký khuôn mặt'}
          </Text>
        </TouchableOpacity>

        <View style={styles.instructions}>
          <Text style={styles.instructionTitle}>Hướng dẫn:</Text>
          <Text style={styles.instructionText}>
            • Nhìn thẳng vào camera{'\n'}
            • Đảm bảo khuôn mặt rõ ràng{'\n'}
            • Tránh ánh sáng quá mạnh hoặc quá yếu{'\n'}
            • Không đeo kính râm hoặc che khuôn mặt
          </Text>
        </View>
      </View>

      <CameraModal />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f6f8fa'
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderColor: '#e0e0e0'
  },
  backBtn: {
    padding: 4
  },
  headerTitle: {
    color: '#008080',
    fontWeight: 'bold',
    fontSize: 20,
    textAlign: 'center',
    flex: 1
  },
  content: {
    flex: 1,
    padding: 16
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
    marginTop: 16
  },
  inputContainer: {
    marginBottom: 16
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#555',
    marginBottom: 8
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#fff'
  },
  cameraButton: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 32,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#e0e0e0',
    borderStyle: 'dashed'
  },
  cameraButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#008080',
    marginTop: 12
  },
  cameraButtonSubtext: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
    textAlign: 'center'
  },
  imagePreview: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center'
  },
  previewImage: {
    width: 200,
    height: 200,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#e0e0e0'
  },
  imageActions: {
    marginTop: 16,
    flexDirection: 'row',
    justifyContent: 'center'
  },
  retakeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f8f8',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#008080'
  },
  retakeBtnText: {
    marginLeft: 8,
    color: '#008080',
    fontWeight: '600'
  },
  registerBtn: {
    backgroundColor: '#008080',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24
  },
  registerBtnDisabled: {
    backgroundColor: '#ccc'
  },
  registerBtnText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 8
  },
  instructions: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginTop: 24
  },
  instructionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8
  },
  instructionText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20
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
  permissionBtn: {
    backgroundColor: '#008080',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8
  },
  permissionBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold'
  },
  cameraContainer: {
    flex: 1,
    backgroundColor: '#000'
  },
  camera: {
    flex: 1
  },
  cameraHeader: {
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
  cameraFooter: {
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
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center'
  },
  capturingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center'
  },
  loadingText: {
    color: '#fff',
    marginTop: 12,
    fontSize: 16
  }
});

export default FaceRegistrationScreen;


