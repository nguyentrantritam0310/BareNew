import React, { useRef, useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

const SimpleFaceRecognitionCamera = ({ onFaceRecognized, onClose, user }) => {
  const [facing, setFacing] = useState('front');
  const [permission, requestPermission] = useCameraPermissions();
  const [isDetecting, setIsDetecting] = useState(false);
  const [detectionCount, setDetectionCount] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  
  const cameraRef = useRef(null);
  const detectionTimeoutRef = useRef(null);

  useEffect(() => {
    return () => {
      if (detectionTimeoutRef.current) {
        clearTimeout(detectionTimeoutRef.current);
      }
    };
  }, []);

  const startFaceDetection = () => {
    if (!cameraRef.current) return;
    
    setIsDetecting(true);
    setDetectionCount(0);
    
    // Simulate face detection with timeout
    simulateFaceDetection();
  };

  const simulateFaceDetection = () => {
    if (detectionCount >= 2) {
      // Simulate successful face recognition
      setDetectionCount(3);
      setTimeout(() => {
        processFaceRecognition();
      }, 1000);
      return;
    }
    
    // Increment detection count every 1 second
    setDetectionCount(prev => prev + 1);
    detectionTimeoutRef.current = setTimeout(simulateFaceDetection, 1000);
  };

  const processFaceRecognition = async () => {
    setIsProcessing(true);
    
    try {
      // Take a photo for the check-in
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.3,
        base64: true,
        skipProcessing: false,
        exif: false
      });
      
      // Simulate processing time
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Simulate successful recognition
      const recognitionResult = {
        success: true,
        confidence: 0.95,
        employeeId: user?.id || 'unknown',
        employeeName: user?.fullName || 'Nguyễn Trần Trí Tâm'
      };
      
      console.log('✅ Face recognition successful:', recognitionResult);
      
      if (onFaceRecognized) {
        onFaceRecognized({
          imageBase64: photo.base64,
          recognitionResult
        });
      }
      
    } catch (error) {
      console.error('Face recognition error:', error);
      Alert.alert('Lỗi', 'Không thể chụp ảnh để nhận diện');
    } finally {
      setIsProcessing(false);
    }
  };

  const stopFaceDetection = () => {
    if (detectionTimeoutRef.current) {
      clearTimeout(detectionTimeoutRef.current);
      detectionTimeoutRef.current = null;
    }
    setIsDetecting(false);
    setDetectionCount(0);
  };

  const toggleCameraType = () => {
    setFacing(current => current === 'back' ? 'front' : 'back');
  };

  const handleClose = () => {
    stopFaceDetection();
    if (onClose) onClose();
  };

  if (!permission) {
    return <View />;
  }

  if (!permission.granted) {
    return (
      <View style={styles.permissionContainer}>
        <Text style={styles.permissionText}>Cần quyền truy cập camera</Text>
        <TouchableOpacity style={styles.permissionBtn} onPress={requestPermission}>
          <Text style={styles.permissionBtnText}>Cấp quyền</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        ref={cameraRef}
        style={styles.camera}
        facing={facing}
        ratio="16:9"
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.closeBtn} onPress={handleClose}>
            <Icon name="close" size={32} color="#fff" />
          </TouchableOpacity>
          
          <View style={styles.titleContainer}>
            <Text style={styles.title}>Nhận diện khuôn mặt</Text>
            <Text style={styles.subtitle}>Đặt khuôn mặt trong khung</Text>
          </View>
        </View>

        {/* Face Detection Frame */}
        <View style={styles.faceFrame}>
          <View style={styles.frameCorner} />
          <View style={[styles.frameCorner, styles.frameCornerTopRight]} />
          <View style={[styles.frameCorner, styles.frameCornerBottomLeft]} />
          <View style={[styles.frameCorner, styles.frameCornerBottomRight]} />
        </View>

        {/* Detection Status */}
        <View style={styles.statusContainer}>
          {!isDetecting ? (
            <TouchableOpacity style={styles.startBtn} onPress={startFaceDetection}>
              <Icon name="face-recognition" size={24} color="#fff" />
              <Text style={styles.startBtnText}>Bắt đầu nhận diện</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.statusItem}>
              <ActivityIndicator size="small" color="#10b981" />
              <Text style={styles.statusText}>
                Đang nhận diện... ({detectionCount}/3)
              </Text>
            </View>
          )}
          
          {detectionCount >= 3 && (
            <View style={styles.successContainer}>
              <Icon name="check-circle" size={24} color="#10b981" />
              <Text style={styles.successText}>Đã nhận diện khuôn mặt!</Text>
            </View>
          )}
          
          {isProcessing && (
            <View style={styles.processingContainer}>
              <ActivityIndicator size="large" color="#3498db" />
              <Text style={styles.processingText}>Đang xử lý...</Text>
            </View>
          )}
        </View>

        {/* Footer Controls */}
        <View style={styles.footer}>
          <TouchableOpacity 
            style={styles.flipBtn} 
            onPress={toggleCameraType}
            disabled={isDetecting || isProcessing}
          >
            <Icon name="camera-flip" size={28} color="#fff" />
            <Text style={styles.flipText}>Đổi camera</Text>
          </TouchableOpacity>
        </View>
      </CameraView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  camera: {
    flex: 1,
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#fff',
  },
  permissionText: {
    textAlign: 'center',
    marginBottom: 20,
    fontSize: 16,
    color: '#333',
  },
  permissionBtn: {
    backgroundColor: '#3498db',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  permissionBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
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
    zIndex: 1,
  },
  closeBtn: {
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 20,
    padding: 8,
  },
  titleContainer: {
    flex: 1,
    alignItems: 'center',
  },
  title: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  subtitle: {
    color: '#fff',
    fontSize: 14,
    opacity: 0.8,
  },
  faceFrame: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: 200,
    height: 250,
    marginTop: -125,
    marginLeft: -100,
    zIndex: 1,
  },
  frameCorner: {
    position: 'absolute',
    width: 30,
    height: 30,
    borderLeftWidth: 3,
    borderTopWidth: 3,
    borderColor: '#10b981',
    top: 0,
    left: 0,
  },
  frameCornerTopRight: {
    borderLeftWidth: 0,
    borderRightWidth: 3,
    right: 0,
    left: 'auto',
  },
  frameCornerBottomLeft: {
    borderTopWidth: 0,
    borderBottomWidth: 3,
    bottom: 0,
    top: 'auto',
  },
  frameCornerBottomRight: {
    borderLeftWidth: 0,
    borderTopWidth: 0,
    borderRightWidth: 3,
    borderBottomWidth: 3,
    right: 0,
    bottom: 0,
    top: 'auto',
    left: 'auto',
  },
  statusContainer: {
    position: 'absolute',
    bottom: 120,
    left: 20,
    right: 20,
    alignItems: 'center',
    zIndex: 1,
  },
  statusItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
  },
  statusText: {
    color: '#fff',
    fontSize: 16,
    marginLeft: 8,
    fontWeight: '500',
  },
  startBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#10b981',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
  },
  startBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  successContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.9)',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
    marginTop: 10,
  },
  successText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  processingContainer: {
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderRadius: 20,
    marginTop: 10,
  },
  processingText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
    marginTop: 8,
  },
  footer: {
    position: 'absolute',
    bottom: 40,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
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
});

export default SimpleFaceRecognitionCamera;
