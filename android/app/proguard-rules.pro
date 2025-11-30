# Add project specific ProGuard rules here.
# By default, the flags in this file are appended to flags specified
# in /usr/local/Cellar/android-sdk/24.3.3/tools/proguard/proguard-android.txt
# You can edit the include path and order by changing the proguardFiles
# directive in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# Keep React Native classes
-keep class com.facebook.react.** { *; }
-keep class com.facebook.hermes.** { *; }
-keep class com.facebook.jni.** { *; }

# Keep native modules
-keep class com.reactnativecommunity.** { *; }
-keep class com.reactnativefasttflite.** { *; }
-keep class com.mrousavy.** { *; }

# Keep application classes
-keep class com.mobileappbarenew.** { *; }

# Keep ML Kit classes
-keep class com.google.mlkit.** { *; }
-keep class com.google.android.gms.** { *; }

# Keep vector icons
-keep class com.oblador.vectoricons.** { *; }

# Keep worklets
-keep class com.swmansion.reanimated.** { *; }
-keep class com.swmansion.worklets.** { *; }

# Keep camera classes
-keep class com.mrousavy.camera.** { *; }

# Keep AsyncStorage
-keep class com.reactnativecommunity.asyncstorage.** { *; }

# Keep FS
-keep class com.rnfs.** { *; }

# Keep image resizer
-keep class fr.bamlab.rnimageresizer.** { *; }

# Keep TensorFlow Lite classes (required by react-native-fast-tflite)
-keep class org.tensorflow.lite.** { *; }
-keep class org.tensorflow.** { *; }
-dontwarn org.tensorflow.lite.gpu.GpuDelegateFactory$Options$GpuBackend
-dontwarn org.tensorflow.lite.gpu.GpuDelegateFactory$Options
-dontwarn org.tensorflow.lite.gpu.**
