/**
 * FaceNet Service - Extract 512-dim FaceNet embeddings using TensorFlow Lite
 * Uses react-native-fast-tflite for on-device inference
 */

import { loadTensorflowModel } from 'react-native-fast-tflite';
import RNFS from 'react-native-fs';
import { Platform, Alert, Image, NativeModules } from 'react-native';
import ImageResizer from 'react-native-image-resizer';

const { AssetCopyModule } = NativeModules;

// Debug: Log native modules
if (__DEV__) {
  console.log('🔍 Available native modules:', Object.keys(NativeModules));
  console.log('🔍 AssetCopyModule available:', !!AssetCopyModule);
}

class FaceNetService {
  constructor() {
    this.model = null;
    this.modelLoading = false;
    this.modelLoaded = false;
    this.EMBEDDING_DIMENSION = 512; // FaceNet standard embedding size
    this.INPUT_SIZE = 160; // FaceNet input size (160x160x3)
    // Model path - copy from assets to accessible location
    this.MODEL_PATH = Platform.select({
      ios: `${RNFS.MainBundlePath}/facenet_512.tflite`,
      android: `${RNFS.DocumentDirectoryPath}/facenet_512.tflite`,
    });
    // Asset path for require() - file should be in assets/ folder
    try {
      this.ASSET_MODEL_PATH = require('../../assets/facenet_512.tflite');
    } catch (e) {
      console.warn('⚠️ Could not require facenet_512.tflite from assets, will try file copy method');
      this.ASSET_MODEL_PATH = null;
    }
  }

  /**
   * Copy model from bundled assets to accessible directory
   * Tries multiple methods:
   * 1. Native module (AssetCopyModule) - best method if app rebuilt
   * 2. React Native bundled asset (require) - fallback
   * 3. Direct file path from bundle - iOS
   */
  async copyModelFromAssets() {
    try {
      // Check if model already exists in target location
      const exists = await RNFS.exists(this.MODEL_PATH);
      if (exists) {
        console.log('✅ Model file already exists in target location');
        return true;
      }

      console.log('📋 Copying model from bundled assets to DocumentsDirectory...');
      console.log('📋 Target path:', this.MODEL_PATH);
      console.log('📋 AssetCopyModule available:', !!AssetCopyModule);
      console.log('📋 ASSET_MODEL_PATH available:', !!this.ASSET_MODEL_PATH, typeof this.ASSET_MODEL_PATH);
      if (this.ASSET_MODEL_PATH) {
        console.log('📋 ASSET_MODEL_PATH value:', this.ASSET_MODEL_PATH);
      }
      
      // Ensure parent directory exists
      try {
        const parentDir = this.MODEL_PATH.substring(0, this.MODEL_PATH.lastIndexOf('/'));
        await RNFS.mkdir(parentDir);
        console.log('✅ Created parent directory:', parentDir);
      } catch (e) {
        console.log('📋 Parent directory might already exist:', e.message);
      }

      if (Platform.OS === 'android') {
        let method1Tried = false;
        let method2Tried = false;
        let method3Tried = false;
        
        // Method 1: Use native module to copy from Android assets bundle (BEST & REQUIRED)
        // RNFS.copyFile không hỗ trợ asset:/ protocol, nên BẮT BUỘC phải dùng native module
        if (AssetCopyModule && typeof AssetCopyModule.copyAssetToFiles === 'function') {
          method1Tried = true;
          try {
            console.log('📋 Method 1: Using AssetCopyModule to copy from Android assets...');
            console.log('📋 Source: android/app/src/main/assets/facenet_512.tflite');
            console.log('📋 Target:', this.MODEL_PATH);
            const result = await AssetCopyModule.copyAssetToFiles('facenet_512.tflite', this.MODEL_PATH);
            console.log('✅ Native module returned:', result);
            
            const copiedExists = await RNFS.exists(this.MODEL_PATH);
            if (copiedExists) {
              const fileInfo = await RNFS.stat(this.MODEL_PATH);
              console.log('✅ Model copied successfully via native module');
              console.log('✅ File size:', fileInfo.size, 'bytes');
              return true;
            } else {
              console.error('❌ Copy reported success but file not found at:', this.MODEL_PATH);
            }
          } catch (error) {
            console.warn('⚠️ Native module copy failed, trying fallback methods...', error.message);
          }
        } else {
          console.warn('⚠️ AssetCopyModule not available - native module chưa được load');
          console.warn('⚠️ CẦN REBUILD APP: npm run android:rebuild');
        }
        
        // Method 2: Try to copy from React Native bundled asset
        // File must be in BareNew/assets/ folder for this to work
        console.log('📋 Checking Method 2: React Native bundled asset...');
        if (this.ASSET_MODEL_PATH) {
          method2Tried = true;
          try {
            console.log('📋 Method 2: Copying from React Native bundled asset...');
            // React Native bundles assets, convert URI to file path if possible
            const assetUri = this.ASSET_MODEL_PATH;
            console.log('📋 Asset URI/Path:', assetUri);
            console.log('📋 Asset URI type:', typeof assetUri);
            
            // Try to read from the asset path directly
            try {
              // For React Native, bundled assets might be accessible via file:// URI
              let sourcePath = assetUri;
              if (typeof assetUri === 'string' && assetUri.startsWith('file://')) {
                sourcePath = assetUri.replace('file://', '');
              } else if (typeof assetUri === 'number') {
                // If it's a number (resource ID), try to use AssetCopyModule to copy it
                console.log('📋 Asset is a resource ID:', assetUri);
                if (AssetCopyModule && typeof AssetCopyModule.copyResourceToFiles === 'function') {
                  console.log('📋 Using AssetCopyModule to copy resource ID:', assetUri);
                  try {
                    const result = await AssetCopyModule.copyResourceToFiles(assetUri, this.MODEL_PATH);
                    console.log('✅ Resource copied via native module:', result);
                    
                    const exists = await RNFS.exists(this.MODEL_PATH);
                    if (exists) {
                      const fileInfo = await RNFS.stat(this.MODEL_PATH);
                      console.log('✅ Model copied from resource ID');
                      console.log('✅ File size:', fileInfo.size, 'bytes');
                      return true;
                    }
                  } catch (resourceError) {
                    console.warn('⚠️ Failed to copy resource ID:', resourceError.message);
                    throw new Error('Resource ID asset requires native module - rebuild app needed');
                  }
                } else {
                  console.warn('⚠️ Asset is a resource ID but copyResourceToFiles not available. Need rebuild.');
                  throw new Error('Resource ID asset requires native module - rebuild app needed');
                }
              }
              
              // Check if source file exists and copy
              const sourceExists = await RNFS.exists(sourcePath);
              if (sourceExists) {
                await RNFS.copyFile(sourcePath, this.MODEL_PATH);
                console.log('✅ Model copied from React Native bundled asset');
                
                const exists = await RNFS.exists(this.MODEL_PATH);
                if (exists) {
                  const fileInfo = await RNFS.stat(this.MODEL_PATH);
                  console.log('✅ File size:', fileInfo.size, 'bytes');
                  return true;
                }
              } else {
                console.warn('⚠️ Bundled asset file not found at:', sourcePath);
              }
            } catch (fileError) {
              console.warn('⚠️ Failed to copy from bundled asset file:', fileError.message);
              // Try fetch as fallback
              try {
                const response = await fetch(assetUri);
                if (response.ok) {
                  const blob = await response.blob();
                  const arrayBuffer = await blob.arrayBuffer();
                  // Convert ArrayBuffer to base64
                  const bytes = new Uint8Array(arrayBuffer);
                  let binary = '';
                  for (let i = 0; i < bytes.length; i++) {
                    binary += String.fromCharCode(bytes[i]);
                  }
                  const base64 = btoa(binary);
                  
                  await RNFS.writeFile(this.MODEL_PATH, base64, 'base64');
                  console.log('✅ Model copied from React Native bundled asset via fetch');
                  
                  const exists = await RNFS.exists(this.MODEL_PATH);
                  if (exists) {
                    const fileInfo = await RNFS.stat(this.MODEL_PATH);
                    console.log('✅ File size:', fileInfo.size, 'bytes');
                    return true;
                  }
                }
              } catch (fetchError) {
                console.warn('⚠️ Failed to fetch bundled asset:', fetchError.message);
              }
            }
          } catch (error) {
            console.warn('⚠️ Method 2 failed:', error.message);
          }
        } else {
          console.warn('⚠️ Method 2 skipped: ASSET_MODEL_PATH is not available');
          console.warn('⚠️ This means require() failed - file .tflite might not be bundled correctly');
        }

        // Method 3: Try MainBundlePath (sometimes works on Android)
        method3Tried = true;
        try {
          console.log('📋 Method 3: Checking MainBundlePath...');
          const bundlePath = Platform.OS === 'android' 
            ? `${RNFS.MainBundlePath}/facenet_512.tflite`
            : `${RNFS.MainBundlePath}/facenet_512.tflite`;
          const bundleExists = await RNFS.exists(bundlePath);
          if (bundleExists) {
            await RNFS.copyFile(bundlePath, this.MODEL_PATH);
            console.log('✅ Model copied from MainBundlePath');
            return true;
          }
        } catch (e) {
          // Ignore
        }

        // Method 4: Try raw resource path (Android specific)
        try {
          console.log('📋 Method 4: Checking Android raw resources...');
          // Android might have the file in res/raw
          const rawPath = `android.resource://com.mobileappbarenew/raw/facenet_512`;
          // This requires the file to be in res/raw/ which is different from assets/
          // Skipping for now as it requires different setup
        } catch (e) {
          console.warn('⚠️ Method 3 failed:', e.message);
        }

        // Log summary
        console.error('❌ All copy methods failed!');
        console.error('❌ Methods tried:');
        console.error('   - Method 1 (Native Module):', method1Tried ? '✅ Tried' : '❌ Skipped (module not available)');
        console.error('   - Method 2 (React Native Bundle):', method2Tried ? '✅ Tried' : '❌ Skipped (ASSET_MODEL_PATH unavailable)');
        console.error('   - Method 3 (MainBundlePath):', method3Tried ? '✅ Tried' : '❌ Skipped');
        
        console.error('❌ Required file locations:');
        console.error('   1. android/app/src/main/assets/facenet_512.tflite (for native module - NEED REBUILD)');
        console.error('   2. BareNew/assets/facenet_512.tflite (for React Native bundle)');
        
        console.error('❌ SOLUTION: Run "npm run android:rebuild" to rebuild app with native module');
        console.error('   This will make AssetCopyModule available and Method 1 will work');
        
        return false;
      }

      // iOS: Check if file exists in bundle
      if (Platform.OS === 'ios') {
        const bundlePath = `${RNFS.MainBundlePath}/facenet_512.tflite`;
        const exists = await RNFS.exists(bundlePath);
        if (exists) {
          console.log('✅ Model found in iOS bundle');
          return true;
        }
      }

      return false;
    } catch (error) {
      console.error('❌ Error copying model from assets:', error);
      return false;
    }
  }

  /**
   * Check if model file exists (after copying from assets if needed)
   */
  async checkModelExists() {
    try {
      // First try to copy from assets if on Android
      if (Platform.OS === 'android') {
        const copied = await this.copyModelFromAssets();
        if (!copied) {
          return false;
        }
      }
      
      const exists = await RNFS.exists(this.MODEL_PATH);
      return exists;
    } catch (error) {
      console.error('❌ Error checking model existence:', error);
      return false;
    }
  }

  /**
   * Load FaceNet .tflite model
   * @returns {boolean} True if model loaded successfully
   */
  async loadModel() {
    if (this.modelLoaded && this.model) {
      console.log('✅ FaceNet model already loaded');
      return true;
    }

    if (this.modelLoading) {
      console.log('⏳ FaceNet model is already loading...');
      // Wait for loading to complete
      while (this.modelLoading) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      return this.modelLoaded;
    }

    this.modelLoading = true;

    try {
      console.log('🔄 Loading FaceNet model...');

      // Try to copy model from assets if needed
      if (Platform.OS === 'android') {
        console.log('🔄 Attempting to copy model from assets...');
        const copied = await this.copyModelFromAssets();
        console.log('📋 Copy result:', copied);
      }

      // Check if model file exists
      console.log('🔍 Checking if model exists at:', this.MODEL_PATH);
      const modelExists = await RNFS.exists(this.MODEL_PATH);
      console.log('🔍 Model exists:', modelExists);
      
      if (!modelExists) {
        console.error('❌ FaceNet model file not found at:', this.MODEL_PATH);
        console.error('❌ AssetCopyModule available:', !!AssetCopyModule);
        console.error('❌ Please ensure:');
        console.error('   1. File facenet_512.tflite is in android/app/src/main/assets/');
        console.error('   2. App has been rebuilt after adding AssetCopyModule');
        console.error('   3. Run: cd android && gradlew clean && cd .. && npm run android');
        this.modelLoading = false;
        return false;
      }

      // Load model using react-native-fast-tflite
      // Use file path (model should be in DocumentsDirectory)
      const modelSource = this.MODEL_PATH;
      console.log(`📂 Loading model from: ${modelSource}`);

      // Check if loadTensorflowModel is available
      if (!loadTensorflowModel || typeof loadTensorflowModel !== 'function') {
        throw new Error('loadTensorflowModel is not available. react-native-fast-tflite may not be properly linked. Please rebuild the app.');
      }

      console.log('📦 Loading TensorflowModel using loadTensorflowModel()...');
      
      // Load model using loadTensorflowModel function (not constructor)
      // For Android, use 'android-gpu' or 'nnapi' delegate, fallback to 'default' (CPU)
      const delegate = Platform.OS === 'android' ? 'nnapi' : 'default';
      console.log(`📦 Using delegate: ${delegate}`);
      
      this.model = await loadTensorflowModel(
        { url: `file://${modelSource}` },
        delegate
      );
      
      console.log('✅ Model loaded successfully');
      
      this.modelLoaded = true;
      console.log('✅ FaceNet model loaded successfully');
      return true;
    } catch (error) {
      console.error('❌ Error loading FaceNet model:', error);
      console.error('❌ Error stack:', error.stack);
      
      // Log more details for debugging
      console.error('❌ loadTensorflowModel import check:');
      console.error('   - loadTensorflowModel type:', typeof loadTensorflowModel);
      console.error('   - loadTensorflowModel value:', loadTensorflowModel);
      console.error('   - Platform:', Platform.OS);
      console.error('   - Model path:', this.MODEL_PATH);
      
      // Check if it's a linking issue
      if (error.message.includes('undefined') || !loadTensorflowModel) {
        console.error('⚠️ Possible solutions:');
        console.error('   1. Rebuild app: npm run android:rebuild');
        console.error('   2. Check if react-native-fast-tflite is properly installed');
        console.error('   3. Ensure TensorflowModule.install() was called (check console for "Installing bindings...")');
        console.error('   4. Try disabling New Architecture in gradle.properties (newArchEnabled=false) if issue persists');
      }
      
      this.model = null;
      this.modelLoaded = false;
      return false;
    } finally {
      this.modelLoading = false;
    }
  }

  /**
   * Preprocess face image for FaceNet input
   * Local-only implementation: Crops face, resizes to 160x160, decodes to RGB pixels
   * @param {string} imagePath - File path to image
   * @param {Object} faceBounds - Face bounds {x, y, width, height} in image coordinates
   * @param {number} originalWidth - Original image width
   * @param {number} originalHeight - Original image height
   * @returns {Float32Array} Preprocessed image array [160, 160, 3] normalized [0, 1]
   */
  async preprocessFaceImage(imagePath, faceBounds, originalWidth, originalHeight) {
    try {
      console.log('🔄 Preprocessing face image for FaceNet...');
      console.log(`📐 Face bounds:`, faceBounds);
      console.log(`📏 Original size: ${originalWidth}x${originalHeight}`);
      
      let processedImagePath = imagePath;
      
      // Step 1: Crop face region if bounds provided
      if (faceBounds && faceBounds.x !== undefined && faceBounds.y !== undefined && 
          faceBounds.width > 0 && faceBounds.height > 0) {
        try {
          console.log('✂️ Cropping face region...');
          
          // Calculate crop area with some margin for better results
          const margin = 0.2; // 20% margin around face
          const x = Math.floor(Math.max(0, faceBounds.x - faceBounds.width * margin));
          const y = Math.floor(Math.max(0, faceBounds.y - faceBounds.height * margin));
          const width = Math.floor(Math.min(originalWidth - x, faceBounds.width * (1 + 2 * margin)));
          const height = Math.floor(Math.min(originalHeight - y, faceBounds.height * (1 + 2 * margin)));
          
          // Ensure valid dimensions
          if (width <= 0 || height <= 0 || x < 0 || y < 0 || x >= originalWidth || y >= originalHeight) {
            throw new Error(`Invalid crop dimensions: x=${x}, y=${y}, width=${width}, height=${height}`);
          }
          
          console.log(`✂️ Crop params: x=${x}, y=${y}, width=${width}, height=${height}`);
          
          // Crop image using ImageResizer
          // Note: ImageResizer may not support originX/originY in all versions, so we use resize then crop
          const croppedImage = await ImageResizer.createResizedImage(
            imagePath,
            width,
            height,
            'JPEG',
            100, // Quality
            0, // Rotation
            undefined, // originX - not supported in some versions
            undefined, // originY - not supported in some versions
            {
              mode: 'contain', // Use contain to maintain aspect ratio
              onlyScaleDown: false
            }
          );
          
          processedImagePath = croppedImage.uri.replace('file://', '');
          console.log(`✅ Face cropped: ${processedImagePath}`);
        } catch (cropError) {
          console.warn('⚠️ Failed to crop face, using full image:', cropError.message);
          // Continue with full image if crop fails
        }
      }
      
      // Step 2: Resize to 160x160 (FaceNet input size)
      let resizedImagePath = processedImagePath;
      try {
        console.log('📐 Resizing to 160x160...');
        const resizedImage = await ImageResizer.createResizedImage(
          processedImagePath,
          this.INPUT_SIZE, // 160
          this.INPUT_SIZE, // 160
          'JPEG',
          100,
          0,
          undefined,
          undefined,
          {
            mode: 'contain', // Keep aspect ratio
            onlyScaleDown: false
          }
        );
        
        resizedImagePath = resizedImage.uri.replace('file://', '');
        console.log(`✅ Image resized: ${resizedImagePath}`);
      } catch (resizeError) {
        console.error('❌ Failed to resize image:', resizeError);
        throw new Error('Failed to resize image for FaceNet');
      }
      
      // Step 3: Decode image to RGB pixels using native module
      console.log('🖼️ Decoding image to pixel data...');
      
      if (!AssetCopyModule || typeof AssetCopyModule.decodeImageToPixels !== 'function') {
        throw new Error('AssetCopyModule.decodeImageToPixels not available. Please rebuild app after adding native module.');
      }
      
      const pixelArray = await AssetCopyModule.decodeImageToPixels(resizedImagePath);
      
      // Convert React Native array to Float32Array
      const size = this.INPUT_SIZE * this.INPUT_SIZE * 3;
      const floatArray = new Float32Array(size);
      
      for (let i = 0; i < pixelArray.length && i < size; i++) {
        floatArray[i] = pixelArray[i];
      }
      
      console.log(`✅ Image decoded: ${floatArray.length} pixels (${this.INPUT_SIZE}x${this.INPUT_SIZE}x3)`);
      console.log(`📊 Pixel value range: [${Math.min(...Array.from(floatArray)).toFixed(3)}, ${Math.max(...Array.from(floatArray)).toFixed(3)}]`);
      
      // Clean up temp files if created
      if (resizedImagePath !== imagePath && resizedImagePath !== processedImagePath) {
        try {
          await RNFS.unlink(resizedImagePath);
        } catch (e) {
          // Ignore cleanup errors
        }
      }
      
      // Also clean up cropped image if it was created
      if (processedImagePath !== imagePath && processedImagePath !== resizedImagePath) {
        try {
          await RNFS.unlink(processedImagePath);
        } catch (e) {
          // Ignore cleanup errors
        }
      }
      
      return floatArray;
    } catch (error) {
      console.error('❌ Error preprocessing face image:', error);
      throw error;
    }
  }

  /**
   * Extract 512-dim FaceNet embedding from face image
   * LOCAL MODEL ONLY - NO server fallback
   * @param {string} imagePath - File path to image
   * @param {Object} faceBounds - Optional: Face bounds {x, y, width, height} if image needs cropping
   * @returns {Promise<Float32Array>} 512-dim FaceNet embedding (L2 normalized)
   */
  async extractEmbedding(imagePath, faceBounds = null) {
    // Ensure model is loaded
    const loaded = await this.loadModel();
    if (!loaded || !this.model) {
      throw new Error('FaceNet local model not loaded. Please ensure facenet_512.tflite is available in assets.');
    }

    if (!imagePath) {
      throw new Error('Image path is required');
    }

    // Get image dimensions (default to camera resolution if not provided)
    const originalWidth = 1080; // Default camera width
    const originalHeight = 1080; // Default camera height

    // Preprocess image: crop face, resize to 160x160, normalize
    let inputArray;
    if (faceBounds) {
      // Crop and preprocess face region
      inputArray = await this.preprocessFaceImage(imagePath, faceBounds, originalWidth, originalHeight);
    } else {
      // Use full image (not ideal but works as fallback)
      console.warn('⚠️ No face bounds provided, using full image (may reduce accuracy)');
      inputArray = await this.preprocessFaceImage(imagePath, null, originalWidth, originalHeight);
    }

    // Ensure input is correct size: [160, 160, 3] = 76800 elements
    const expectedSize = this.INPUT_SIZE * this.INPUT_SIZE * 3;
    if (inputArray.length !== expectedSize) {
      throw new Error(`Invalid input size: expected ${expectedSize}, got ${inputArray.length}. Preprocessing failed.`);
    }

    console.log('🔄 Running FaceNet inference locally...');
    
    // Run inference
    // react-native-fast-tflite expects array of TypedArrays: [inputArray]
    // The output will also be an array of TypedArrays
    const outputs = await this.model.run([inputArray]);
    
    // Extract embedding from output (first output tensor)
    let embedding;
    if (Array.isArray(outputs) && outputs.length > 0) {
      const firstOutput = outputs[0];
      if (firstOutput instanceof Float32Array) {
        embedding = firstOutput;
      } else if (Array.isArray(firstOutput)) {
        embedding = new Float32Array(firstOutput);
      } else if (firstOutput?.data) {
        embedding = new Float32Array(firstOutput.data);
      } else {
        throw new Error(`Unexpected output format: ${typeof firstOutput}`);
      }
    } else {
      throw new Error(`Unexpected output format from model: expected array, got ${typeof outputs}`);
    }

    console.log(`📊 Raw embedding dimension: ${embedding.length}`);

    // Validate embedding dimension
    if (embedding.length !== this.EMBEDDING_DIMENSION) {
      console.warn(`⚠️ Embedding dimension mismatch: expected ${this.EMBEDDING_DIMENSION}, got ${embedding.length}`);
      // Truncate or pad if needed
      if (embedding.length > this.EMBEDDING_DIMENSION) {
        embedding = embedding.slice(0, this.EMBEDDING_DIMENSION);
      } else {
        const padded = new Float32Array(this.EMBEDDING_DIMENSION);
        padded.set(embedding);
        embedding = padded;
      }
    }

    // L2 normalize embedding (FaceNet requirement)
    const normalized = this.normalizeEmbedding(embedding);

    console.log(`✅ FaceNet embedding extracted locally: ${normalized.length} dimensions`);
    return normalized;
  }


  /**
   * L2 normalize an embedding vector
   * @param {Float32Array} embedding 
   * @returns {Float32Array}
   */
  normalizeEmbedding(embedding) {
    const norm = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    if (norm === 0 || !isFinite(norm)) {
      console.warn('⚠️ Embedding norm is 0 or invalid, returning original');
      return embedding;
    }
    return embedding.map(val => val / norm);
  }

  /**
   * Calculate cosine similarity between two embeddings
   * @param {Float32Array} embedding1 
   * @param {Float32Array} embedding2 
   * @returns {number} Similarity score [0, 1]
   */
  calculateSimilarity(embedding1, embedding2) {
    if (!embedding1 || !embedding2) return 0;
    if (embedding1.length !== embedding2.length) {
      console.warn(`⚠️ Embedding dimension mismatch: ${embedding1.length} vs ${embedding2.length}`);
      return 0;
    }

    let dotProduct = 0;
    for (let i = 0; i < embedding1.length; i++) {
      dotProduct += embedding1[i] * embedding2[i];
    }

    // Embeddings should already be L2 normalized, so cosine similarity = dot product
    return Math.max(0, Math.min(1, dotProduct));
  }

  /**
   * Check if service is ready to use
   */
  isReady() {
    return this.modelLoaded && this.model !== null;
  }

  /**
   * Get model status information
   */
  getStatus() {
    return {
      loaded: this.modelLoaded,
      loading: this.modelLoading,
      embeddingDimension: this.EMBEDDING_DIMENSION,
      inputSize: this.INPUT_SIZE,
      modelPath: this.MODEL_PATH,
    };
  }
}

// Export singleton instance
export default new FaceNetService();

