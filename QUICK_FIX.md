# 🚀 Quick Fix: FaceNet Model Copy Error

## Vấn đề
```
❌ AssetCopyModule available: false
❌ FaceNet model file not found
```

## Giải pháp NHANH NHẤT

### Windows:
```bash
# Chạy script tự động
rebuild-android.bat
```

### Hoặc thủ công:
```bash
cd android
gradlew clean
cd ..
npm run android
```

## Tại sao cần rebuild?

1. **AssetCopyModule** là native module (Kotlin code)
2. Native modules **KHÔNG THỂ** hot reload
3. App phải được **compile lại** để native module hoạt động
4. Metro bundler chỉ reload JavaScript, không reload native code

## Sau khi rebuild

App sẽ tự động:
- ✅ Load AssetCopyModule
- ✅ Copy file từ `android/app/src/main/assets/` 
- ✅ Lưu vào `/data/user/0/com.mobileappbarenew/files/`
- ✅ Load FaceNet model thành công

## Kiểm tra

Sau rebuild, trong console sẽ thấy:
```
✅ AssetCopyModule available: true
✅ Method 1: Using AssetCopyModule...
✅ Model copied successfully via native module
✅ FaceNet model loaded successfully
```

## Lưu ý

- **KHÔNG CẦN** restart Metro bundler
- **KHÔNG CẦN** reload app
- Chỉ cần rebuild và app sẽ tự install lại

## Nếu vẫn lỗi sau rebuild

1. Kiểm tra file tồn tại:
   ```bash
   dir android\app\src\main\assets\facenet_512.tflite
   ```

2. Xem log chi tiết trong console để biết method nào được thử

3. Xóa cache:
   ```bash
   cd android
   gradlew clean
   rd /s /q app\build
   cd ..
   npm run android
   ```

