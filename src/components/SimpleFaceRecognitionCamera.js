import React, { useRef, useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, Dimensions, ScrollView } from 'react-native';
import { Camera, useCameraDevices } from 'react-native-vision-camera';
import FaceDetection from '@react-native-ml-kit/face-detection';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import api from '../api';
import { AppState } from 'react-native';
import faceNetService from '../services/faceNetService';

const { width, height } = Dimensions.get('window');

// Face detection constants - Very lenient for easy recognition
const MIN_FACE_SIZE = 0.001; // Minimum face size relative to frame (extremely lenient)
const MAX_HEAD_ANGLE = 90; // Maximum head rotation angle in degrees (very permissive)

const SimpleFaceRecognitionCamera = ({ onFaceRecognized, onClose, user }) => {
  const [facing, setFacing] = useState('front');
  const [permission, setPermission] = useState(null);
  const [isDetecting, setIsDetecting] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState('idle');
  const [hasVerified, setHasVerified] = useState(false);
  const [timingMetrics, setTimingMetrics] = useState({
    embeddingExtractionTime: 0,
    databaseComparisonTime: 0,
    totalRecognitionTime: 0,
    recognitionTime: 0,
  });
  
  const cameraRef = useRef(null);
  const devices = useCameraDevices();
  
  const device = devices.find(d => d.position === facing);

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

  useEffect(() => {
    checkCameraPermission();
    // Lắng nghe khi app quay lại foreground để re-check quyền
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        checkCameraPermission();
      }
    });
    return () => {
      sub?.remove?.();
    };
  }, []);

  useEffect(() => {
    if (permission === 'granted' && device && cameraReady && !isDetecting && !hasVerified) {
      const timer = setTimeout(() => {
        startFaceDetection();
      }, 700);
      return () => clearTimeout(timer);
    }
  }, [permission, device, cameraReady, hasVerified, isDetecting]);

  const checkCameraPermission = async () => {
    try {
      const current = (await Camera.getCameraPermissionStatus?.()) || null;
      const normalize = (val) => (val === 'authorized' ? 'granted' : val);

      if (current && (current === 'authorized' || current === 'granted')) {
        setPermission('granted');
        return;
      }

      const requested = await Camera.requestCameraPermission();
      setPermission(normalize(requested));
    } catch (error) {
      setPermission('denied');
    }
  };

  const startFaceDetection = () => {
    if (detectionIntervalRef.current) {
      return;
    }
    setIsDetecting(true);
    setVerificationStatus('detecting');
    setHasVerified(false);
    startMLKitDetection();
  };

  const stopFaceDetection = () => {
    hasVerifiedRef.current = true;
    setIsDetecting(false);
    if (detectionIntervalRef.current) {
      clearInterval(detectionIntervalRef.current);
      detectionIntervalRef.current = null;
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
    
    if (!bounds || typeof bounds.x !== 'number' || typeof bounds.y !== 'number' || 
        typeof bounds.width !== 'number' || typeof bounds.height !== 'number') {
      return false;
    }
    
    const faceArea = bounds.width * bounds.height;
    const screenArea = width * width;
    const normalizedFaceSize = faceArea / screenArea;
    
    if (normalizedFaceSize < MIN_FACE_SIZE) {
      return false;
    }
    
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
    detectionIntervalRef.current = setInterval(async () => {
      if (!isDetectingRef.current) {
        return;
      }
      if (!cameraRef.current) {
        return;
      }
      if (!cameraReadyRef.current) {
        return;
      }
      if (hasVerifiedRef.current || hasVerified || verificationStatus === 'success') {
        stopFaceDetection();
        return;
      }
      
      if (verificationStatus === 'verifying') {
        return;
      }
      
      try {
        const photo = await cameraRef.current.takePhoto({
          qualityPrioritization: 'speed',
          flash: 'off',
          skipMetadata: true,
        });
        let faces = [];
        try {
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
            faces = await FaceDetection.detect(`file://${photo.path}`);
          }

          faces = faces.map(normalizeFaceData).filter(f => f !== null);
        } catch (mlKitError) {
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
          setCurrentFaceData(faceData);
          // FaceNet embedding sẽ được extract trong processFaceRecognition khi verify
          // Verify immediately when face is detected - only check if face has valid bounds
          // IMPORTANT: Check both state and ref to prevent race condition
          if (faces && faces.length > 0 && faceData && faceData.bounds && 
              !hasVerified && !hasVerifiedRef.current && verificationStatus !== 'verifying') {
            // Only basic check: face bounds must exist and be valid
            const { width: bw, height: bh } = faceData.bounds || {};
            if (bw > 0 && bh > 0) {
              if (!hasVerifiedRef.current && !hasVerified && verificationStatus !== 'verifying') {
                setVerificationStatus('verifying');
                processFaceRecognition(faceData, photo.path);
              }
            }
          } else {
            if (verificationStatus !== 'verifying') {
              setVerificationStatus('detecting');
            }
          }
        } else {
          setCurrentFaceData(null);
          if (verificationStatus !== 'verifying') {
            setVerificationStatus('detecting');
          }
        }
      } catch (error) {
        // Handle error silently
      }
    }, 1000);
  };

  // Extract FaceNet embedding from face image using local model
  const extractFaceNetEmbedding = async (photoPath, faceBounds) => {
    try {
      // Ensure model is loaded
      const loaded = await faceNetService.loadModel();
      if (!loaded || !faceNetService.isReady()) {
        throw new Error('FaceNet model not loaded. Please ensure facenet_512.tflite is available in assets.');
      }

      const embeddingStart = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
      const embedding = await faceNetService.extractEmbedding(photoPath, faceBounds);
      const embeddingEnd = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
      const embeddingTime = embeddingEnd - embeddingStart;
      
      if (!embedding) {
        throw new Error('FaceNet service returned null embedding');
      }
      
      if (embedding.length !== 512) {
        throw new Error(`Invalid embedding dimension: expected 512, got ${embedding.length}`);
      }
      
      setTimingMetrics(prev => ({ ...prev, embeddingExtractionTime: embeddingTime }));
      return embedding;
    } catch (error) {
      throw error;
    }
  }

  const processFaceRecognition = async (faceDataParam = null, photoPath = null) => {
    if (hasVerifiedRef.current || hasVerified) {
      return;
    }
    
    if (isVerifyingRef.current) {
      return;
    }
    
    // Set verifying flag immediately (before async operations)
    isVerifyingRef.current = true;
    setVerificationStatus('verifying');
    setIsProcessing(true);
  // Start recognition timer (includes detection -> embedding -> verify)
  const recognitionStart = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
    
    try {
      const faceDataToUse = faceDataParam || currentFaceData;
      const lmCount = Array.isArray(faceDataToUse?.landmarks) ? faceDataToUse.landmarks.length : 0;
      const quality = calculateFaceQuality(faceDataToUse);
      
      if (!faceDataToUse?.bounds) {
        throw new Error('Face bounds are missing');
      }
      
      if (!photoPath) {
        throw new Error('FaceNet requires photo path. Photo path is missing.');
      }
      
      const modelStatus = faceNetService.getStatus();
      
      if (!modelStatus.loaded) {
        const loaded = await faceNetService.loadModel();
        if (!loaded || !faceNetService.isReady()) {
          throw new Error('FaceNet model failed to load. Please restart the app and try again.');
        }
      }
      
      const embStartProcess = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
      const embedding = await extractFaceNetEmbedding(photoPath, faceDataToUse.bounds);
      const embEndProcess = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
      const embeddingTimeLocal = embEndProcess - embStartProcess;
      
      if (!embedding || embedding.length !== 512) {
        throw new Error(`FaceNet embedding extraction failed: got ${embedding?.length || 0} dimensions, expected 512`);
      }
      
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
      
      if (embeddingArray.length !== 512) {
        throw new Error(`Invalid embedding dimension: ${embeddingArray.length} (expected 512)`);
      }
      
      if (!user?.id) {
        throw new Error('User ID is missing. Please login again.');
      }
      
      const verifyRequest = {
        employeeId: user.id,
        embedding: embeddingArray,
      };
      
      if (typeof api === 'undefined' || !api || !api.post) {
        throw new Error('API service is not available. Please restart the app.');
      }
      
      try {
        const dbStart = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
        const response = await api.post('/FaceRegistration/verify-embedding', verifyRequest);
        const dbEnd = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
        const dbTime = dbEnd - dbStart;
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
          
          if (response.data.isMatch) {
            const recognitionEnd = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
            const recognitionTime = recognitionEnd - recognitionStart;
            setTimingMetrics(prev => {
              const embTime = embeddingTimeLocal || prev.embeddingExtractionTime || 0;
              const total = embTime + dbTime;
              return { ...prev, embeddingExtractionTime: embTime, databaseComparisonTime: dbTime, totalRecognitionTime: total, recognitionTime };
            });

            hasVerifiedRef.current = true;
            isVerifyingRef.current = false;
            setHasVerified(true);
            setVerificationStatus('success');
            stopFaceDetection();

            try {
              if (typeof api === 'undefined' || !api || !api.post) {
                throw new Error('API service is not available');
              }
              const verificationToken = `${user?.id}_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
              const now = new Date();
              const year = now.getFullYear();
              const month = String(now.getMonth() + 1).padStart(2, '0');
              const day = String(now.getDate()).padStart(2, '0');
              const hours = String(now.getHours()).padStart(2, '0');
              const minutes = String(now.getMinutes()).padStart(2, '0');
              const seconds = String(now.getSeconds()).padStart(2, '0');
              const localDateTime = `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
              
              const attendanceBody = {
                EmployeeId: user?.id,
                CheckInDateTime: localDateTime,
                Latitude: 0,
                Longitude: 0,
                Location: 'Mobile App - Face Recognition',
                AttendanceMachineId: 2,
                Notes: 'Check-in bằng nhận diện khuôn mặt (FaceNet)',
                MatchedFaceId: recognitionResult.matchedFaceId || '',
                MatchConfidence: recognitionResult.confidence || 0,
                VerificationTimestamp: localDateTime,
                VerificationToken: verificationToken,
              };
              
              const attendanceRes = await api.post('/Attendance/checkin-noimage', attendanceBody);
              
              if (attendanceRes.data && attendanceRes.data.success) {
                recognitionResult.attendance = attendanceRes.data;
              }
            } catch (attErr) {
              // Don't fail verification if check-in fails
            }
            
            setTimeout(() => {
              stopFaceDetection();
              if (onFaceRecognized) {
                onFaceRecognized({ imageBase64: null, recognitionResult });
              }
              if (onClose) {
                onClose();
              }
            }, 2000);
          } else {
            setVerificationStatus('error');
            setHasVerified(false);
            setTimeout(() => {
              if (!hasVerified) {
                setVerificationStatus('detecting');
              }
            }, 3000);
          }
        } else {
          throw new Error(response.data?.message || 'Verify API trả về lỗi');
        }
      } catch (apiError) {
        setVerificationStatus('error');
        setHasVerified(false);
        setTimeout(() => {
          if (!hasVerified) {
            setVerificationStatus('detecting');
          }
        }, 3000);
      }
    } catch (error) {
      setVerificationStatus('error');
      setHasVerified(false);
      setTimeout(() => {
        if (!hasVerified) {
          setVerificationStatus('detecting');
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

  const toggleCameraType = () => {
    setFacing(current => current === 'back' ? 'front' : 'back');
  };

  const handleClose = () => {
    stopFaceDetection();
    setVerificationStatus('idle');
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
          setCameraReady(true);
        }}
        onError={(e) => {
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

      {/* Frame quanh mặt - đơn giản */}
      {currentFaceData && (
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
      )}

      {/* Hiển thị kết quả nhận diện */}
      {(verificationStatus === 'success' || verificationStatus === 'error') && (
        <View style={{
          position: 'absolute',
          left: 20,
          right: 20,
          bottom: 120,
          backgroundColor: 'rgba(0,0,0,0.8)',
          borderRadius: 12,
          paddingVertical: 12,
          paddingHorizontal: 16,
          alignItems: 'center',
          zIndex: 10,
        }}>
          <Text style={{
            color: verificationStatus === 'success' ? '#10b981' : '#ef4444',
            fontSize: 16,
            fontWeight: 'bold',
            textAlign: 'center',
          }}>
            {verificationStatus === 'success' ? 'Nhận diện thành công!' : 'Nhận diện thất bại.'}
          </Text>
        </View>
      )}

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
