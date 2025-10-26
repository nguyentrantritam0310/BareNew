import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  SafeAreaView,
  ScrollView,
  ActivityIndicator,
  Image,
  Modal,
  Dimensions,
} from 'react-native';
import { Camera, useCameraDevices } from 'react-native-vision-camera';
// import MLKitFaceDetection from '@react-native-ml-kit/face-detection';
// import * as faceapi from 'face-api.js';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useAuth } from '../contexts/AuthContext';
import CustomHeader from '../components/CustomHeader';
import { useNavigation } from '@react-navigation/native';
import api from '../api';

const { width: screenWidth } = Dimensions.get('window');

const FaceRegistrationScreen = () => {
  const { user } = useAuth();
  const navigation = useNavigation();
  const devices = useCameraDevices();
  const device = devices.find(d => d.position === 'front');
  
  const [isCapturing, setIsCapturing] = useState(false);
  const [capturedImage, setCapturedImage] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState(null);
  const [faceRegistrations, setFaceRegistrations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [hasPermission, setHasPermission] = useState(false);
  const [faceDetected, setFaceDetected] = useState(false);
  const [faceData, setFaceData] = useState(null);
  const [canCapture, setCanCapture] = useState(false);
  const [autoCaptureEnabled, setAutoCaptureEnabled] = useState(false);
  
  const cameraRef = useRef(null);

  // Face detection constants
  const MIN_FACE_SIZE = 0.1; // Minimum face size relative to frame
  const MAX_HEAD_ANGLE = 15; // Maximum head rotation angle in degrees

  useEffect(() => {
    loadFaceRegistrations();
    checkCameraPermission();
  }, []);

  const checkCameraPermission = async () => {
    try {
      const permission = await Camera.requestCameraPermission();
      setHasPermission(permission === 'granted');
    } catch (error) {
      console.error('Camera permission error:', error);
      setHasPermission(false);
    }
  };

  const loadFaceRegistrations = async () => {
    try {
      setLoading(true);
      const response = await api.get('/FaceRegistration/my-faces');
      setFaceRegistrations(response.data);
    } catch (error) {
      console.error('Error loading face registrations:', error);
      // Don't show alert for 404, just log it
      if (error.response?.status !== 404) {
        Alert.alert('Lỗi', 'Không thể tải danh sách khuôn mặt đã đăng ký');
      }
    } finally {
      setLoading(false);
    }
  };


  const processFaceRegistration = async (imageBase64, faceFeatures = null) => {
    try {
      setIsUploading(true);
      setUploadStatus(null);

      const requestData = {
        employeeId: user?.id,
        imageBase64: imageBase64,
        notes: `Đăng ký khuôn mặt - ${new Date().toLocaleString('vi-VN')}`,
        faceFeatures: faceFeatures,
        faceQuality: faceFeatures ? calculateFaceQuality(faceFeatures) : null
      };

      console.log('📤 Sending face registration request...');
      const response = await api.post('/FaceRegistration/register', requestData);
      
      if (response.data.success) {
        setUploadStatus('success');
        Alert.alert(
          'Thành công',
          `Đăng ký khuôn mặt thành công!\nConfidence: ${(response.data.confidence * 100).toFixed(1)}%`,
          [
            {
              text: 'OK',
              onPress: () => {
                setCapturedImage(null);
                setUploadStatus(null);
                loadFaceRegistrations(); // Reload list
              }
            }
          ]
        );
      } else {
        setUploadStatus('error');
        Alert.alert('Lỗi', response.data.message || 'Không thể đăng ký khuôn mặt');
      }
    } catch (error) {
      console.error('Face registration error:', error);
      setUploadStatus('error');
      
      if (error.response?.data?.message) {
        Alert.alert('Lỗi', error.response.data.message);
      } else {
        Alert.alert('Lỗi', 'Không thể kết nối đến server');
      }
    } finally {
      setIsUploading(false);
    }
  };

  const deleteFaceRegistration = async (id) => {
    Alert.alert(
      'Xác nhận xóa',
      'Bạn có chắc chắn muốn xóa khuôn mặt này?',
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Xóa',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/FaceRegistration/${id}`);
              Alert.alert('Thành công', 'Xóa khuôn mặt thành công');
              loadFaceRegistrations();
            } catch (error) {
              console.error('Delete error:', error);
              Alert.alert('Lỗi', 'Không thể xóa khuôn mặt');
            }
          }
        }
      ]
    );
  };


  const renderFaceRegistrationItem = ({ item }) => (
    <View style={styles.registrationItem}>
      <View style={styles.registrationInfo}>
        <Text style={styles.registrationId}>ID: {item.faceId}</Text>
        <Text style={styles.registrationDate}>
          Đăng ký: {new Date(item.registeredDate).toLocaleString('vi-VN')}
        </Text>
        <Text style={styles.registrationConfidence}>
          Confidence: {(item.confidence * 100).toFixed(1)}%
        </Text>
        {item.notes && (
          <Text style={styles.registrationNotes}>Ghi chú: {item.notes}</Text>
        )}
      </View>
      <TouchableOpacity
        style={styles.deleteButton}
        onPress={() => deleteFaceRegistration(item.id)}
      >
        <Icon name="delete" size={20} color="#ef4444" />
      </TouchableOpacity>
    </View>
  );

  // Face quality validation
  const isGoodFaceQuality = (face) => {
    if (!face) return false;
    
    const { boundingBox, headEulerAngleX, headEulerAngleY, headEulerAngleZ } = face;
    
    // Check face size (not too small)
    const faceSize = boundingBox.width * boundingBox.height;
    if (faceSize < MIN_FACE_SIZE) return false;
    
    // Check head rotation angles
    if (Math.abs(headEulerAngleX) > MAX_HEAD_ANGLE) return false; // Up/down tilt
    if (Math.abs(headEulerAngleY) > MAX_HEAD_ANGLE) return false; // Left/right tilt
    if (Math.abs(headEulerAngleZ) > MAX_HEAD_ANGLE) return false; // Left/right rotation
    
    // Check face position in frame
    if (boundingBox.x < 0.1 || boundingBox.x > 0.9) return false;
    if (boundingBox.y < 0.1 || boundingBox.y > 0.9) return false;
    
    return true;
  };

  // Extract face features for registration/recognition
  const extractFaceFeatures = (face) => {
    if (!face) return null;
    
    return {
      boundingBox: face.boundingBox,
      landmarks: face.landmarks,
      contours: face.contours,
      headEulerAngleX: face.headEulerAngleX,
      headEulerAngleY: face.headEulerAngleY,
      headEulerAngleZ: face.headEulerAngleZ,
      leftEyeOpenProbability: face.leftEyeOpenProbability,
      rightEyeOpenProbability: face.rightEyeOpenProbability,
      smilingProbability: face.smilingProbability,
    };
  };

  // Calculate face quality score
  const calculateFaceQuality = (faceFeatures) => {
    if (!faceFeatures) return 0;
    
    let qualityScore = 100;
    
    // Deduct points for head rotation
    const angleX = Math.abs(faceFeatures.headEulerAngleX || 0);
    const angleY = Math.abs(faceFeatures.headEulerAngleY || 0);
    const angleZ = Math.abs(faceFeatures.headEulerAngleZ || 0);
    
    qualityScore -= (angleX + angleY + angleZ) * 2; // 2 points per degree
    
    // Deduct points for small face size
    const faceSize = faceFeatures.boundingBox?.width * faceFeatures.boundingBox?.height || 0;
    if (faceSize < 0.2) qualityScore -= 20;
    else if (faceSize < 0.3) qualityScore -= 10;
    
    // Bonus points for good eye openness
    const leftEyeOpen = faceFeatures.leftEyeOpenProbability || 0;
    const rightEyeOpen = faceFeatures.rightEyeOpenProbability || 0;
    const avgEyeOpen = (leftEyeOpen + rightEyeOpen) / 2;
    
    if (avgEyeOpen > 0.8) qualityScore += 10;
    else if (avgEyeOpen < 0.5) qualityScore -= 15;
    
    // Bonus points for smiling (optional)
    const smiling = faceFeatures.smilingProbability || 0;
    if (smiling > 0.7) qualityScore += 5;
    
    return Math.max(0, Math.min(100, qualityScore));
  };

  // Process face detection result
  const handleFaceDetected = (faces) => {
    if (faces && faces.length > 0) {
      const face = faces[0]; // Take the first detected face
      const isValidFace = isGoodFaceQuality(face);
      
      setFaceDetected(true);
      setFaceData(face);
      setCanCapture(isValidFace);
      
      // Auto capture if face quality is good and auto capture is enabled
      if (isValidFace && autoCaptureEnabled && !isCapturing && !isUploading) {
        console.log('Auto capturing face...');
        takePicture();
      }
      
      console.log('Face detected:', {
        isValid: isValidFace,
        size: face.boundingBox.width * face.boundingBox.height,
        angles: {
          x: face.headEulerAngleX,
          y: face.headEulerAngleY,
          z: face.headEulerAngleZ
        }
      });
    } else {
      setFaceDetected(false);
      setFaceData(null);
      setCanCapture(false);
    }
  };

  // Face detection using interval-based approach
  useEffect(() => {
    if (isCameraOpen && cameraRef.current) {
      const interval = setInterval(async () => {
        try {
          // Take a photo for face detection (low quality, fast)
          const photo = await cameraRef.current.takePhoto({
            qualityPrioritization: 'speed',
            flash: 'off',
            skipMetadata: true,
          });
          
          // Simulate face detection for testing UI
          const hasFace = Math.random() > 0.3; // 70% chance of detecting face
          
          if (hasFace) {
            const simulatedFace = {
              boundingBox: {
                x: 0.2 + Math.random() * 0.1,
                y: 0.2 + Math.random() * 0.1,
                width: 0.5 + Math.random() * 0.1,
                height: 0.6 + Math.random() * 0.1,
              },
              headEulerAngleX: Math.random() * 10 - 5,
              headEulerAngleY: Math.random() * 10 - 5,
              headEulerAngleZ: Math.random() * 10 - 5,
              landmarks: [],
              contours: [],
              leftEyeOpenProbability: 0.8 + Math.random() * 0.2,
              rightEyeOpenProbability: 0.8 + Math.random() * 0.2,
              smilingProbability: 0.7 + Math.random() * 0.3
            };
            
            handleFaceDetected([simulatedFace]);
          } else {
            handleFaceDetected([]);
          }
          
          // Clean up the temporary photo
          // Note: In production, you might want to delete the temp file
        } catch (error) {
          console.error('Face detection error:', error);
          handleFaceDetected([]);
        }
      }, 500); // Check every 500ms for more responsive detection
      
      return () => clearInterval(interval);
    }
  }, [isCameraOpen]);

  const openCamera = () => {
    if (!hasPermission) {
      Alert.alert('Permission Required', 'Camera permission is required to register face.');
      return;
    }
    if (!device) {
      Alert.alert('Camera Error', 'No camera device found.');
      return;
    }
    setIsCameraOpen(true);
    setFaceDetected(false);
  };

  const takePicture = async () => {
    if (!cameraRef.current) return;
    
    try {
      setIsCapturing(true);
      const photo = await cameraRef.current.takePhoto({
        qualityPrioritization: 'quality',
        flash: 'off',
      });
      
      console.log(`📸 Captured image path: ${photo.path}`);
      setCapturedImage(photo.path);
      setIsCameraOpen(false);
      
      // Process registration with file path
      await processFaceRegistrationFromFile(photo.path);
    } catch (error) {
      console.error('Take picture error:', error);
      Alert.alert('Error', 'Failed to take picture');
    } finally {
      setIsCapturing(false);
    }
  };

  const processFaceRegistrationFromFile = async (imagePath) => {
    try {
      setIsUploading(true);
      setUploadStatus(null);

      // For now, use a placeholder base64
      // In production, you would use react-native-fs or similar to read file
      const placeholderBase64 = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k=';
      
      // Extract face features from current face data
      const faceFeatures = faceData ? extractFaceFeatures(faceData) : null;
      
      await processFaceRegistration(placeholderBase64.split(',')[1], faceFeatures);
    } catch (error) {
      console.error('Process file error:', error);
      setUploadStatus('error');
      Alert.alert('Error', 'Failed to process image');
      setIsUploading(false);
    }
  };

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <CustomHeader title="ĐĂNG KÝ KHUÔN MẶT" />
        
        <ScrollView style={styles.scrollContainer} showsVerticalScrollIndicator={false}>
          {/* User Info */}
          <View style={styles.userInfoContainer}>
            <View style={styles.avatarContainer}>
              <Icon name="account-circle" size={48} color="#3498db" />
            </View>
            <View style={styles.userDetails}>
              <Text style={styles.userName}>{user?.fullName || 'Người dùng'}</Text>
              <Text style={styles.userEmail}>{user?.email}</Text>
            </View>
          </View>

          {/* Registration Button */}
          <TouchableOpacity
            style={styles.registerButton}
            onPress={() => setIsCameraOpen(true)}
            disabled={isUploading}
          >
            <View style={styles.registerButtonContent}>
              <Icon name="camera-plus" size={32} color="#fff" />
              <Text style={styles.registerButtonText}>
                {isUploading ? 'Đang xử lý...' : 'Đăng ký khuôn mặt mới'}
              </Text>
            </View>
          </TouchableOpacity>

          {/* Captured Image Preview */}
          {capturedImage && (
            <View style={styles.previewContainer}>
              <Image source={{ uri: capturedImage.uri }} style={styles.previewImage} />
              {isUploading && (
                <View style={styles.uploadOverlay}>
                  <ActivityIndicator size="large" color="#fff" />
                  <Text style={styles.uploadText}>Đang đăng ký...</Text>
                </View>
              )}
              {uploadStatus === 'success' && (
                <View style={styles.successOverlay}>
                  <Icon name="check-circle" size={48} color="#10b981" />
                  <Text style={styles.successText}>Thành công!</Text>
                </View>
              )}
              {uploadStatus === 'error' && (
                <View style={styles.errorOverlay}>
                  <Icon name="close-circle" size={48} color="#ef4444" />
                  <Text style={styles.errorText}>Lỗi!</Text>
                </View>
              )}
            </View>
          )}

          {/* Registered Faces List */}
          <View style={styles.listContainer}>
            <Text style={styles.listTitle}>Khuôn mặt đã đăng ký ({faceRegistrations.length}/5)</Text>
            
            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#3498db" />
                <Text style={styles.loadingText}>Đang tải...</Text>
              </View>
            ) : faceRegistrations.length > 0 ? (
              faceRegistrations.map((item, index) => (
                <View key={item.id} style={styles.registrationItem}>
                  <View style={styles.registrationInfo}>
                    <Text style={styles.registrationId}>ID: {item.faceId}</Text>
                    <Text style={styles.registrationDate}>
                      Đăng ký: {new Date(item.registeredDate).toLocaleString('vi-VN')}
                    </Text>
                    <Text style={styles.registrationConfidence}>
                      Confidence: {(item.confidence * 100).toFixed(1)}%
                    </Text>
                    {item.notes && (
                      <Text style={styles.registrationNotes}>Ghi chú: {item.notes}</Text>
                    )}
                  </View>
                  <TouchableOpacity
                    style={styles.deleteButton}
                    onPress={() => deleteFaceRegistration(item.id)}
                  >
                    <Icon name="delete" size={20} color="#ef4444" />
                  </TouchableOpacity>
                </View>
              ))
            ) : (
              <View style={styles.emptyContainer}>
                <Icon name="face-recognition" size={48} color="#94a3b8" />
                <Text style={styles.emptyText}>Chưa có khuôn mặt nào được đăng ký</Text>
                <Text style={styles.emptySubText}>Hãy đăng ký khuôn mặt đầu tiên của bạn</Text>
              </View>
            )}
          </View>
        </ScrollView>

        {/* Camera Modal */}
        <Modal
          visible={isCameraOpen}
          animationType="slide"
          onRequestClose={() => setIsCameraOpen(false)}
        >
          <View style={styles.cameraContainer}>
            {device && (
              <Camera
                ref={cameraRef}
                style={styles.camera}
                device={device}
                isActive={isCameraOpen}
                photo={true}
              >
                <View style={styles.cameraHeader}>
                  <TouchableOpacity 
                    style={styles.closeBtn} 
                    onPress={() => setIsCameraOpen(false)}
                  >
                    <Icon name="close" size={32} color="#fff" />
                  </TouchableOpacity>
                  
                  <View style={styles.faceIndicator}>
                    <View style={[
                      styles.faceIconContainer,
                      { backgroundColor: canCapture ? "rgba(34, 197, 94, 0.3)" : faceDetected ? "rgba(251, 191, 36, 0.3)" : "rgba(148, 163, 184, 0.3)" }
                    ]}>
                      <Icon 
                        name={canCapture ? "face-recognition" : faceDetected ? "face-recognition-outline" : "face-recognition-outline"} 
                        size={32} 
                        color={canCapture ? "#22c55e" : faceDetected ? "#f59e0b" : "#94a3b8"} 
                      />
                    </View>
                    <Text style={[
                      styles.faceIndicatorText,
                      { color: canCapture ? "#22c55e" : faceDetected ? "#f59e0b" : "#94a3b8" }
                    ]}>
                      {canCapture ? "✅ Sẵn sàng chụp ảnh" : faceDetected ? "⚠️ Điều chỉnh vị trí" : "🔍 Tìm khuôn mặt..."}
                    </Text>
                  </View>
                </View>

                {/* Face Detection Overlay */}
                {faceDetected && faceData && (
                  <View style={styles.faceOverlay}>
                    <View style={[
                      styles.faceFrame,
                      { 
                        backgroundColor: canCapture ? "rgba(34, 197, 94, 0.1)" : "rgba(251, 191, 36, 0.1)",
                        borderColor: canCapture ? "#22c55e" : "#f59e0b",
                        // Position based on actual face bounding box
                        left: faceData.boundingBox.x * screenWidth - 125,
                        top: faceData.boundingBox.y * screenWidth - 150,
                        width: faceData.boundingBox.width * screenWidth,
                        height: faceData.boundingBox.height * screenWidth,
                      }
                    ]}>
                      <View style={[
                        styles.faceFrameCorner,
                        styles.faceFrameTopLeft,
                        { borderColor: canCapture ? "#22c55e" : "#f59e0b" }
                      ]} />
                      <View style={[
                        styles.faceFrameCorner,
                        styles.faceFrameTopRight,
                        { borderColor: canCapture ? "#22c55e" : "#f59e0b" }
                      ]} />
                      <View style={[
                        styles.faceFrameCorner,
                        styles.faceFrameBottomLeft,
                        { borderColor: canCapture ? "#22c55e" : "#f59e0b" }
                      ]} />
                      <View style={[
                        styles.faceFrameCorner,
                        styles.faceFrameBottomRight,
                        { borderColor: canCapture ? "#22c55e" : "#f59e0b" }
                      ]} />
                    </View>
                  </View>
                )}

                <View style={styles.cameraFooter}>
                  <TouchableOpacity 
                    style={[
                      styles.captureBtn,
                      (!canCapture || isCapturing) && styles.captureBtnDisabled
                    ]} 
                    onPress={takePicture}
                    disabled={!canCapture || isCapturing}
                  >
                    <View style={styles.captureInnerCircle}>
                      {isCapturing ? (
                        <ActivityIndicator size="small" color="#000" />
                      ) : (
                        <Icon name="camera" size={30} color="#000" />
                      )}
                    </View>
                  </TouchableOpacity>
                </View>

                <View style={styles.instructionContainer}>
                  <Text style={styles.instructionText}>
                    📸 Đặt khuôn mặt trong khung và chụp ảnh
                  </Text>
                  {!faceDetected && (
                    <Text style={styles.waitingText}>Đang tìm khuôn mặt...</Text>
                  )}
                  {faceDetected && !canCapture && (
                    <Text style={styles.adjustText}>
                      Điều chỉnh vị trí: Giữ thẳng đầu, nhìn vào camera
                    </Text>
                  )}
                  {canCapture && (
                    <Text style={styles.readyText}>
                      ✅ Sẵn sàng chụp ảnh! {autoCaptureEnabled ? '(Tự động)' : '(Thủ công)'}
                    </Text>
                  )}
                  
                  {/* Auto Capture Toggle */}
                  <TouchableOpacity 
                    style={styles.autoToggle}
                    onPress={() => setAutoCaptureEnabled(!autoCaptureEnabled)}
                  >
                    <Icon 
                      name={autoCaptureEnabled ? "toggle-switch" : "toggle-switch-off"} 
                      size={24} 
                      color={autoCaptureEnabled ? "#22c55e" : "#94a3b8"} 
                    />
                    <Text style={[
                      styles.autoToggleText,
                      { color: autoCaptureEnabled ? "#22c55e" : "#94a3b8" }
                    ]}>
                      {autoCaptureEnabled ? "Tự động chụp" : "Chụp thủ công"}
                    </Text>
                  </TouchableOpacity>
                </View>
              </Camera>
            )}
          </View>
        </Modal>
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ecf0f1',
  },
  safeArea: {
    flex: 1,
  },
  scrollContainer: {
    flex: 1,
    paddingHorizontal: 16,
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  permissionText: {
    fontSize: 18,
    color: '#2c3e50',
    textAlign: 'center',
    marginVertical: 20,
  },
  permissionButton: {
    backgroundColor: '#3498db',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  permissionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  userInfoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginVertical: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  avatarContainer: {
    marginRight: 16,
  },
  userDetails: {
    flex: 1,
  },
  userName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 14,
    color: '#7f8c8d',
  },
  registerButton: {
    backgroundColor: '#e74c3c',
    borderRadius: 12,
    marginVertical: 16,
    shadowColor: '#e74c3c',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  registerButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
  },
  registerButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 12,
  },
  previewContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginVertical: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    position: 'relative',
  },
  previewImage: {
    width: 200,
    height: 200,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#e2e8f0',
  },
  uploadOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  uploadText: {
    color: '#fff',
    fontSize: 16,
    marginTop: 12,
  },
  successOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(16, 185, 129, 0.9)',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  successText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 8,
  },
  errorOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(239, 68, 68, 0.9)',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 8,
  },
  listContainer: {
    marginVertical: 16,
  },
  listTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 12,
  },
  loadingContainer: {
    alignItems: 'center',
    padding: 40,
  },
  loadingText: {
    color: '#7f8c8d',
    marginTop: 12,
  },
  registrationItem: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  registrationInfo: {
    flex: 1,
  },
  registrationId: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 4,
  },
  registrationDate: {
    fontSize: 14,
    color: '#7f8c8d',
    marginBottom: 2,
  },
  registrationConfidence: {
    fontSize: 14,
    color: '#27ae60',
    fontWeight: '600',
    marginBottom: 2,
  },
  registrationNotes: {
    fontSize: 12,
    color: '#95a5a6',
    fontStyle: 'italic',
  },
  deleteButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#fef2f2',
  },
  emptyContainer: {
    alignItems: 'center',
    padding: 40,
    backgroundColor: '#fff',
    borderRadius: 12,
  },
  emptyText: {
    fontSize: 16,
    color: '#2c3e50',
    marginTop: 16,
    textAlign: 'center',
  },
  emptySubText: {
    fontSize: 14,
    color: '#7f8c8d',
    marginTop: 8,
    textAlign: 'center',
  },
  cameraContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  camera: {
    flex: 1,
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
    zIndex: 1,
  },
  closeBtn: {
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 20,
    padding: 8,
  },
  cameraTypeIndicator: {
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 15,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  cameraTypeText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
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
    zIndex: 1,
  },
  flipBtn: {
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 20,
    padding: 8,
    alignItems: 'center',
  },
  flipText: {
    color: '#fff',
    fontSize: 10,
    marginTop: 4,
  },
  captureBtn: {
    alignSelf: 'center',
  },
  captureBtnDisabled: {
    opacity: 0.5,
  },
  captureInnerCircle: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  instructionContainer: {
    position: 'absolute',
    top: 120,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 20,
    padding: 12,
    alignItems: 'center',
    zIndex: 1,
  },
  instructionText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  capturingText: {
    color: '#ffeb3b',
    fontSize: 14,
    fontWeight: 'bold',
    marginTop: 4,
    textAlign: 'center',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  waitingText: {
    color: '#fff',
    fontSize: 16,
    marginTop: 8,
    textAlign: 'center',
  },
  faceIndicator: {
    position: 'absolute',
    top: 20,
    left: 20,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  faceIndicatorText: {
    color: '#fff',
    fontSize: 16,
    marginTop: 8,
    fontWeight: '600',
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  adjustText: {
    color: '#fbbf24',
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
    fontWeight: '500',
  },
  readyText: {
    color: '#4ade80',
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
    fontWeight: '600',
  },
  faceIconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  faceOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  faceFrame: {
    borderRadius: 20,
    borderWidth: 3,
    position: 'absolute',
  },
  faceFrameCorner: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderWidth: 3,
  },
  faceFrameTopLeft: {
    top: -3,
    left: -3,
    borderRightWidth: 0,
    borderBottomWidth: 0,
    borderTopLeftRadius: 10,
  },
  faceFrameTopRight: {
    top: -3,
    right: -3,
    borderLeftWidth: 0,
    borderBottomWidth: 0,
    borderTopRightRadius: 10,
  },
  faceFrameBottomLeft: {
    bottom: -3,
    left: -3,
    borderRightWidth: 0,
    borderTopWidth: 0,
    borderBottomLeftRadius: 10,
  },
  faceFrameBottomRight: {
    bottom: -3,
    right: -3,
    borderLeftWidth: 0,
    borderTopWidth: 0,
    borderBottomRightRadius: 10,
  },
  autoToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 20,
  },
  autoToggleText: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
});

export default FaceRegistrationScreen;
