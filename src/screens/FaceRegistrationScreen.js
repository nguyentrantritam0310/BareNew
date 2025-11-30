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
import FaceDetection from '@react-native-ml-kit/face-detection';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

import { useAuth } from '../contexts/AuthContext';
import CustomHeader from '../components/CustomHeader';
import { useNavigation } from '@react-navigation/native';
import api from '../api';
import faceNetService from '../services/faceNetService';

const { width: screenWidth } = Dimensions.get('window');

const FaceRegistrationScreen = () => {
  const ENABLE_SIMULATED_DETECTION = false;
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
  
  const [debugExpanded, setDebugExpanded] = useState(false);
  // Multi-pose registration state
  const [poseStep, setPoseStep] = useState(0); // 0: thẳng, 1: quay trái, 2: quay phải, 3: ngước lên
  const [isMultiPoseActive, setIsMultiPoseActive] = useState(true);
  const isPoseCollectingRef = useRef(false); // tránh ghi nhận lặp lại 1 pose
  const lastPoseStepRef = useRef(-1);
  const poseStepRef = useRef(0);

  useEffect(() => {
    poseStepRef.current = poseStep;
  }, [poseStep]);

  useEffect(() => {
    const loadFaceNetModel = async () => {
      try {
        await faceNetService.loadModel();
      } catch (error) {
        // Handle error silently
      }
    };
    loadFaceNetModel();
  }, []);

  const getPoseTitle = (step) => {
    switch (step) {
      case 0: return 'Bước 1/4: Nhìn thẳng';
      case 1: return 'Bước 2/4: Quay trái nhẹ';
      case 2: return 'Bước 3/4: Quay phải nhẹ';
      case 3: return 'Bước 4/4: Ngước nhẹ';
      default: return '';
    }
  };
  const getPoseHint = (step) => {
    switch (step) {
      case 0: return 'Giữ đầu thẳng, nhìn trực diện vào camera';
      case 1: return 'Quay đầu nhẹ sang trái, vẫn giữ trong khung';
      case 2: return 'Quay đầu nhẹ sang phải, vẫn giữ trong khung';
      case 3: return 'Ngước đầu nhẹ lên, không vượt quá khung';
      default: return '';
    }
  };
  
  const cameraRef = useRef(null);

// Face detection constants
const MIN_FACE_SIZE = 0.01; // Minimum face size relative to frame (very lenient)
const MAX_HEAD_ANGLE = 45; // Maximum head rotation angle in degrees (very lenient)

  useEffect(() => {
    loadFaceRegistrations();
  }, []);

  const checkCameraPermission = async () => {
    try {
      // Check current permission status first
      const permissionStatus = await Camera.getCameraPermissionStatus();
      
      if (permissionStatus === 'granted') {
        setHasPermission(true);
        return true;
      }
      
      if (permissionStatus === 'not-determined') {
        // Request permission only if not determined yet
        const permission = await Camera.requestCameraPermission();
        const granted = permission === 'granted';
        setHasPermission(granted);
        return granted;
      }
      
      // Permission denied or restricted
      setHasPermission(false);
      return false;
    } catch (error) {
      setHasPermission(false);
      return false;
    }
  };

  const loadFaceRegistrations = async () => {
    try {
      setLoading(true);
      const response = await api.get('/FaceRegistration/my-faces');
      setFaceRegistrations(response.data);
    } catch (error) {
      if (error.response?.status === 401) {
        Alert.alert(
          'Phiên đăng nhập hết hạn', 
          'Vui lòng đăng nhập lại để tiếp tục sử dụng',
          [
            {
              text: 'Đăng nhập lại',
              onPress: () => {
                // Navigate to login screen
                navigation.navigate('Login');
              }
            }
          ]
        );
      } else if (error.response?.status !== 404) {
        Alert.alert('Lỗi', 'Không thể tải danh sách khuôn mặt đã đăng ký');
      }
    } finally {
      setLoading(false);
    }
  };


  // Face quality validation
  const isGoodFaceQuality = (face) => {
    if (!face) return false;
    
    const { bounds, headEulerAngleX, headEulerAngleY, headEulerAngleZ } = face;
    
    if (!bounds || typeof bounds.x !== 'number' || typeof bounds.y !== 'number' || 
        typeof bounds.width !== 'number' || typeof bounds.height !== 'number') {
      return false;
    }
    
    const faceArea = bounds.width * bounds.height;
    const screenArea = screenWidth * screenWidth;
    const normalizedFaceSize = faceArea / screenArea;
    
    if (normalizedFaceSize < MIN_FACE_SIZE) {
      return false;
    }
    
    const maxAngle = MAX_HEAD_ANGLE;
    
    if (Math.abs(headEulerAngleX) > maxAngle) {
      return false;
    }
    if (Math.abs(headEulerAngleY) > maxAngle) {
      return false;
    }
    if (Math.abs(headEulerAngleZ) > maxAngle) {
      return false;
    }
    
    const normalizedX = bounds.x / screenWidth;
    const normalizedY = bounds.y / screenWidth;
    const normalizedWidth = bounds.width / screenWidth;
    const normalizedHeight = bounds.height / screenWidth;
    
    if (normalizedX < -0.3 || normalizedX > 1.5) {
      return false;
    }
    if (normalizedY < -0.3 || normalizedY > 2.0) {
      return false;
    }
    
    const centerX = normalizedX + normalizedWidth / 2;
    const centerY = normalizedY + normalizedHeight / 2;
    
    if (centerX < -0.5 || centerX > 2.0) {
      return false;
    }
    if (centerY < -0.5 || centerY > 3.0) {
      return false;
    }
    
    return true;
  };

  // Extract face features for registration/recognition
  const extractFaceFeatures = (face) => {
    if (!face) return null;
    
    // Handle landmarks - support both position object and direct x,y
    const landmarks = face.landmarks ? face.landmarks.map(landmark => ({
      type: landmark.type || landmark.name || 'unknown',
      x: landmark.position?.x || landmark.x || 0,
      y: landmark.position?.y || landmark.y || 0,
    })) : [];
    
    // Handle contours - support both points array and direct points
    const contours = face.contours ? face.contours.map(contour => ({
      type: contour.type || contour.name || 'unknown',
      points: contour.points ? contour.points.map(point => ({
        x: point.x || 0,
        y: point.y || 0,
      })) : [],
    })) : [];
    
    return {
      bounds: {
        x: face.bounds?.x || 0,
        y: face.bounds?.y || 0,
        width: face.bounds?.width || 0,
        height: face.bounds?.height || 0,
      },
      landmarks: landmarks,
      contours: contours,
      headEulerAngles: {
        x: face.headEulerAngleX || face.headEulerAngles?.x || 0,
        y: face.headEulerAngleY || face.headEulerAngles?.y || 0,
        z: face.headEulerAngleZ || face.headEulerAngles?.z || 0,
      },
      probabilities: {
        leftEyeOpenProbability: face.leftEyeOpenProbability !== undefined && face.leftEyeOpenProbability !== null 
          ? face.leftEyeOpenProbability 
          : (face.probabilities?.leftEyeOpenProbability || 0),
        rightEyeOpenProbability: face.rightEyeOpenProbability !== undefined && face.rightEyeOpenProbability !== null 
          ? face.rightEyeOpenProbability 
          : (face.probabilities?.rightEyeOpenProbability || 0),
        smilingProbability: face.smilingProbability !== undefined && face.smilingProbability !== null 
          ? face.smilingProbability 
          : (face.probabilities?.smilingProbability || 0),
      },
      trackingId: face.trackingId || face.trackingID || null,
      confidence: face.confidence || null,
    };
  };

  // Calculate face quality score
  // When isMultiPoseActive, we don't penalize head rotation angles since rotation is required for poses
  const calculateFaceQuality = (faceFeatures, isMultiPose = false) => {
    if (!faceFeatures) return 0;
    
    let qualityScore = 100;
    
    // Deduct points for head rotation - BUT NOT for multi-pose registration
    // because rotation is intentional and required for left/right/up poses
    if (!isMultiPose) {
      const angleX = Math.abs(faceFeatures.headEulerAngles?.x || 0);
      const angleY = Math.abs(faceFeatures.headEulerAngles?.y || 0);
      const angleZ = Math.abs(faceFeatures.headEulerAngles?.z || 0);
      
      // Only penalize excessive rotation (>30 degrees) even in single-pose mode
      const excessiveX = Math.max(0, angleX - 30);
      const excessiveY = Math.max(0, angleY - 30);
      const excessiveZ = Math.max(0, angleZ - 30);
      qualityScore -= (excessiveX + excessiveY + excessiveZ) * 2; // 2 points per excessive degree
    } else {
      // For multi-pose: only penalize excessive rotation (>45 degrees)
      const angleX = Math.abs(faceFeatures.headEulerAngles?.x || 0);
      const angleY = Math.abs(faceFeatures.headEulerAngles?.y || 0);
      const angleZ = Math.abs(faceFeatures.headEulerAngles?.z || 0);
      
      // Allow up to 45 degrees for pose registration, only penalize beyond that
      const excessiveX = Math.max(0, angleX - 45);
      const excessiveY = Math.max(0, angleY - 45);
      const excessiveZ = Math.max(0, angleZ - 45);
      qualityScore -= (excessiveX + excessiveY + excessiveZ) * 2;
    }
    
    // Deduct points for small face size
    const faceSize = faceFeatures.bounds?.width * faceFeatures.bounds?.height || 0;
    if (faceSize < 0.2) qualityScore -= 20;
    else if (faceSize < 0.3) qualityScore -= 10;
    
    // Bonus points for good eye openness
    const leftEyeOpen = faceFeatures.probabilities?.leftEyeOpenProbability || 0;
    const rightEyeOpen = faceFeatures.probabilities?.rightEyeOpenProbability || 0;
    const avgEyeOpen = (leftEyeOpen + rightEyeOpen) / 2;
    
    if (avgEyeOpen > 0.8) qualityScore += 10;
    else if (avgEyeOpen < 0.5) qualityScore -= 15;
    
    // Bonus points for smiling (optional)
    const smiling = faceFeatures.probabilities?.smilingProbability || 0;
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

      // Multi-pose auto embedding collection (no image upload)
      try {
        if (isMultiPoseActive && isValidFace && face) {
          const yaw = face.headEulerAngleY || 0; // quay trái/phải
          const pitch = face.headEulerAngleX || 0; // ngước lên/xuống
          // Pose rules (đơn giản, có thể tinh chỉnh):
          const isFront = Math.abs(yaw) < 10 && Math.abs(pitch) < 12;
          const isLeft = yaw < -6 && Math.abs(pitch) < 18; // nới lỏng yaw/pitch
          const isRight = yaw > 6 && Math.abs(pitch) < 18; // nới lỏng yaw/pitch
          const isUp = pitch > 10;

          const targetIdx = poseStepRef.current;
          let ok = false;
          if (targetIdx === 0) ok = isFront;
          else if (targetIdx === 1) ok = isLeft;
          else if (targetIdx === 2) ok = isRight;
          else if (targetIdx === 3) ok = isUp;

          if (ok) {
            if (isPoseCollectingRef.current || lastPoseStepRef.current === targetIdx) {
              return;
            }
            isPoseCollectingRef.current = true;
            const emb = computeEmbeddingFromFaceData(face);
            if (Array.isArray(emb) && emb.length > 0) {
              const n = Math.sqrt(emb.reduce((s, v) => s + v * v, 0));
              if (isFinite(n) && n > 0) {
                const embNorm = emb.map(v => v / n);
                
                if (!user?.id) {
                  Alert.alert('Lỗi', 'Không thể xác định người dùng. Vui lòng đăng nhập lại.');
                  isPoseCollectingRef.current = false;
                  return;
                }
                
                if (embNorm.length !== 256 && embNorm.length !== 512) {
                  Alert.alert('Lỗi', `Embedding không đúng định dạng (${embNorm.length} dimensions, cần 256 hoặc 512)`);
                  isPoseCollectingRef.current = false;
                  return;
                }
                
                const q = calculateFaceQuality(extractFaceFeatures(face), true);
                const poseMap = { 0: 'front', 1: 'left', 2: 'right', 3: 'up' };
                const poseLabel = poseMap[targetIdx] || 'front';
                const body = {
                  employeeId: user.id,
                  embedding: embNorm,
                  faceQualityScore: q,
                  notes: `Pose ${poseLabel} - ${new Date().toLocaleString('vi-VN')}`,
                  pose: poseLabel,
                };
                
                api.post('/FaceRegistration/register-embedding', body).then((res) => {
                  if (res.data?.success) {
                    if (targetIdx < 3) {
                      lastPoseStepRef.current = targetIdx;
                      setTimeout(() => {
                        setPoseStep(prev => prev + 1);
                        isPoseCollectingRef.current = false;
                      }, 700);
                    } else {
                      Alert.alert('Thành công', 'Đăng ký đủ 4 góc khuôn mặt!');
                      setPoseStep(0);
                      setIsMultiPoseActive(false);
                      lastPoseStepRef.current = -1;
                      isPoseCollectingRef.current = false;
                      loadFaceRegistrations();
                      setTimeout(() => {
                        setIsCameraOpen(false);
                      }, 500);
                    }
                  } else {
                    Alert.alert('Lỗi', res.data?.message || 'Không thể đăng ký pose');
                    isPoseCollectingRef.current = false;
                  }
                  }).catch((e) => {
                  const errorMessage = e.response?.data?.message || e.response?.data?.Message || e.message || 'Không thể đăng ký pose';
                  Alert.alert('Lỗi', errorMessage);
                  isPoseCollectingRef.current = false;
                  }).finally(() => {
                    setTimeout(() => {
                      if (isPoseCollectingRef.current) {
                        isPoseCollectingRef.current = false;
                      }
                    }, 3000);
                  });
              } else {
                isPoseCollectingRef.current = false;
              }
            } else {
              isPoseCollectingRef.current = false;
            }
          }
        }
      } catch (e) {
        isPoseCollectingRef.current = false;
      }
    } else {
      setFaceDetected(false);
      setFaceData(null);
      setCanCapture(false);
    }
  };

  // Normalize ML Kit face data to expected format
  const normalizeFaceData = (mlKitFace) => {
    if (!mlKitFace) return null;
    
    // Try different possible field names for bounds
    let bounds = null;
    if (mlKitFace.frame) {
      bounds = {
        x: mlKitFace.frame.left || mlKitFace.frame.x || 0,
        y: mlKitFace.frame.top || mlKitFace.frame.y || 0,
        width: mlKitFace.frame.width || 0,
        height: mlKitFace.frame.height || 0,
      };
    } else if (mlKitFace.boundingBox) {
      bounds = {
        x: mlKitFace.boundingBox.left || mlKitFace.boundingBox.x || 0,
        y: mlKitFace.boundingBox.top || mlKitFace.boundingBox.y || 0,
        width: mlKitFace.boundingBox.width || 0,
        height: mlKitFace.boundingBox.height || 0,
      };
    } else if (mlKitFace.bounds) {
      bounds = {
        x: mlKitFace.bounds.x || 0,
        y: mlKitFace.bounds.y || 0,
        width: mlKitFace.bounds.width || 0,
        height: mlKitFace.bounds.height || 0,
      };
    }
    
    if (!bounds) {
      return null;
    }
    
    // Extract landmarks - handle array or object maps
    let landmarks = [];
    if (mlKitFace.landmarks && Array.isArray(mlKitFace.landmarks)) {
      landmarks = mlKitFace.landmarks.map(landmark => ({
        type: landmark.type || landmark.name || 'unknown',
        position: landmark.position || { x: landmark.x || 0, y: landmark.y || 0 },
        x: landmark.position?.x || landmark.x || 0,
        y: landmark.position?.y || landmark.y || 0,
      }));
    } else if (mlKitFace.landmarks && typeof mlKitFace.landmarks === 'object') {
      landmarks = Object.entries(mlKitFace.landmarks).map(([key, val]) => ({
        type: key || 'unknown',
        position: val?.position || { x: val?.x || 0, y: val?.y || 0 },
        x: (val?.position?.x ?? val?.x ?? 0),
        y: (val?.position?.y ?? val?.y ?? 0),
      }));
    }
    
    // Extract contours - handle array or object maps
    let contours = [];
    if (mlKitFace.contours && Array.isArray(mlKitFace.contours)) {
      contours = mlKitFace.contours.map(contour => ({
        type: contour.type || contour.name || 'unknown',
        points: contour.points || contour.faceContour || [],
      }));
    } else if (mlKitFace.contours && typeof mlKitFace.contours === 'object') {
      contours = Object.entries(mlKitFace.contours).map(([key, val]) => ({
        type: key || 'unknown',
        points: Array.isArray(val?.points) ? val.points : [],
      }));
    }
    
    return {
      bounds: bounds,
      headEulerAngleX: mlKitFace.headEulerAngleX || mlKitFace.rotationX || mlKitFace.headEulerAngle?.x || 0,
      headEulerAngleY: mlKitFace.headEulerAngleY || mlKitFace.rotationY || mlKitFace.headEulerAngle?.y || 0,
      headEulerAngleZ: mlKitFace.headEulerAngleZ || mlKitFace.rotationZ || mlKitFace.headEulerAngle?.z || 0,
      landmarks: landmarks,
      contours: contours,
      leftEyeOpenProbability: mlKitFace.leftEyeOpenProbability !== undefined ? mlKitFace.leftEyeOpenProbability : (mlKitFace.leftEyeOpen !== undefined ? mlKitFace.leftEyeOpen : null),
      rightEyeOpenProbability: mlKitFace.rightEyeOpenProbability !== undefined ? mlKitFace.rightEyeOpenProbability : (mlKitFace.rightEyeOpen !== undefined ? mlKitFace.rightEyeOpen : null),
      smilingProbability: mlKitFace.smilingProbability !== undefined ? mlKitFace.smilingProbability : (mlKitFace.smiling !== undefined ? mlKitFace.smiling : null),
      trackingId: mlKitFace.trackingId || mlKitFace.trackingID || null,
      confidence: mlKitFace.confidence || null,
    };
  };

  // Face detection using ML Kit
  useEffect(() => {
    if (isCameraOpen && cameraRef.current) {
      const interval = setInterval(async () => {
        if (!isCameraOpen || !cameraRef.current) {
          return;
        }
        
        try {
          if (!isCameraOpen || !cameraRef.current) {
            return;
          }
          
          const photo = await cameraRef.current.takePhoto({
            qualityPrioritization: 'speed',
            flash: 'off',
            skipMetadata: true,
          });
          
          let faces = [];
          try {
            try {
              // Check if FaceDetectorOptions or options are supported
              if (FaceDetection.FaceDetectorOptions || FaceDetection.options) {
                const options = FaceDetection.FaceDetectorOptions || {
                  performanceMode: 'accurate',
                  landmarkMode: 'all',
                  contourMode: 'all',
                  classificationMode: 'all',
                  minFaceSize: 0.1,
                  enableTracking: true,
                };
                const detector = FaceDetection.getDetector(options);
                faces = await detector.detect(`file://${photo.path}`);
              } else {
                // Try direct detect with options object
                const options = {
                  performanceMode: 'accurate',
                  landmarkMode: 'all',
                  contourMode: 'all',
                  classificationMode: 'all',
                  minFaceSize: 0.1,
                  enableTracking: true,
                };
                faces = await FaceDetection.detect(`file://${photo.path}`, options);
              }
              } catch (optionsError) {
              faces = await FaceDetection.detect(`file://${photo.path}`);
            }
            
            faces = faces.map(normalizeFaceData).filter(f => f !== null);
          } catch (mlKitError) {
            // Simulated detection removed - not needed in production
          }
          
          if (faces && faces.length > 0) {
            const face = faces[0];
            const isValidFace = isGoodFaceQuality(face);
            
            setFaceDetected(true);
            setFaceData(face);
            setCanCapture(isValidFace);
            
            // Multi-pose auto embedding collection (no image upload) – ensure it runs in this interval path
            try {
              if (isMultiPoseActive && isValidFace && face) {
                const yaw = face.headEulerAngleY || 0; // quay trái/phải
                const pitch = face.headEulerAngleX || 0; // ngước lên/xuống
                const isFront = Math.abs(yaw) < 10 && Math.abs(pitch) < 12;
                const isLeft = yaw < -6 && Math.abs(pitch) < 18; // nới lỏng yaw/pitch
                const isRight = yaw > 6 && Math.abs(pitch) < 18; // nới lỏng yaw/pitch
                const isUp = pitch > 10;

                const targetIdx = poseStepRef.current;
                let ok = false;
                if (targetIdx === 0) ok = isFront;
                else if (targetIdx === 1) ok = isLeft;
                else if (targetIdx === 2) ok = isRight;
                else if (targetIdx === 3) ok = isUp;


                if (ok) {
                  if (isPoseCollectingRef.current || lastPoseStepRef.current === targetIdx) {
                    // đang ghi nhận hoặc đã ghi nhận pose này
                  } else {
                    isPoseCollectingRef.current = true;
                    // Try to use FaceNet embedding if available, fallback to custom
                    getEmbeddingFromFace(face, photo.path).then((result) => {
                      if (!result || !result.embedding) {
                        isPoseCollectingRef.current = false;
                        return;
                      }
                      
                      const embNorm = result.embedding;
                      
                      if (!user?.id) {
                        Alert.alert('Lỗi', 'Không thể xác định người dùng. Vui lòng đăng nhập lại.');
                        isPoseCollectingRef.current = false;
                        return;
                      }
                      
                      if (!embNorm) {
                        Alert.alert('Lỗi', 'Không thể trích xuất đặc điểm khuôn mặt. Vui lòng thử lại.');
                        isPoseCollectingRef.current = false;
                        return;
                      }
                      
                      if (typeof embNorm.length !== 'number' || embNorm.length === 0) {
                        Alert.alert('Lỗi', 'Embedding rỗng. Vui lòng thử lại.');
                        isPoseCollectingRef.current = false;
                        return;
                      }
                      
                      const embeddingArray = Array.isArray(embNorm) 
                        ? embNorm 
                        : (embNorm.length ? Array.from(embNorm) : []);
                      
                      if (embeddingArray.length !== 256 && embeddingArray.length !== 512) {
                        Alert.alert('Lỗi', `Embedding không đúng định dạng (${embeddingArray.length} dimensions, cần 256 hoặc 512)`);
                        isPoseCollectingRef.current = false;
                        return;
                      }
                      
                      const q = calculateFaceQuality(extractFaceFeatures(face), true);
                      const poseMap = { 0: 'front', 1: 'left', 2: 'right', 3: 'up' };
                      const poseLabel = poseMap[targetIdx] || 'front';
                      const body = {
                        employeeId: user.id,
                        embedding: embeddingArray,
                        faceQualityScore: q,
                        notes: `Pose ${poseLabel} - ${new Date().toLocaleString('vi-VN')}`,
                        pose: poseLabel,
                      };
                      
                      api.post('/FaceRegistration/register-embedding', body).then((res) => {
                          if (res.data?.success) {
                            if (targetIdx < 3) {
                              lastPoseStepRef.current = targetIdx;
                              setTimeout(() => {
                                setPoseStep(prev => prev + 1);
                                isPoseCollectingRef.current = false;
                              }, 700);
                            } else {
                              Alert.alert('Thành công', 'Đăng ký đủ 4 góc khuôn mặt!');
                              setPoseStep(0);
                              setIsMultiPoseActive(false);
                              lastPoseStepRef.current = -1;
                              isPoseCollectingRef.current = false;
                              loadFaceRegistrations();
                              setTimeout(() => {
                                setIsCameraOpen(false);
                              }, 500);
                            }
                          } else {
                            Alert.alert('Lỗi', res.data?.message || 'Không thể đăng ký pose');
                            isPoseCollectingRef.current = false;
                          }
                        }).catch((e) => {
                          const errorMessage = e.response?.data?.message || e.response?.data?.Message || e.message || 'Không thể đăng ký pose';
                          Alert.alert('Lỗi', errorMessage);
                          isPoseCollectingRef.current = false;
                        }).finally(() => {
                          setTimeout(() => {
                            if (isPoseCollectingRef.current) {
                              isPoseCollectingRef.current = false;
                            }
                          }, 3000);
                        });
                    }).catch((embeddingError) => {
                      isPoseCollectingRef.current = false;
                    });
                  }
                }
              }
            } catch (e) {
              isPoseCollectingRef.current = false;
            }
          } else {
            setFaceDetected(false);
            setFaceData(null);
            setCanCapture(false);
          }
        } catch (error) {
          setFaceDetected(false);
          setFaceData(null);
          setCanCapture(false);
        }
      }, 500);
      
      return () => {
        clearInterval(interval);
      };
    }
  }, [isCameraOpen, isCapturing, isUploading]);

  const openCamera = async () => {
    if (faceRegistrations.length >= 4) {
      Alert.alert(
        'Đã đủ khuôn mặt',
        'Bạn đã đăng ký đủ 4 khuôn mặt. Không thể đăng ký thêm.',
        [{ text: 'OK' }]
      );
      return;
    }
    
    if (!device) {
      Alert.alert('Camera Error', 'No camera device found.');
      return;
    }
    
    // Request permission when opening camera (ensures app is fully launched)
    const hasPerm = await checkCameraPermission();
    
    if (!hasPerm) {
      Alert.alert(
        'Permission Required', 
        'Camera permission is required to register face. Please grant camera permission in settings.',
        [{ text: 'OK' }]
      );
      return;
    }
    
    setIsCameraOpen(true);
    setFaceDetected(false);
    setFaceData(null);
    setCanCapture(false);
  };

  const takePicture = async () => {
    if (!cameraRef.current) return;
    
    try {
      setIsCapturing(true);
      const photo = await cameraRef.current.takePhoto({
        qualityPrioritization: 'quality',
        flash: 'off',
      });
      
      setCapturedImage(photo.path);
      setIsCameraOpen(false);
      
      // Process registration with file path
      await processFaceRegistrationFromFile(photo.path);
    } catch (error) {
      Alert.alert('Error', 'Failed to take picture');
    } finally {
      setIsCapturing(false);
    }
  };

  const processFaceRegistrationFromFile = async (imagePath, faceFeatures = null) => {
    try {
      setIsUploading(true);
      setUploadStatus(null);
      // Compute embedding (FaceNet first, fallback to custom)
      const extractedFaceFeatures = faceData ? extractFaceFeatures(faceData) : null;
      
      // Try to use FaceNet embedding if available
      const result = await getEmbeddingFromFace(faceData || faceFeatures, imagePath);
      if (!result || !result.embedding) {
        throw new Error('Không thể trích xuất embedding từ khuôn mặt');
      }

      const body = {
        employeeId: user?.id,
        embedding: result.embedding,
        faceQualityScore: extractedFaceFeatures ? calculateFaceQuality(extractedFaceFeatures) : null,
        notes: `Đăng ký khuôn mặt - ${new Date().toLocaleString('vi-VN')}`,
      };

      const response = await api.post('/FaceRegistration/register-embedding', body);

      if (response.data.success) {
        setUploadStatus('success');
        Alert.alert(
          'Thành công',
          `Đăng ký khuôn mặt thành công!`,
          [
            {
              text: 'OK',
              onPress: () => {
                setCapturedImage(null);
                setUploadStatus(null);
                loadFaceRegistrations();
              }
            }
          ]
        );
      } else {
        setUploadStatus('error');
        Alert.alert('Lỗi', response.data.message || 'Không thể đăng ký khuôn mặt');
      }
    } catch (error) {
      console.error('Process file error:', error);
      setUploadStatus('error');
        Alert.alert('Error', 'Failed to process image');
        setIsUploading(false);
    }
  };

  const extractFaceNetEmbedding = async (photoPath, faceBounds) => {
    try {
      const loaded = await faceNetService.loadModel();
      if (!loaded || !faceNetService.isReady()) {
        throw new Error('FaceNet model not loaded. Please ensure facenet_512.tflite is available in assets.');
      }
      
      const embedding = await faceNetService.extractEmbedding(photoPath, faceBounds);
      
      if (!embedding) {
        throw new Error('FaceNet service returned null embedding');
      }
      
      if (embedding.length !== 512) {
        throw new Error(`Invalid embedding dimension: expected 512, got ${embedding.length}`);
      }
      
      return embedding;
    } catch (error) {
      throw error;
    }
  };

  const getEmbeddingFromFace = async (face, photoPath = null) => {
    try {
      if (!photoPath) {
        throw new Error('FaceNet requires photo path. Photo path is missing.');
      }
      
      if (!face?.bounds) {
        throw new Error('FaceNet requires face bounds. Face bounds are missing.');
      }
      
      const embedding = await extractFaceNetEmbedding(photoPath, face.bounds);
      
      if (!embedding || embedding.length !== 512) {
        throw new Error(`FaceNet embedding extraction failed: got ${embedding?.length || 0} dimensions, expected 512`);
      }
      
      const norm = Math.sqrt(embedding.reduce((s, v) => s + v * v, 0));
      if (!isFinite(norm) || norm <= 0) {
        throw new Error('FaceNet embedding is invalid (norm=0)');
      }
      
      const embeddingNorm = embedding;
      return { embedding: embeddingNorm, source: 'facenet' };
      
    } catch (error) {
      throw new Error(`FaceNet embedding extraction failed: ${error.message}`);
    }
  };

  // Build a lightweight on-device embedding from normalized landmarks + angles
  // IMPORTANT: This must match exactly with SimpleFaceRecognitionCamera.js computeEmbeddingFromFaceData
  const computeEmbeddingFromFaceData = (face) => {
    if (!face || !face.bounds) return null;
    const bx = face.bounds.x || 0;
    const by = face.bounds.y || 0;
    const bw = face.bounds.width || 1;
    const bh = face.bounds.height || 1;

    const order = [
      'leftEye', 'rightEye', 'nose', 'mouthLeft', 'mouthRight',
      'leftEar', 'rightEar', 'leftCheek', 'rightCheek'
    ];

    const points = [];
    // Helper to clamp finite numbers
    const safe = (v) => (Number.isFinite(v) ? v : 0);
    if (Array.isArray(face.landmarks) && face.landmarks.length > 0) {
      const normalized = face.landmarks.map(lm => {
        const lx = (lm.position?.x ?? lm.x ?? 0);
        const ly = (lm.position?.y ?? lm.y ?? 0);
        return {
          type: (lm.type || lm.name || '').toString().toLowerCase(),
          x: safe((lx - bx) / (bw || 1)),
          y: safe((ly - by) / (bh || 1))
        };
      });

      order.forEach(key => {
        const found = normalized.find(p => p.type && p.type.includes(key.toLowerCase()));
        if (found) { points.push(found.x, found.y); } else { points.push(0, 0); }
      });

      // Extra geometric ratios for more discriminative embedding
      const find = (key) => normalized.find(p => p.type && p.type.includes(key));
      const leftEye = find('lefteye');
      const rightEye = find('righteye');
      const nose = find('nose');
      const mouthLeft = find('mouthleft');
      const mouthRight = find('mouthright');
      const mouthBottom = find('mouthbottom');
      const leftEar = find('leftear');
      const rightEar = find('rightear');
      const leftCheek = find('leftcheek');
      const rightCheek = find('rightcheek');

      const dist = (a, b) => (a && b) ? Math.hypot(a.x - b.x, a.y - b.y) : 0;

      const eyeDist = dist(leftEye, rightEye);
      const mouthWidth = dist(mouthLeft, mouthRight);
      const noseMouth = dist(nose, mouthBottom || mouthLeft || mouthRight);
      const earWidth = dist(leftEar, rightEar);
      const cheekWidth = dist(leftCheek, rightCheek);

      // Calculate actual face aspect ratio from bounds (not normalized to 1)
      const faceAspectRatioBounds = safe(bw / (bh || 1e-6));

      // Ratios normalized by face size (distances are already normalized by bounds)
      const ratios = [
        safe(eyeDist),
        safe(mouthWidth),
        safe(noseMouth),
        safe(earWidth),
        safe(cheekWidth),
        safe(eyeDist / (mouthWidth || 1e-6)),
        safe(noseMouth / (eyeDist || 1e-6)),
        safe(mouthWidth / (cheekWidth || 1e-6)),
        safe(earWidth / (cheekWidth || 1e-6)),
        faceAspectRatioBounds, // Actual face box aspect ratio
      ];
      points.push(...ratios);

      // Track which landmark types have already been added to avoid duplicates
      const addedLandmarkTypes = new Set();
      order.forEach(key => {
        const found = normalized.find(p => p.type && p.type.includes(key.toLowerCase()));
        if (found) {
          addedLandmarkTypes.add(found.type);
        }
      });

      // Append remaining landmark coordinates that haven't been added yet
      for (let i = 0; i < normalized.length; i++) {
        const lm = normalized[i];
        // Only add if this landmark type hasn't been added in the ordered section
        if (!addedLandmarkTypes.has(lm.type)) {
          points.push(lm.x, lm.y);
          addedLandmarkTypes.add(lm.type); // Mark as added to prevent duplicates in remaining landmarks
        }
      }
      
      // Add more geometric features for better discrimination
      // Face symmetry features
      const faceCenterX = safe((leftEye?.x || 0) + (rightEye?.x || 0)) / 2;
      const faceCenterY = safe((leftEye?.y || 0) + (rightEye?.y || 0)) / 2;
      
      // Additional distance features
      const leftEyeNose = dist(leftEye, nose);
      const rightEyeNose = dist(rightEye, nose);
      const leftEyeMouth = dist(leftEye, mouthLeft || mouthBottom);
      const rightEyeMouth = dist(rightEye, mouthRight || mouthBottom);
      
      // Symmetry ratios
      const eyeSymmetry = Math.abs(leftEyeNose - rightEyeNose) / (eyeDist || 1e-6);
      const mouthSymmetry = Math.abs(leftEyeMouth - rightEyeMouth) / (eyeDist || 1e-6);
      
      // More facial proportions
      const faceWidth = cheekWidth || earWidth || eyeDist * 1.5;
      const faceHeight = noseMouth + eyeDist;
      const faceAspectRatio = safe(faceWidth / (faceHeight || 1e-6));
      
      points.push(
        faceCenterX,
        faceCenterY,
        leftEyeNose,
        rightEyeNose,
        leftEyeMouth,
        rightEyeMouth,
        eyeSymmetry,
        mouthSymmetry,
        faceAspectRatio,
        safe(eyeDist / (faceWidth || 1e-6)), // Eye spacing relative to face width
        safe(noseMouth / (faceHeight || 1e-6)) // Nose-mouth relative to face height
      );
    }

    points.push(
      (Math.abs(face.headEulerAngleX || 0) / 45),
      (Math.abs(face.headEulerAngleY || 0) / 45),
      (Math.abs(face.headEulerAngleZ || 0) / 45)
    );
    points.push(
      Math.max(0, Math.min(1, face.leftEyeOpenProbability || 0)),
      Math.max(0, Math.min(1, face.rightEyeOpenProbability || 0)),
      Math.max(0, Math.min(1, face.smilingProbability || 0))
    );
    
    // Add contour features if available (from ML Kit contours)
    if (face.contours && Array.isArray(face.contours) && face.contours.length > 0) {
      // Sample key contour points (nose bridge, lip boundaries, etc.)
      const contourSampleSize = Math.min(10, face.contours.length);
      for (let i = 0; i < contourSampleSize; i++) {
        const contour = face.contours[i];
        if (contour.points && Array.isArray(contour.points) && contour.points.length > 0) {
          // Add first point of each contour (normalized by bounds)
          const firstPoint = contour.points[0];
          if (firstPoint && (firstPoint.x !== undefined) && (firstPoint.y !== undefined)) {
            // Normalize contour point by face bounds (same coordinate system as landmarks)
            const normalizedX = safe((firstPoint.x - bx) / (bw || 1));
            const normalizedY = safe((firstPoint.y - by) / (bh || 1));
            // Validate normalized coordinates are reasonable (between -0.5 and 1.5 to allow for some margin)
            if (normalizedX >= -0.5 && normalizedX <= 1.5 && normalizedY >= -0.5 && normalizedY <= 1.5) {
              points.push(normalizedX, normalizedY);
            }
          }
        }
      }
    }

    // Increase target to 256 for better discrimination
    const TARGET = 256;
    if (points.length < TARGET) {
      // Pad with zeros if needed, but try to fill with derived features
      // Add some derived statistics from existing points (using actual values, not abs)
      if (points.length > 0) {
        const mean = points.reduce((s, v) => s + v, 0) / points.length;
        const variance = points.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / points.length;
        points.push(mean, Math.sqrt(Math.max(0, variance))); // Ensure std dev is non-negative
        // Fill rest with zeros
        while (points.length < TARGET) points.push(0);
      } else {
        while (points.length < TARGET) points.push(0);
      }
    } else if (points.length > TARGET) {
      points.length = TARGET;
    }
    return points.map(v => (typeof v === 'number' ? v : 0));
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
            style={[
              styles.registerButton,
              (faceRegistrations.length >= 4 || isUploading) && styles.registerButtonDisabled
            ]}
            onPress={openCamera}
            disabled={faceRegistrations.length >= 4 || isUploading}
          >
            <View style={styles.registerButtonContent}>
              <Icon name="camera-plus" size={32} color="#fff" />
              <Text style={styles.registerButtonText}>
                {isUploading 
                  ? 'Đang xử lý...' 
                  : faceRegistrations.length >= 4 
                    ? 'Đã đủ 4 khuôn mặt' 
                    : 'Đăng ký khuôn mặt mới'}
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
            <Text style={styles.listTitle}>Khuôn mặt đã đăng ký ({faceRegistrations.length}/4)</Text>
            
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
                style={StyleSheet.absoluteFill}
                device={device}
                isActive={isCameraOpen}
                photo={true}
              />
            )}
            
            {/* Camera Header - moved outside Camera component */}
            <View style={styles.cameraHeader}>
              <TouchableOpacity 
                style={styles.closeBtn} 
                onPress={() => setIsCameraOpen(false)}
              >
                <Icon name="close" size={32} color="#fff" />
              </TouchableOpacity>
              
             
            </View>

            {/* Face Detection Overlay - moved outside Camera component */}
            {faceDetected && faceData && (
              <View style={styles.faceOverlay}>
                {/* Debug dock (bottom, collapsible) */}
                <View style={styles.debugDock}>
                  <TouchableOpacity
                    style={styles.debugHeader}
                    activeOpacity={0.85}
                    onPress={() => setDebugExpanded(v => !v)}
                  >
                    <Icon name={debugExpanded ? 'chevron-down' : 'chevron-up'} size={18} color="#60a5fa" />
                    <Text style={styles.debugHeaderText}>Thông tin khuôn mặt</Text>
                    <View style={{ flex: 1 }} />
                    <Text style={styles.debugMiniText}>
                      {`LM ${faceData.landmarks?.length || 0}`} · {`Q ${calculateFaceQuality(extractFaceFeatures(faceData)).toFixed(0)}`}
                    </Text>
                  </TouchableOpacity>
                  {debugExpanded && (
                    <View style={styles.debugPanel}>
                      <Text style={styles.debugBoundsTitle}>📊 ĐẶC ĐIỂM KHUÔN MẶT</Text>
                      <Text style={styles.debugBoundsSection}>📍 Vị trí (Bounds):</Text>
                      <Text style={styles.debugBoundsText}>
                        x:{faceData.bounds.x.toFixed(0)} y:{faceData.bounds.y.toFixed(0)} w:{faceData.bounds.width.toFixed(0)} h:{faceData.bounds.height.toFixed(0)}
                      </Text>
                      <Text style={styles.debugBoundsSection}>🔄 Góc quay đầu (Head Angles):</Text>
                      <Text style={styles.debugBoundsText}>
                        X: {faceData.headEulerAngleX?.toFixed(1) || 0}°  Y: {faceData.headEulerAngleY?.toFixed(1) || 0}°  Z: {faceData.headEulerAngleZ?.toFixed(1) || 0}°
                      </Text>
                      <Text style={styles.debugBoundsSection}>👁️ Mắt (Eye Open):</Text>
                      <Text style={styles.debugBoundsText}>
                        L: {(faceData.leftEyeOpenProbability || 0).toFixed(2)}  R: {(faceData.rightEyeOpenProbability || 0).toFixed(2)}
                      </Text>
                      <Text style={styles.debugBoundsSection}>😊 Cười (Smiling):</Text>
                      <Text style={styles.debugBoundsText}>
                        {(faceData.smilingProbability || 0).toFixed(2)}
                      </Text>
                      <Text style={styles.debugBoundsSection}>🎯 Landmarks:</Text>
                      <Text style={styles.debugBoundsText}>{faceData.landmarks?.length || 0} điểm</Text>
                      {Array.isArray(faceData.landmarks) && faceData.landmarks.length > 0 && (
                        faceData.landmarks.map((lm, idx) => {
                          const x = lm.position?.x ?? lm.x ?? 0;
                          const y = lm.position?.y ?? lm.y ?? 0;
                          return (
                            <Text style={styles.debugBoundsText} key={idx}>
                              {lm.type || lm.name || `P${idx+1}`}: ({x.toFixed(1)}, {y.toFixed(1)})
                            </Text>
                          );
                        })
                      )}
                      <Text style={styles.debugBoundsSection}>⭐ Chất lượng:</Text>
                      <Text style={styles.debugBoundsText}>
                        {calculateFaceQuality(extractFaceFeatures(faceData)).toFixed(0)}/100
                      </Text>
                    </View>
                  )}
                </View>
                
                {/* Ẩn các điểm landmark trên UI - chỉ hiển thị debug panel */}
                {null}
                
                {/* Ẩn các điểm contour trên UI */}
                {null}
                
                <View style={[
                  styles.faceFrame,
                  { 
                    backgroundColor: canCapture ? "rgba(34, 197, 94, 0.15)" : "rgba(251, 191, 36, 0.15)",
                    borderColor: canCapture ? "#22c55e" : "#f59e0b",
                    borderWidth: canCapture ? 3 : 2,
                    // Move frame down significantly to cover face, not forehead
                    left: (faceData.bounds.x * screenWidth / 1080) -30,
                    top: (faceData.bounds.y * screenWidth / 1080) + 110,   // Moved down much more: +30 to +60
                    width: (faceData.bounds.width * screenWidth / 1080) + 30,
                    height: (faceData.bounds.height * screenWidth / 1080) + 40,
                  }
                ]}>
                  {/* Corner indicators */}
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
                  
                  {/* Center focus point */}
                  <View style={[
                    styles.centerFocus,
                    { backgroundColor: canCapture ? "#22c55e" : "#f59e0b" }
                  ]} />
                  
                  {/* Status text */}
                  <View style={styles.frameStatusText}>
                    <Text style={[
                      styles.frameStatusLabel,
                      { color: canCapture ? "#22c55e" : "#f59e0b" }
                    ]}>
                      {canCapture ? "✅ READY" : "⚠️ ADJUST"}
                    </Text>
                  </View>
                </View>
              </View>
            )}

            {/* Camera Footer */}
            <View style={styles.cameraFooter}>
              {!isMultiPoseActive && (
                <TouchableOpacity 
                  style={[
                    styles.registerBtn,
                    (!canCapture || isCapturing) && styles.registerBtnDisabled
                  ]} 
                  onPress={takePicture}
                  disabled={!canCapture || isCapturing}
                >
                  <View style={styles.registerInnerCircle}>
                    {isCapturing ? (
                      <ActivityIndicator size="small" color="#000" />
                    ) : (
                      <Icon name="face-recognition" size={30} color="#000" />
                    )}
                  </View>
                  <Text style={styles.registerBtnText}>
                    {isCapturing ? "Đang đăng ký..." : "ĐĂNG KÝ KHUÔN MẶT"}
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Instruction Container - Moved to bottom */}
            <View style={styles.instructionContainer}>
              {isMultiPoseActive ? (
                <>
                  <Text style={styles.instructionText}>{getPoseTitle(poseStep)}</Text>
                  <Text style={[styles.instructionText, { opacity: 0.85 }]}>{getPoseHint(poseStep)}</Text>
                  {!faceDetected && (
                    <Text style={styles.instructionText}>🔍 Đang tìm khuôn mặt...</Text>
                  )}
                  {faceDetected && !canCapture && (
                    <Text style={styles.instructionText}>⚠️ Điều chỉnh vị trí khuôn mặt</Text>
                  )}
                  {faceDetected && canCapture && (
                    <Text style={[styles.instructionText, { color: '#22c55e' }]}>✅ Đạt yêu cầu – đang tự ghi nhận...</Text>
                  )}
                </>
              ) : (
                <>
                  {!faceDetected && (
                    <Text style={styles.instructionText}>🔍 Đang tìm khuôn mặt...</Text>
                  )}
                  {faceDetected && !canCapture && (
                    <Text style={styles.instructionText}>⚠️ Điều chỉnh vị trí khuôn mặt</Text>
                  )}
                  {canCapture && (
                    <Text style={styles.instructionText}>✅ Sẵn sàng! Nhấn ĐĂNG KÝ</Text>
                  )}
                </>
              )}
            </View>
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
  registerButtonDisabled: {
    backgroundColor: '#94a3b8',
    opacity: 0.6,
    shadowOpacity: 0.1,
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
    zIndex: 15,
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
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    zIndex: 15,
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
  registerBtn: {
    backgroundColor: '#22c55e',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderRadius: 25,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.8)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  registerBtnDisabled: {
    backgroundColor: '#94a3b8',
    opacity: 0.6,
  },
  registerInnerCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  registerBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  instructionContainer: {
    position: 'absolute',
    bottom: 120,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: 'center',
    zIndex: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  instructionText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
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
    fontSize: 12,
    marginTop: 4,
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
    color: '#ffeb3b',
    fontSize: 12,
    marginTop: 4,
    textAlign: 'center',
    fontWeight: 'bold',
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  adjustmentContainer: {
    alignItems: 'center',
    marginTop: 8,
    backgroundColor: 'rgba(0,0,0,0.6)',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ffeb3b',
  },
  adjustSubText: {
    color: '#fff',
    fontSize: 14,
    marginTop: 6,
    textAlign: 'center',
    fontWeight: '500',
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  readyText: {
    color: '#4ade80',
    fontSize: 12,
    marginTop: 4,
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
    zIndex: 5,
  },
  debugBounds: {
    position: 'absolute',
    top: 10,
    left: 10,
    backgroundColor: 'rgba(0,0,0,0.85)',
    padding: 10,
    borderRadius: 8,
    zIndex: 20,
    maxWidth: '85%',
    maxHeight: '70%',
  },
  debugDock: {
    position: 'absolute',
    left: 10,
    right: 10,
    top: 20,
    zIndex: 20,
  },
  debugHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)'
  },
  debugHeaderText: {
    color: '#60a5fa',
    fontSize: 13,
    fontWeight: 'bold',
    marginLeft: 6,
  },
  debugMiniText: {
    color: '#cbd5e1',
    fontSize: 12,
    fontWeight: '600',
  },
  debugPanel: {
    width: '100%',
    backgroundColor: 'rgba(0,0,0,0.85)',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)'
  },
  debugBoundsTitle: {
    color: '#60a5fa',
    fontSize: 13,
    fontWeight: 'bold',
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.3)',
    paddingBottom: 4,
  },
  debugBoundsSection: {
    color: '#a78bfa',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 6,
    marginBottom: 2,
  },
  debugBoundsText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '400',
    marginBottom: 2,
    fontFamily: 'monospace',
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
  debugContainer: {
    backgroundColor: 'rgba(0,0,0,0.85)',
    borderRadius: 12,
    padding: 12,
    marginTop: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  debugTitle: {
    color: '#ffeb3b',
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  debugSubTitle: {
    color: '#60a5fa',
    fontSize: 12,
    fontWeight: 'bold',
    marginTop: 8,
    marginBottom: 4,
  },
  debugText: {
    color: '#fff',
    fontSize: 11,
    marginBottom: 3,
    fontFamily: 'monospace',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  statusIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  centerFocus: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: -4,
    marginLeft: -4,
  },
  frameStatusText: {
    position: 'absolute',
    top: -30,
    left: '50%',
    marginLeft: -30,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  frameStatusLabel: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  noFaceIndicator: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginTop: -60,
    marginLeft: -100,
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
    padding: 20,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#ef4444',
  },
  noFaceIcon: {
    marginBottom: 12,
  },
  noFaceText: {
    color: '#ef4444',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 4,
  },
  noFaceSubText: {
    color: '#fff',
    fontSize: 12,
    textAlign: 'center',
  },
  landmarkPoint: {
    position: 'absolute',
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.7,
    shadowRadius: 3,
    elevation: 5,
  },
  landmarkLabel: {
    position: 'absolute',
    top: 12,
    left: -15,
    backgroundColor: 'rgba(0,0,0,0.7)',
    color: '#fff',
    fontSize: 9,
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
    fontWeight: '600',
    minWidth: 40,
    textAlign: 'center',
  },
  contourContainer: {
    position: 'absolute',
  },
  contourPoint: {
    position: 'absolute',
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#00ff00',
    borderWidth: 1,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 1,
    elevation: 2,
  },
});

export default FaceRegistrationScreen;
