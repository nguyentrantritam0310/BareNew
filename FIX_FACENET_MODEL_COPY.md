# Hướng dẫn khắc phục lỗi FaceNet Model Copy

## Vấn đề
Lỗi `AssetCopyModule not available` khi đăng ký khuôn mặt. Module native chưa được nạp vì app chưa rebuild sau khi thêm native module.

## Giải pháp

### Cách 1: Rebuild hoàn toàn (Khuyên dùng)

1. **Dừng Metro bundler** (Ctrl+C trong terminal đang chạy Metro)

2. **Chạy lệnh rebuild:**
   ```bash
   npm run android:rebuild
   ```

   Hoặc thủ công:
   ```bash
   cd android
   gradlew clean
   cd ..
   npm run android
   ```

3. **Đợi build hoàn tất** và app sẽ tự động cài đặt và chạy

### Cách 2: Clean build thủ công

```bash
# Windows
cd android
gradlew.bat clean
gradlew.bat assembleDebug
cd ..
npm run android

# Mac/Linux
cd android
./gradlew clean
./gradlew assembleDebug
cd ..
npm run android
```

### Kiểm tra sau khi rebuild

Sau khi app chạy lại, trong console sẽ thấy:
- ✅ `AssetCopyModule available: true`
- ✅ `Model copied successfully to: [path]`
- ✅ `FaceNet model loaded successfully`

## Nguyên nhân

React Native native modules cần được compile vào app. Khi bạn thêm native module mới:
- Module Kotlin (`AssetCopyModule.kt`) cần được compile
- Package (`AssetCopyPackage.kt`) cần được đăng ký
- App cần rebuild để link native code

Hot reload/Metro bundler chỉ reload JavaScript code, không reload native code.

## Cấu trúc Native Module

Module đã được cấu hình đúng:
- ✅ `AssetCopyModule.kt` - Module chính
- ✅ `AssetCopyPackage.kt` - Package wrapper  
- ✅ `MainApplication.kt` - Đã đăng ký package
- ✅ Model file: `android/app/src/main/assets/facenet_512.tflite`

## Lưu ý

- **Luôn rebuild** khi thêm/sửa native modules
- File model phải ở `android/app/src/main/assets/facenet_512.tflite`
- Sau khi copy thành công, file sẽ ở DocumentsDirectory và không cần copy lại

## Troubleshooting

Nếu vẫn gặp lỗi sau khi rebuild:

1. **Xóa cache:**
   ```bash
   npm run android:clean
   rm -rf android/app/build
   rm -rf android/.gradle
   ```

2. **Kiểm tra file model tồn tại:**
   ```bash
   ls android/app/src/main/assets/facenet_512.tflite
   ```

3. **Xác nhận Kotlin được cấu hình:**
   - File `android/build.gradle` có `kotlinVersion`
   - File `android/app/build.gradle` có `apply plugin: "org.jetbrains.kotlin.android"`

4. **Xem log Android:**
   ```bash
   adb logcat | grep -i assetcopy
   ```

