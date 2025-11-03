# Vị trí cần đặt file facenet_512.tflite

File model `facenet_512.tflite` cần được đặt ở **ÍT NHẤT MỘT** trong các vị trí sau:

## Vị trí bắt buộc (chọn 1 trong 2):

### 1. Android Assets (Khuyên dùng - cần rebuild app)
📁 **Vị trí:** `BareNew/android/app/src/main/assets/facenet_512.tflite`

**Ưu điểm:**
- Được bundle vào APK
- Có thể copy bằng native module (nhanh, đáng tin cậy)
- Không tốn dung lượng storage của user

**Yêu cầu:**
- App phải được **rebuild** sau khi thêm file
- Chạy: `npm run android:rebuild`

### 2. React Native Assets Folder (Không cần rebuild)
📁 **Vị trí:** `BareNew/assets/facenet_512.tflite`

**Ưu điểm:**
- Không cần rebuild app
- Tự động được bundle bởi Metro bundler
- Hoạt động ngay sau khi thêm file

**Yêu cầu:**
- File phải ở đúng thư mục `BareNew/assets/`
- Cấu hình trong `react-native.config.js` đã đúng

## Kiểm tra file đã có:

Dựa trên cấu trúc hiện tại, file model đã có ở:
- ✅ `BareNew/assets/facenet_512.tflite` - React Native assets
- ✅ `BareNew/android/app/src/main/assets/facenet_512.tflite` - Android assets
- ⚠️ `BareNew/android/app/src/main/facenet_512.tflite` - **KHÔNG ĐÚNG**, cần xóa hoặc di chuyển
- ⚠️ `BareNew/android/app/src/main/assets/custom/facenet_512.tflite` - **KHÔNG ĐÚNG**, cần di chuyển ra ngoài

## Cách sửa nhanh:

### Bước 1: Đảm bảo file ở đúng vị trí

**Option A: Sử dụng Android Assets (Tốt nhất)**
```bash
# Di chuyển file vào đúng vị trí Android assets
# File đã có sẵn ở: android/app/src/main/assets/facenet_512.tflite
# Chỉ cần đảm bảo file tồn tại ở đó
```

**Option B: Sử dụng React Native Assets**
```bash
# Đảm bảo file có ở: BareNew/assets/facenet_512.tflite
# File đã có sẵn, không cần làm gì thêm
```

### Bước 2: Rebuild app (Nếu dùng Android Assets)

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

## Lưu ý quan trọng:

1. **Không cần cả 2**: Chỉ cần file ở 1 trong 2 vị trí trên là đủ
2. **Android Assets**: Cần rebuild app để native module hoạt động
3. **React Native Assets**: Hoạt động ngay, không cần rebuild (nhưng có thể chậm hơn)
4. **File dư thừa**: Có thể xóa file ở các vị trí sai (như `src/main/facenet_512.tflite`)

## Sau khi copy thành công:

File sẽ được copy vào:
- Android: `/data/user/0/com.mobileappbarenew/files/facenet_512.tflite`
- File này sẽ tồn tại vĩnh viễn, không cần copy lại lần sau

## Troubleshooting:

Nếu vẫn lỗi sau khi đặt file đúng vị trí:

1. **Kiểm tra file tồn tại:**
   ```bash
   # Windows
   dir BareNew\assets\facenet_512.tflite
   dir BareNew\android\app\src\main\assets\facenet_512.tflite
   
   # Mac/Linux
   ls BareNew/assets/facenet_512.tflite
   ls BareNew/android/app/src/main/assets/facenet_512.tflite
   ```

2. **Nếu dùng Android Assets:**
   - Phải rebuild app (`npm run android:rebuild`)
   - Kiểm tra native module có sẵn trong log: `AssetCopyModule available: true`

3. **Nếu dùng React Native Assets:**
   - Restart Metro bundler
   - Clear cache: `npm start -- --reset-cache`

4. **Xem log chi tiết:**
   - App sẽ thử nhiều method
   - Method nào thành công sẽ hiển thị trong log

