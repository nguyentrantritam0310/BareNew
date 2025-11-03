import React, { useRef, useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, Dimensions, ScrollView } from 'react-native';
import { Camera, useCameraDevices } from 'react-native-vision-camera';
import FaceDetection from '@react-native-ml-kit/face-detection';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import api from '../api';
import RNFS from 'react-native-fs';
import { AppState } from 'react-native';
import faceNetService from '../services/faceNetService';

const { width, height } = Dimensions.get('window');

// Face detection constants - Very lenient for easy recognition
const MIN_FACE_SIZE = 0.001; // Minimum face size relative to frame (extremely lenient)
const MAX_HEAD_ANGLE = 90; // Maximum head rotation angle in degrees (very permissive)

const SimpleFaceRecognitionCamera = ({ onFaceRecognized, onClose, user }) => {
  const ENABLE_SIMULATED_DETECTION = false;
  const [facing, setFacing] = useState('front');
  const [permission, setPermission] = useState(null);
  const [isDetecting, setIsDetecting] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [detectionCount, setDetectionCount] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [facesDetected, setFacesDetected] = useState([]);
  const [verificationStatus, setVerificationStatus] = useState('idle'); // 'idle' | 'detecting' | 'verifying' | 'success' | 'error'
  const [verificationMessage, setVerificationMessage] = useState('');
  const [hasVerified, setHasVerified] = useState(false); // Prevent duplicate verification
  const [debugExpanded, setDebugExpanded] = useState(false); // Debug panel expand/collapse
  
  const cameraRef = useRef(null);
  const devices = useCameraDevices();
  
  // Use the same logic as FaceRegistrationScreen.js
  const device = devices.find(d => d.position === facing);
  
  console.log('📱 Available devices:', devices);
  console.log('📷 Selected device:', device);
  console.log('📷 Facing:', facing);

  // Load FaceNet model on component mount
  useEffect(() => {
    const loadFaceNetModel = async () => {
      try {
        console.log('🔄 Attempting to load FaceNet model...');
        const loaded = await faceNetService.loadModel();
        if (loaded) {
          console.log('✅ FaceNet model loaded successfully. Will use 512-dim embeddings.');
        } else {
          console.log('⚠️ FaceNet model not available. Falling back to custom 256-dim embeddings.');
        }
      } catch (error) {
        console.error('❌ Error loading FaceNet model:', error);
        console.log('⚠️ Will use custom embedding fallback');
      }
    };
    loadFaceNetModel();
  }, []);

  useEffect(() => {
    checkCameraPermission();
    // Lắng nghe khi app quay lại foreground để re-check quyền
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        console.log('🔄 App về foreground, kiểm tra lại quyền camera...');
        checkCameraPermission();
      }
    });
    return () => {
      sub?.remove?.();
    };
  }, []);

  // Auto-start face detection when camera is ready
  useEffect(() => {
    console.log('[AUTO-START CHECK] perm=', permission, ' device=', !!device, ' cameraReady=', cameraReady, ' isDetecting=', isDetecting, ' hasVerified=', hasVerified);
    if (permission === 'granted' && device && cameraReady && !isDetecting && !hasVerified) {
      console.log('🚀 Auto-starting face detection (camera initialized)...');
      const timer = setTimeout(() => {
        startFaceDetection();
      }, 700);
      return () => clearTimeout(timer);
    }
  }, [permission, device, cameraReady, hasVerified, isDetecting]);

  const checkCameraPermission = async () => {
    try {
      console.log('🔍 Kiểm tra quyền camera hiện tại...');
      const current = (await Camera.getCameraPermissionStatus?.()) || null;
      console.log('🔎 Trạng thái hiện tại:', current);

      // Chuẩn hoá: authorized -> granted
      const normalize = (val) => (val === 'authorized' ? 'granted' : val);

      if (current && (current === 'authorized' || current === 'granted')) {
        setPermission('granted');
        return;
      }

      console.log('📥 Yêu cầu quyền camera...');
      const requested = await Camera.requestCameraPermission();
      console.log('✅ Kết quả request:', requested);
      setPermission(normalize(requested));
    } catch (error) {
      console.error('❌ Camera permission error:', error);
      setPermission('denied');
    }
  };

  const startFaceDetection = () => {
    if (detectionIntervalRef.current) {
      console.log('[START] Interval đã tồn tại, không tạo trùng.');
      return;
    }
    setIsDetecting(true);
    setDetectionCount(0);
    setFacesDetected([]);
    setVerificationStatus('detecting');
    setVerificationMessage('');
    setHasVerified(false);
    startMLKitDetection();
  };

  const stopFaceDetection = () => {
    console.log('🛑 [STOP] Stopping face detection...');
    // Set verified flag immediately to prevent any further processing
    hasVerifiedRef.current = true;
    setIsDetecting(false);
    setDetectionCount(0);
    setFacesDetected([]);
    if (detectionIntervalRef.current) {
      clearInterval(detectionIntervalRef.current);
      detectionIntervalRef.current = null;
      console.log('✅ [STOP] Detection interval cleared');
    }
  };

  const detectionIntervalRef = useRef(null);
  const [currentFaceData, setCurrentFaceData] = useState(null);
  // Refs để tránh stale state trong interval
  const isDetectingRef = useRef(false);
  const cameraReadyRef = useRef(false);
  const hasVerifiedRef = useRef(false);
  const isVerifyingRef = useRef(false); // Prevent duplicate verification calls

  useEffect(() => { isDetectingRef.current = isDetecting; }, [isDetecting]);
  useEffect(() => { cameraReadyRef.current = cameraReady; }, [cameraReady]);
  useEffect(() => { hasVerifiedRef.current = hasVerified; }, [hasVerified]);

  // Normalize ML Kit face data to expected format (same as FaceRegistrationScreen)
  const normalizeFaceData = (mlKitFace) => {
    if (!mlKitFace) return null;
    
    // Log raw ML Kit face data to understand structure
    console.log('🔍 Raw ML Kit Face:', JSON.stringify(mlKitFace, null, 2));
    
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
      console.warn('⚠️ No bounds found in ML Kit face data');
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

  // Extract face features (same as FaceRegistrationScreen)
  const extractFaceFeatures = (face) => {
    if (!face) return null;
    
    const landmarks = face.landmarks ? face.landmarks.map(landmark => ({
      type: landmark.type || landmark.name || 'unknown',
      x: landmark.position?.x || landmark.x || 0,
      y: landmark.position?.y || landmark.y || 0,
    })) : [];
    
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

  // Face quality validation (same as FaceRegistrationScreen)
  const isGoodFaceQuality = (face) => {
    if (!face) return false;
    
    const { bounds, headEulerAngleX, headEulerAngleY, headEulerAngleZ } = face;
    
    console.log('🔍 Face quality validation - bounds:', bounds);
    console.log('🔍 Face quality validation - angles:', { headEulerAngleX, headEulerAngleY, headEulerAngleZ });
    
    // Check if bounds exist and are valid
    if (!bounds || typeof bounds.x !== 'number' || typeof bounds.y !== 'number' || 
        typeof bounds.width !== 'number' || typeof bounds.height !== 'number') {
      console.log('❌ Invalid bounds structure');
      return false;
    }
    
    // Check face size (normalize to screen dimensions for comparison)
    const faceArea = bounds.width * bounds.height;
    const screenArea = width * width; // Assuming square aspect ratio
    const normalizedFaceSize = faceArea / screenArea;
    
    console.log('🔍 Face size check - area:', faceArea, 'normalized:', normalizedFaceSize, 'min required:', MIN_FACE_SIZE);
    
    if (normalizedFaceSize < MIN_FACE_SIZE) {
      console.log('❌ Face too small');
      return false;
    }
    
    // Head rotation checks - very permissive (accept up to 90 degrees)
    const maxAngle = MAX_HEAD_ANGLE;
    console.log('🔍 Angle checks - X:', Math.abs(headEulerAngleX), 'Y:', Math.abs(headEulerAngleY), 'Z:', Math.abs(headEulerAngleZ), 'max:', maxAngle);
    
    // Only reject if angle is extremely large (beyond 90 degrees)
    if (Math.abs(headEulerAngleX) > maxAngle) {
      console.log('⚠️ Head tilt X large but acceptable:', headEulerAngleX);
      // Don't reject, just warn
    }
    if (Math.abs(headEulerAngleY) > maxAngle) {
      console.log('⚠️ Head tilt Y large but acceptable:', headEulerAngleY);
      // Don't reject, just warn
    }
    if (Math.abs(headEulerAngleZ) > maxAngle) {
      console.log('⚠️ Head rotation Z large but acceptable:', headEulerAngleZ);
      // Don't reject, just warn
    }
    
    // Check face position in frame (normalize coordinates)
    const normalizedX = bounds.x / width;
    const normalizedY = bounds.y / width;
    const normalizedWidth = bounds.width / width;
    const normalizedHeight = bounds.height / width;
    
    console.log('🔍 Position checks - normalized X:', normalizedX, 'Y:', normalizedY, 'W:', normalizedWidth, 'H:', normalizedHeight);
    
    // Position checks removed - accept face anywhere in frame
    // Only check if face has valid bounds (already checked above)
    
    console.log('✅ Face quality check passed!');
    return true;
  };

  // Calculate face quality score (same as FaceRegistrationScreen)
  const calculateFaceQuality = (faceData) => {
    if (!faceData) return 0;
    
    let qualityScore = 100;
    
    // Deduct points for head rotation
    const angleX = Math.abs(faceData.headEulerAngleX || 0);
    const angleY = Math.abs(faceData.headEulerAngleY || 0);
    const angleZ = Math.abs(faceData.headEulerAngleZ || 0);
    
    qualityScore -= (angleX + angleY + angleZ) * 2; // 2 points per degree
    
    // Deduct points for small face size
    const faceSize = (faceData.bounds?.width || 0) * (faceData.bounds?.height || 0);
    if (faceSize < 0.2) qualityScore -= 20;
    else if (faceSize < 0.3) qualityScore -= 10;
    
    // Bonus points for good eye openness
    const leftEyeOpen = faceData.leftEyeOpenProbability || 0;
    const rightEyeOpen = faceData.rightEyeOpenProbability || 0;
    const avgEyeOpen = (leftEyeOpen + rightEyeOpen) / 2;
    
    if (avgEyeOpen > 0.8) qualityScore += 10;
    else if (avgEyeOpen < 0.5) qualityScore -= 15;
    
    // Bonus points for smiling (optional)
    const smiling = faceData.smilingProbability || 0;
    if (smiling > 0.7) qualityScore += 5;
    
    return Math.max(0, Math.min(100, qualityScore));
  };

  const startMLKitDetection = () => {
    if (detectionIntervalRef.current) {
      clearInterval(detectionIntervalRef.current);
    }
    console.log('🟢 [BẮT ĐẦU QUÉT KHUÔN MẶT] Khởi động vòng lặp ML Kit detect...');
    detectionIntervalRef.current = setInterval(async () => {
      if (!isDetectingRef.current) {
        console.log('[DETECT LOOP] Bỏ qua: isDetecting=false');
        return;
      }
      if (!cameraRef.current) {
        console.log('[DETECT LOOP] Bỏ qua: cameraRef.current=null (camera chưa sẵn sàng)');
        return;
      }
      if (!cameraReadyRef.current) {
        console.log('[DETECT LOOP] Bỏ qua: cameraReady=false');
        return;
      }
      // CRITICAL: Check verified flag first - if already verified, stop immediately
      if (hasVerifiedRef.current || hasVerified || verificationStatus === 'success') {
        console.log('🛑 [DETECT LOOP] Dừng: đã verified hoặc đã thành công');
        stopFaceDetection();
        return;
      }
      
      // Also check if currently verifying - don't start new verification
      if (verificationStatus === 'verifying') {
        console.log('⏸️ [DETECT LOOP] Đang verify, bỏ qua...');
        return;
      }
      
      try {
        console.log('📸 [CHỤP ẢNH] Chuẩn bị chụp ảnh để detect...');
        const photo = await cameraRef.current.takePhoto({
          qualityPrioritization: 'speed',
          flash: 'off',
          skipMetadata: true,
        });
        console.log('📷 [MLKIT] Ảnh đã chụp:', photo.path);
        let faces = [];
        try {
          console.log('🔍 [MLKIT] Gọi detect khuôn mặt - detect()...');
          try {
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
            console.log('⚠️ [MLKIT] Không hỗ trợ options, thử lại đơn giản:', optionsError.message);
            faces = await FaceDetection.detect(`file://${photo.path}`);
          }
          console.log('🔵 [MLKIT] Raw response:', JSON.stringify(faces, null, 2));
          console.log('[MLKIT] Số lượng khuôn mặt phát hiện:', faces?.length);

          faces = faces.map(normalizeFaceData).filter(f => f !== null);
          console.log('🟣 [CHUYỂN ĐỔI] Khuôn mặt đã normalize:', faces);
          if (faces[0]) {
            console.log(`[NORMALIZE] Bound:`, faces[0].bounds, 'Landmarks:', faces[0].landmarks?.length);
            if (faces[0].landmarks?.length) {
              for (let i = 0; i < Math.min(5, faces[0].landmarks.length); i++) {
                console.log(`[ĐIỂM LANDMARK ${i}]:`, faces[0].landmarks[i]);
              }
            }
          }
        } catch (mlKitError) {
          console.error('❌ [MLKIT] Không detect được:', mlKitError);
          faces = [];
        }
        if (faces && faces.length > 0) {
          const faceData = faces[0];
          const isGoodQuality = isGoodFaceQuality(faceData);
          const screenFaces = faces.map((face) => ({
            bounds: {
              x: (face.bounds.x / 1080) * width,
              y: (face.bounds.y / 1080) * width + 110,
              width: (face.bounds.width / 1080) * width,
              height: (face.bounds.height / 1080) * width,
            },
            landmarks: face.landmarks,
            contours: face.contours,
            headEulerAngles: {
              x: face.headEulerAngleX,
              y: face.headEulerAngleY,
              z: face.headEulerAngleZ
            }
          }));
          setFacesDetected(screenFaces);
          setCurrentFaceData(faceData);
          // FaceNet embedding sẽ được extract trong processFaceRecognition khi verify
          // Verify immediately when face is detected - only check if face has valid bounds
          // IMPORTANT: Check both state and ref to prevent race condition
          if (faces && faces.length > 0 && faceData && faceData.bounds && 
              !hasVerified && !hasVerifiedRef.current && verificationStatus !== 'verifying') {
            // Only basic check: face bounds must exist and be valid
            const { width: bw, height: bh } = faceData.bounds || {};
            if (bw > 0 && bh > 0) {
              // Double check before starting verification
            if (!hasVerifiedRef.current && !hasVerified && verificationStatus !== 'verifying') {
              console.log('🎯 [DETECT] Phát hiện khuôn mặt -> verify ngay lập tức...');
              setVerificationStatus('verifying');
              processFaceRecognition(faceData, photo.path);
            } else {
              console.log('⚠️ [DETECT] Bỏ qua: đã verify hoặc đang verify');
            }
            } else {
              console.log('⚠️ [DETECT] Face bounds không hợp lệ, bỏ qua...');
            }
          } else {
            if (verificationStatus !== 'verifying') {
              setVerificationStatus('detecting');
            }
          }
        } else {
          console.log('❌ [MLKIT] Không nhận diện được mặt.');
          setFacesDetected([]);
          setCurrentFaceData(null);
          setDetectionCount(0);
          if (verificationStatus !== 'verifying') {
            setVerificationStatus('detecting');
          }
        }
      } catch (error) {
        console.error('❌ [QUY TRÌNH DETECT] Lỗi:', error);
      }
    }, 1000);
  };

  const simulateFaceDetection = () => {
    if (!isDetecting) return;
    
    // Simulate face detection with random success
    const hasFace = Math.random() > 0.3; // 70% chance of detecting a face
    
    if (hasFace) {
      // Simulate face bounds in center area
      const mockFace = {
        bounds: {
          x: width * 0.3 + Math.random() * width * 0.4, // Center area
          y: height * 0.3 + Math.random() * height * 0.4, // Center area
          width: 120 + Math.random() * 40,
          height: 150 + Math.random() * 40,
        }
      };
      
      console.log('🎭 Simulated face detected at:', mockFace.bounds);
      setFacesDetected([mockFace]);
      setDetectionCount(prev => {
        const newCount = prev + 1;
        console.log(`✅ Simulated face detected ${newCount}/3 times`);
        if (newCount >= 3) {
          processFaceRecognition();
        }
        return newCount;
      });
    } else {
      setFacesDetected([]);
      setDetectionCount(0);
    }
  };

  // Extract FaceNet embedding from face image using local model
  const extractFaceNetEmbedding = async (photoPath, faceBounds) => {
    try {
      // Ensure model is loaded
      const loaded = await faceNetService.loadModel();
      if (!loaded || !faceNetService.isReady()) {
        throw new Error('FaceNet model not loaded. Please ensure facenet_512.tflite is available in assets.');
      }

      console.log('🔄 Extracting FaceNet embedding...');
      console.log(`📸 Image path: ${photoPath}`);
      console.log(`📐 Face bounds:`, faceBounds);
      
      // Call FaceNet service to extract embedding (will try local first, then server API)
      const embedding = await faceNetService.extractEmbedding(photoPath, faceBounds);
      
      if (!embedding) {
        throw new Error('FaceNet service returned null embedding');
      }
      
      if (embedding.length !== 512) {
        throw new Error(`Invalid embedding dimension: expected 512, got ${embedding.length}`);
      }
      
      console.log(`✅ FaceNet embedding extracted: ${embedding.length} dimensions`);
      return embedding;
    } catch (error) {
      console.error('❌ Error extracting FaceNet embedding:', error);
      console.error('❌ Error details:', error.message);
      console.error('❌ Stack trace:', error.stack);
      // Throw error instead of returning null so caller knows what went wrong
      throw error;
    }
  }

  const processFaceRecognition = async (faceDataParam = null, photoPath = null) => {
    // CRITICAL: Prevent duplicate verification calls
    if (hasVerifiedRef.current || hasVerified) {
      console.log('⚠️ [VERIFY] Đã verified rồi, bỏ qua...');
      return;
    }
    
    // Prevent concurrent verification calls
    if (isVerifyingRef.current) {
      console.log('⚠️ [VERIFY] Đang verify, bỏ qua duplicate call...');
      return;
    }
    
    // Set verifying flag immediately (before async operations)
    isVerifyingRef.current = true;
    setVerificationStatus('verifying');
    setIsProcessing(true);
    setVerificationMessage('Đang xác minh khuôn mặt...');
    
    try {
      const faceDataToUse = faceDataParam || currentFaceData;
      // Minimal prechecks - only check if face bounds exist
      const lmCount = Array.isArray(faceDataToUse?.landmarks) ? faceDataToUse.landmarks.length : 0;
      const quality = calculateFaceQuality(faceDataToUse);
      console.log(`[PRECHECK] landmarks=${lmCount}, quality=${quality}`);
      // Very relaxed: only require face bounds, landmarks and quality are optional
      if (!faceDataToUse?.bounds) {
        throw new Error('Face bounds are missing');
      }
      
      // FaceNet is required - NO fallback to custom embedding
      // If FaceNet fails, throw error so we know what went wrong
      if (!photoPath) {
        throw new Error('FaceNet requires photo path. Photo path is missing.');
      }
      
      if (!faceDataToUse?.bounds) {
        throw new Error('FaceNet requires face bounds. Face bounds are missing.');
      }
      
      console.log('🔄 Attempting to extract FaceNet embedding...');
      const embedding = await extractFaceNetEmbedding(photoPath, faceDataToUse.bounds);
      
      if (!embedding || embedding.length !== 512) {
        throw new Error(`FaceNet embedding extraction failed: got ${embedding?.length || 0} dimensions, expected 512`);
      }
      
      console.log('✅ Using FaceNet 512-dim embedding');
      const embeddingSource = 'facenet';
      
      // L2 normalize (FaceNet embeddings should already be normalized, but ensure it)
      const norm = Math.sqrt(embedding.reduce((s, v) => s + v * v, 0));
      if (!isFinite(norm) || norm <= 0) {
        throw new Error('FaceNet embedding is invalid (norm=0)');
      }
      
      // Convert TypedArray (Float32Array) to regular Array for JSON serialization
      // This ensures the server can properly deserialize the embedding
      const embeddingArray = Array.isArray(embedding) 
        ? embedding 
        : (embedding.length ? Array.from(embedding) : []);
      
      // Validate embedding dimension
      if (embeddingArray.length !== 512) {
        throw new Error(`Invalid embedding dimension: ${embeddingArray.length} (expected 512)`);
      }
      
      console.log(`🟠 [VERIFY] Payload gửi verify-embedding (${embeddingSource}, ${embeddingArray.length} dim):`, { 
        id: user?.id, 
        embFirst10: embeddingArray.slice(0, 10), 
        length: embeddingArray.length,
        source: embeddingSource
      });
      const verifyRequest = {
        employeeId: user?.id,
        embedding: embeddingArray, // Use regular array, not TypedArray
      };
      try {
        const response = await api.post('/FaceRegistration/verify-embedding', verifyRequest);
        console.log('🟢 [VERIFY API] Response trả về:', response.data);
        if (response.data && response.data.success) {
          const recognitionResult = {
            success: response.data.success,
            isMatch: response.data.isMatch,
            confidence: response.data.confidence,
            employeeId: user?.id,
            employeeName: response.data.employeeName || user?.fullName,
            matchedFaceId: response.data.matchedFaceId,
            message: response.data.message,
          };
          console.log('✅ [RESULT] Kết quả so khớp:', recognitionResult);
          // Trust server's decision - if server says isMatch, accept it
          // Server already validates threshold (0.88 for FaceNet, 0.94 for custom)
          if (response.data.isMatch) {
            // CRITICAL: Set flags immediately to prevent any further processing
            hasVerifiedRef.current = true;
            isVerifyingRef.current = false; // Reset verifying flag
            setHasVerified(true);
            setVerificationStatus('success');
            const confidencePercent = (response.data.confidence * 100).toFixed(1);
            stopFaceDetection(); // Stop detection loop immediately
            console.log('🛑 [VERIFY] Đã dừng detection sau khi verify thành công');

            // Gọi API chấm công không ảnh (check-in)
            try {
              // Ensure api is available
              if (typeof api === 'undefined' || !api || !api.post) {
                console.error('❌ [ATTENDANCE] API is not available');
                throw new Error('API service is not available');
              }

              console.log('📤 [ATTENDANCE] Gọi checkin-noimage...');
              
              // Generate unique verification token to prevent replay attacks
              const verificationToken = `${user?.id}_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
              // Get current datetime in local timezone (GMT+7 for Vietnam)
              // Format as local datetime string (YYYY-MM-DDTHH:mm:ss) without timezone info
              const now = new Date();
              const year = now.getFullYear();
              const month = String(now.getMonth() + 1).padStart(2, '0');
              const day = String(now.getDate()).padStart(2, '0');
              const hours = String(now.getHours()).padStart(2, '0');
              const minutes = String(now.getMinutes()).padStart(2, '0');
              const seconds = String(now.getSeconds()).padStart(2, '0');
              const localDateTime = `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
              const verificationTimestamp = localDateTime;
              
              // Attendance body with all required fields for checkin-noimage API
              // Use PascalCase to match backend DTO (C# model binding handles camelCase, but PascalCase is safer)
              const attendanceBody = {
                EmployeeId: user?.id,
                CheckInDateTime: localDateTime,
                Latitude: 0,
                Longitude: 0,
                Location: 'Mobile App - Face Recognition',
                AttendanceMachineId: 2,
                Notes: 'Check-in bằng nhận diện khuôn mặt (FaceNet)',
                // Required face verification fields (PascalCase)
                MatchedFaceId: recognitionResult.matchedFaceId || '',
                MatchConfidence: recognitionResult.confidence || 0,
                // Required security fields (PascalCase)
                VerificationTimestamp: verificationTimestamp,
                VerificationToken: verificationToken,
              };
              
              console.log('📦 [ATTENDANCE] Sending check-in data:', {
                EmployeeId: attendanceBody.EmployeeId,
                MatchedFaceId: attendanceBody.MatchedFaceId,
                MatchConfidence: attendanceBody.MatchConfidence,
                VerificationTimestamp: attendanceBody.VerificationTimestamp,
                VerificationToken: attendanceBody.VerificationToken ? `${attendanceBody.VerificationToken.substring(0, 20)}...` : 'missing'
              });
              console.log('📦 [ATTENDANCE] Full request body keys:', Object.keys(attendanceBody));
              
              const attendanceRes = await api.post('/Attendance/checkin-noimage', attendanceBody);
              console.log('🟢 [ATTENDANCE] Kết quả check-in:', attendanceRes.data);
              
              if (attendanceRes.data && attendanceRes.data.success) {
                recognitionResult.attendance = attendanceRes.data;
                setVerificationMessage(`✅ Nhận diện thành công! Chấm công thành công (${confidencePercent}%)`);
              } else {
                // If check-in failed but face verified, show warning but don't fail
                console.warn('⚠️ [ATTENDANCE] Check-in failed but face verified:', attendanceRes.data);
                setVerificationMessage(`✅ Nhận diện thành công! (${confidencePercent}%) - Chấm công: ${attendanceRes.data?.message || 'Thất bại'}`);
              }
            } catch (attErr) {
              console.error('❌ [ATTENDANCE] Check-in Error:', attErr);
              console.error('❌ [ATTENDANCE] Error details:', attErr.message);
              console.error('❌ [ATTENDANCE] Error stack:', attErr.stack);
              // Don't fail verification if check-in fails - just show warning
              const errorMessage = attErr.response?.data?.message || attErr.message || 'Lỗi khi chấm công';
              setVerificationMessage(`✅ Nhận diện thành công! (${confidencePercent}%) - Chấm công: ${errorMessage}`);
            }
            // Close camera after successful verification and check-in
            setTimeout(() => {
              console.log('🔄 [CLOSE] Closing camera after successful verification...');
              // Ensure detection is stopped before closing
              stopFaceDetection();
              if (onFaceRecognized) {
                onFaceRecognized({ imageBase64: null, recognitionResult });
              }
              if (onClose) {
                onClose();
              }
            }, 2000); // Increase delay slightly to show success message
          } else {
            setVerificationStatus('error');
            const errorMsg = response.data.message || `Không nhận diện được (${(response.data.confidence * 100).toFixed(1)}%)`;
            setVerificationMessage(`❌ ${errorMsg}`);
            setDetectionCount(0);
            setHasVerified(false);
            setTimeout(() => {
              if (!hasVerified) {
                setVerificationStatus('detecting');
                setVerificationMessage('');
              }
            }, 3000);
          }
        } else {
          throw new Error(response.data?.message || 'Verify API trả về lỗi');
        }
      } catch (apiError) {
        console.error('❌ [VERIFY API] Lỗi:', apiError);
        console.error('❌ Error response:', apiError.response?.data);
        console.error('❌ Error status:', apiError.response?.status);
        console.error('❌ Error message:', apiError.message);
        const errorMessage = apiError.response?.data?.message || apiError.response?.data?.Message || apiError.message || 'Không thể xác minh khuôn mặt';
        setVerificationStatus('error');
        setVerificationMessage(`❌ ${errorMessage}`);
        setDetectionCount(0);
        setHasVerified(false);
        setTimeout(() => {
          if (!hasVerified) {
            setVerificationStatus('detecting');
            setVerificationMessage('');
          }
        }, 3000);
      }
    } catch (error) {
      console.error('❌ [QUY TRÌNH VERIFY] Lỗi:', error);
      console.error('❌ Error details:', error.message);
      console.error('❌ Error stack:', error.stack);
      const errorMessage = error.response?.data?.message || error.response?.data?.Message || error.message || 'Không thể xác minh khuôn mặt';
      setVerificationStatus('error');
      setVerificationMessage(`❌ ${errorMessage}`);
      setDetectionCount(0);
      setHasVerified(false);
      setTimeout(() => {
        if (!hasVerified) {
          setVerificationStatus('detecting');
          setVerificationMessage('');
        }
      }, 3000);
    } finally {
      // Reset verifying flag only if not verified (allow retry on error)
      if (!hasVerifiedRef.current && !hasVerified) {
        isVerifyingRef.current = false;
      }
      setIsProcessing(false);
    }
  };

  // DEPRECATED: Custom embedding function - NO LONGER USED
  // FaceNet embedding (512-dim) is now used exclusively via faceNetService
  // Keeping this for reference only - will be removed in future cleanup
  const computeEmbeddingFromFaceData_DEPRECATED = (face) => {
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


  const toggleCameraType = () => {
    setFacing(current => current === 'back' ? 'front' : 'back');
  };

  const handleClose = () => {
    stopFaceDetection();
    setVerificationStatus('idle');
    setVerificationMessage('');
    setHasVerified(false);
    if (onClose) onClose();
  };

  if (!permission) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Đang kiểm tra quyền camera...</Text>
      </View>
    );
  }

  if (permission !== 'granted') {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>
          {permission === 'denied' 
            ? 'Camera permission denied. Please enable in Settings.' 
            : 'Requesting camera permission...'
          }
        </Text>
        
        {permission === 'denied' && (
          <TouchableOpacity 
            style={styles.retryBtn} 
            onPress={checkCameraPermission}
          >
            <Text style={styles.retryBtnText}>Thử lại</Text>
          </TouchableOpacity>
        )}
        
        {permission === null && (
          <TouchableOpacity 
            style={styles.retryBtn} 
            onPress={checkCameraPermission}
          >
            <Text style={styles.retryBtnText}>Thử lại</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  if (!device) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Không tìm thấy camera</Text>
        <Text style={styles.errorSubText}>
          Available devices: {Object.keys(devices).join(', ')}
        </Text>
        <TouchableOpacity 
          style={styles.retryBtn} 
          onPress={() => {
            // Try to switch camera type
            setFacing(facing === 'front' ? 'back' : 'front');
          }}
        >
          <Text style={styles.retryBtnText}>Thử camera khác</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Camera
        ref={cameraRef}
        style={styles.camera}
        device={device}
        isActive={true}
        photo={true}
        onInitialized={() => {
          console.log('✅ [CAMERA] onInitialized');
          setCameraReady(true);
        }}
        onError={(e) => {
          console.log('❌ [CAMERA] onError:', e?.message || e);
          setCameraReady(false);
        }}
      />

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

      {/* Detection overlay (frame + status) */}
      {currentFaceData && (
        <View style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}>
          <View
            style={{
              position: 'absolute',
              left: (currentFaceData.bounds.x * width / 1080) - 30,
              top: (currentFaceData.bounds.y * width / 1080) + 110,
              width: (currentFaceData.bounds.width * width / 1080) + 30,
              height: (currentFaceData.bounds.height * width / 1080) + 40,
              borderWidth: 3,
              borderColor: verificationStatus === 'success' ? '#10b981' : (verificationStatus === 'verifying' ? '#3b82f6' : (isGoodFaceQuality(currentFaceData) ? '#22c55e' : '#f59e0b')),
              borderRadius: 20,
              backgroundColor:
                verificationStatus === 'success' ? 'rgba(16,185,129,0.15)'
                : verificationStatus === 'verifying' ? 'rgba(59,130,246,0.15)'
                : isGoodFaceQuality(currentFaceData) ? 'rgba(34,197,94,0.15)'
                : 'rgba(251,191,36,0.15)'
            }}
          />
          <View style={{
            position: 'absolute',
            left: 20,
            right: 20,
            bottom: 120,
            backgroundColor: 'rgba(0,0,0,0.7)',
            borderRadius: 12,
            paddingVertical: 10,
            paddingHorizontal: 16,
            alignItems: 'center',
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.3)'
          }}>
            {verificationStatus === 'detecting' && (
              <Text style={{ color: '#fff', fontSize: 13, fontWeight: '600' }}>
                {isGoodFaceQuality(currentFaceData) ? '✅ Sẵn sàng! Đang chuẩn bị xác minh...' : '⚠️ Điều chỉnh vị trí khuôn mặt'}
              </Text>
            )}
            {verificationStatus === 'verifying' && (
              <Text style={{ color: '#3b82f6', fontSize: 13, fontWeight: '600' }}>⏳ Đang xác minh khuôn mặt...</Text>
            )}
            {verificationStatus === 'success' && (
              <Text style={{ color: '#10b981', fontSize: 13, fontWeight: '600' }}>✅ Nhận diện thành công!</Text>
            )}
            {verificationStatus === 'error' && (
              <Text style={{ color: '#ef4444', fontSize: 13, fontWeight: '600' }}>❌ Nhận diện thất bại. Đang thử lại...</Text>
            )}
          </View>
        </View>
      )}

      {/* Face Detection Overlay - Similar to FaceRegistrationScreen */}
      {currentFaceData && facesDetected.length > 0 && (
        <View style={styles.faceOverlay}>
          {/* Debug dock (top, collapsible) */}
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
                {`LM ${currentFaceData.landmarks?.length || 0}`} · {`Q ${calculateFaceQuality(currentFaceData).toFixed(0)}`}
              </Text>
            </TouchableOpacity>
            {debugExpanded && (
              <ScrollView style={styles.debugPanel} showsVerticalScrollIndicator={true}>
                <Text style={styles.debugBoundsTitle}>📊 ĐẶC ĐIỂM KHUÔN MẶT</Text>
                <Text style={styles.debugBoundsSection}>📍 Vị trí (Bounds):</Text>
                <Text style={styles.debugBoundsText}>
                  x:{currentFaceData.bounds?.x?.toFixed(0) || 0} y:{currentFaceData.bounds?.y?.toFixed(0) || 0} 
                  w:{currentFaceData.bounds?.width?.toFixed(0) || 0} h:{currentFaceData.bounds?.height?.toFixed(0) || 0}
                </Text>
                <Text style={styles.debugBoundsSection}>🔄 Góc quay đầu (Head Angles):</Text>
                <Text style={styles.debugBoundsText}>
                  X: {(currentFaceData.headEulerAngleX || 0).toFixed(1)}° 
                  Y: {(currentFaceData.headEulerAngleY || 0).toFixed(1)}° 
                  Z: {(currentFaceData.headEulerAngleZ || 0).toFixed(1)}°
                </Text>
                <Text style={styles.debugBoundsSection}>👁️ Mắt (Eye Open):</Text>
                <Text style={styles.debugBoundsText}>
                  Trái: {(currentFaceData.leftEyeOpenProbability || 0).toFixed(2)} 
                  Phải: {(currentFaceData.rightEyeOpenProbability || 0).toFixed(2)}
                </Text>
                <Text style={styles.debugBoundsSection}>😊 Cười (Smiling):</Text>
                <Text style={styles.debugBoundsText}>
                  {(currentFaceData.smilingProbability || 0).toFixed(2)}
                </Text>
                <Text style={styles.debugBoundsSection}>🎯 Điểm mốc (Landmarks):</Text>
                <Text style={styles.debugBoundsText}>
                  {currentFaceData.landmarks?.length || 0} điểm
                </Text>
                {currentFaceData.landmarks && currentFaceData.landmarks.length > 0 && (
                  currentFaceData.landmarks.slice(0, 5).map((lm, i) => {
                    const x = lm.position?.x || lm.x || 0;
                    const y = lm.position?.y || lm.y || 0;
                    const type = lm.type || `P${i + 1}`;
                    return (
                      <Text key={i} style={styles.debugBoundsText}>
                        {type}: ({x.toFixed(1)}, {y.toFixed(1)})
                      </Text>
                    );
                  })
                )}
                <Text style={styles.debugBoundsSection}>📐 Đường viền (Contours):</Text>
                <Text style={styles.debugBoundsText}>
                  {currentFaceData.contours?.length || 0} đường viền
                </Text>
                <Text style={styles.debugBoundsSection}>⭐ Chất lượng:</Text>
                <Text style={styles.debugBoundsText}>
                  Quality: {currentFaceData ? calculateFaceQuality(currentFaceData).toFixed(0) : 0}/100
                  {currentFaceData.confidence !== undefined && currentFaceData.confidence !== null && (
                    `\nConfidence: ${(currentFaceData.confidence * 100).toFixed(1)}%`
                  )}
                </Text>
                <Text style={styles.debugBoundsSection}>🆔 Tracking:</Text>
                <Text style={styles.debugBoundsText}>
                  ID: {currentFaceData.trackingId || 'N/A'}
                </Text>
              </ScrollView>
            )}
          </View>

          {/* KHÔNG vẽ landmark/contour lên camera */}
          {facesDetected.map((face, index) => {
            const canCapture = detectionCount >= 2 && isGoodFaceQuality(currentFaceData);
            return (
              <View
                key={`frame-${index}`}
                style={[
                  styles.faceFrame,
                  { 
                    backgroundColor: 
                      verificationStatus === 'success' ? "rgba(16, 185, 129, 0.15)" :
                      verificationStatus === 'verifying' ? "rgba(59, 130, 246, 0.15)" :
                      verificationStatus === 'error' ? "rgba(239, 68, 68, 0.15)" :
                      canCapture ? "rgba(34, 197, 94, 0.15)" : "rgba(251, 191, 36, 0.15)",
                    borderColor: 
                      verificationStatus === 'success' ? '#10b981' :
                      verificationStatus === 'verifying' ? '#3b82f6' :
                      verificationStatus === 'error' ? '#ef4444' :
                      canCapture ? "#22c55e" : "#f59e0b",
                    borderWidth: canCapture ? 3 : 2,
                    left: (face.bounds.x * width / 1080) - 30,
                    top: (face.bounds.y * width / 1080) + 110,
                    width: (face.bounds.width * width / 1080) + 30,
                    height: (face.bounds.height * width / 1080) + 40,
                  }
                ]}
              >
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
                <View style={[
                  styles.centerFocus,
                  { backgroundColor: canCapture ? "#22c55e" : "#f59e0b" }
                ]} />
                <View style={styles.frameStatusText}>
                  <Text style={[
                    styles.frameStatusLabel,
                    { 
                      color: 
                        verificationStatus === 'success' ? '#10b981' :
                        verificationStatus === 'verifying' ? '#3b82f6' :
                        verificationStatus === 'error' ? '#ef4444' :
                        canCapture ? "#22c55e" : "#f59e0b"
                    }
                  ]}>
                    {verificationStatus === 'success' ? "✅ MATCHED" :
                     verificationStatus === 'verifying' ? "⏳ VERIFYING" :
                     verificationStatus === 'error' ? "❌ FAILED" :
                     canCapture ? "✅ READY" : "⚠️ ADJUST"}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
      )}

      {/* Instruction Container - Similar to FaceRegistrationScreen */}
      <View style={styles.instructionContainer}>
        {verificationStatus === 'detecting' && !facesDetected.length && (
          <Text style={styles.instructionText}>🔍 Đang tìm khuôn mặt...</Text>
        )}
        {verificationStatus === 'detecting' && facesDetected.length > 0 && detectionCount < 2 && (
          <Text style={styles.instructionText}>⚠️ Điều chỉnh vị trí khuôn mặt</Text>
        )}
        {verificationStatus === 'detecting' && detectionCount >= 2 && (
          <Text style={styles.instructionText}>✅ Sẵn sàng! Đang xác minh...</Text>
        )}
        {verificationStatus === 'verifying' && (
          <Text style={[styles.instructionText, { color: '#3b82f6' }]}>⏳ Đang xác minh khuôn mặt...</Text>
        )}
        {verificationStatus === 'success' && (
          <Text style={[styles.instructionText, { color: '#10b981' }]}>✅ Nhận diện thành công!</Text>
        )}
        {verificationStatus === 'error' && (
          <Text style={[styles.instructionText, { color: '#ef4444' }]}>❌ Nhận diện thất bại. Đang thử lại...</Text>
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
  // Face detection styles
  faceBox: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: '#00ff00',
    backgroundColor: 'transparent',
  },
  cornerIndicator: {
    position: 'absolute',
    width: 20,
    height: 20,
    backgroundColor: 'transparent',
    borderWidth: 3,
  },
  topLeft: {
    top: -3,
    left: -3,
    borderRightWidth: 0,
    borderBottomWidth: 0,
    borderColor: '#00ff00',
  },
  topRight: {
    top: -3,
    right: -3,
    borderLeftWidth: 0,
    borderBottomWidth: 0,
    borderColor: '#00ff00',
  },
  bottomLeft: {
    bottom: -3,
    left: -3,
    borderRightWidth: 0,
    borderTopWidth: 0,
    borderColor: '#00ff00',
  },
  bottomRight: {
    bottom: -3,
    right: -3,
    borderLeftWidth: 0,
    borderTopWidth: 0,
    borderColor: '#00ff00',
  },
  landmarkPoint: {
    position: 'absolute',
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#ff0000',
    borderWidth: 1,
    borderColor: '#fff',
  },
  contourPoint: {
    position: 'absolute',
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#00ff00',
    borderWidth: 1,
    borderColor: '#fff',
  },
  debugPanel: {
    position: 'absolute',
    top: 100,
    right: 10,
    backgroundColor: 'rgba(0,0,0,0.8)',
    padding: 10,
    borderRadius: 8,
    minWidth: 150,
  },
  debugTitle: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  debugText: {
    color: '#fff',
    fontSize: 10,
    marginBottom: 2,
  },
  loadingText: {
    color: '#fff',
    fontSize: 16,
    marginTop: 10,
    textAlign: 'center',
  },
  errorContainer: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  errorText: {
    color: '#ef4444',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
    marginTop: 8,
  },
  errorSubText: {
    color: '#ef4444',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 8,
    opacity: 0.7,
  },
  facesText: {
    color: '#00ff00',
    fontSize: 14,
    marginTop: 4,
    textAlign: 'center',
  },
  retryBtn: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 20,
  },
  retryBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  // Styles for FaceRegistrationScreen-like UI
  faceOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 5,
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
    borderColor: 'rgba(255,255,255,0.15)',
    maxHeight: '70%',
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
});

export default SimpleFaceRecognitionCamera;
