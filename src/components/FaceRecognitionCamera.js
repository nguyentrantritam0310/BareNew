import React, { useRef, useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import * as faceapi from 'face-api.js';

const FaceRecognitionCamera = ({ onFaceRecognized, onClose, user }) => {
  const [facing, setFacing] = useState('front');
  const [permission, requestPermission] = useCameraPermissions();
  const [isDetecting, setIsDetecting] = useState(false);
  const [faceDetected, setFaceDetected] = useState(false);
  const [detectionCount, setDetectionCount] = useState(0);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  
  const cameraRef = useRef(null);
  const detectionIntervalRef = useRef(null);

  // Load face-api models
  useEffect(() => {
    loadModels();
    return () => {
      if (detectionIntervalRef.current) {
        clearInterval(detectionIntervalRef.current);
      }
    };
  }, []);

  const loadModels = async () => {
    try {
      console.log('🔄 Loading face-api models...');
      
      // Load models from local assets or CDN
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri('https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/tiny_face_detector_model-weights_manifest.json'),
        faceapi.nets.faceLandmark68Net.loadFromUri('https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/face_landmark_68_model-weights_manifest.json'),
        faceapi.nets.faceRecognitionNet.loadFromUri('https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/face_recognition_model-weights_manifest.json'),
        faceapi.nets.ssdMobilenetv1.loadFromUri('https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/ssd_mobilenetv1_model-weights_manifest.json')
      ]);
      
      setModelsLoaded(true);
      console.log('✅ Face-api models loaded successfully');
    } catch (error) {
      console.error('❌ Error loading face-api models:', error);
      Alert.alert('Lỗi', 'Không thể tải mô hình nhận diện khuôn mặt');
    }
  };

  const startFaceDetection = () => {
    if (!modelsLoaded || !cameraRef.current) return;
    
    setIsDetecting(true);
    setDetectionCount(0);
    
    // Detect faces every 500ms
    detectionIntervalRef.current = setInterval(async () => {
      try {
        const photo = await cameraRef.current.takePictureAsync({
          quality: 0.3,
          base64: true,
          skipProcessing: false,
          exif: false
        });
        
        await detectFaceInImage(photo.base64);
      } catch (error) {
        console.log('Detection error:', error);
      }
    }, 500);
  };

  const stopFaceDetection = () => {
    if (detectionIntervalRef.current) {
      clearInterval(detectionIntervalRef.current);
      detectionIntervalRef.current = null;
    }
    setIsDetecting(false);
    setFaceDetected(false);
    setDetectionCount(0);
  };

  const detectFaceInImage = async (imageBase64) => {
    try {
      // Convert base64 to image element
      const img = new Image();
      img.src = `data:image/jpeg;base64,${imageBase64}`;
      
      await new Promise((resolve) => {
        img.onload = resolve;
      });
      
      // Detect faces
      const detections = await faceapi.detectAllFaces(img, new faceapi.TinyFaceDetectorOptions())
        .withFaceLandmarks()
        .withFaceDescriptors();
      
      if (detections.length > 0) {
        console.log(`👤 Face detected! Count: ${detectionCount + 1}`);
        setDetectionCount(prev => prev + 1);
        
        // If we detect face 3 times consecutively, consider it stable
        if (detectionCount >= 2) {
          setFaceDetected(true);
          stopFaceDetection();
          await processFaceRecognition(imageBase64);
        }
      } else {
        setDetectionCount(0);
      }
    } catch (error) {
      console.error('Face detection error:', error);
    }
  };

  const processFaceRecognition = async (imageBase64) => {
    setIsProcessing(true);
    
    try {
      console.log('🔄 Processing face recognition...');
      
      // For now, we'll simulate face recognition
      // In real implementation, you would compare with registered faces
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
          imageBase64,
          recognitionResult
        });
      }
      
    } catch (error) {
      console.error('Face recognition error:', error);
      Alert.alert('Lỗi', 'Không thể nhận diện khuôn mặt');
    } finally {
      setIsProcessing(false);
    }
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
          {!modelsLoaded ? (
            <View style={styles.statusItem}>
              <ActivityIndicator size="small" color="#f59e0b" />
              <Text style={styles.statusText}>Đang tải mô hình AI...</Text>
            </View>
          ) : !isDetecting ? (
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
          
          {faceDetected && (
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

export default FaceRecognitionCamera;
