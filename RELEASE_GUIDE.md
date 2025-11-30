# Hướng dẫn Release App Android

## Tổng quan

Hướng dẫn này sẽ giúp bạn build và release app React Native Android lên Google Play Store hoặc phân phối APK.

## Bước 1: Tạo Release Keystore

**QUAN TRỌNG**: Keystore là file quan trọng nhất. Nếu mất keystore, bạn sẽ KHÔNG THỂ update app trên Google Play Store.

### Cách 1: Sử dụng script tự động (Khuyến nghị)

**Từ PowerShell:**
```powershell
cd android
./generate-keystore.ps1
```

**Từ Command Prompt:**
```cmd
cd android
generate-keystore.bat
```
3. Nhập thông tin theo hướng dẫn:
   - Keystore alias (mặc định: `constructpro-key`)
   - Keystore password (tối thiểu 6 ký tự)
   - Key password (có thể giống keystore password)

### Cách 2: Tạo thủ công

```bash
cd android/app
keytool -genkeypair -v -storetype PKCS12 -keystore release.keystore -alias constructpro-key -keyalg RSA -keysize 2048 -validity 10000
```

## Bước 2: Cấu hình Keystore Properties

1. Copy file template:
   ```bash
   cd android
   copy keystore.properties.example keystore.properties
   ```

2. Mở `android/keystore.properties` và điền thông tin:
   ```properties
   MYAPP_RELEASE_STORE_FILE=release.keystore
   MYAPP_RELEASE_KEY_ALIAS=constructpro-key
   MYAPP_RELEASE_STORE_PASSWORD=your-keystore-password
   MYAPP_RELEASE_KEY_PASSWORD=your-key-password
   ```

3. **LƯU Ý**: File `keystore.properties` và `release.keystore` đã được thêm vào `.gitignore`. KHÔNG commit các file này vào git!

## Bước 3: Cập nhật Version

Trước mỗi lần release, cập nhật version trong `android/app/build.gradle`:

```gradle
defaultConfig {
    versionCode 2        // Tăng số này mỗi lần upload lên Play Store
    versionName "1.0.1"  // Version hiển thị cho người dùng
}
```

**Quy tắc version:**
- `versionCode`: Số nguyên, phải tăng mỗi lần upload (1, 2, 3, ...)
- `versionName`: String, có thể là bất kỳ (1.0, 1.0.1, 2.0.0, ...)

## Bước 4: Build Release

### Build APK (để cài trực tiếp)

**Từ PowerShell:**
```powershell
./build-release-apk.ps1
```

**Từ Command Prompt:**
```cmd
build-release-apk.bat
```

APK sẽ được tạo tại: `android/app/build/outputs/apk/release/app-release.apk`

### Build AAB (cho Google Play Store)

**Từ PowerShell:**
```powershell
./build-release-aab.ps1
```

**Từ Command Prompt:**
```cmd
build-release-aab.bat
```

AAB sẽ được tạo tại: `android/app/build/outputs/bundle/release/app-release.aab`

**Lưu ý**: 
- Google Play Store yêu cầu AAB, không phải APK.
- Nếu gặp lỗi khi chạy `.bat` từ PowerShell, hãy dùng `.ps1` scripts hoặc chạy bằng `cmd /c build-release-apk.bat`

## Bước 5: Test Release Build

1. Cài APK lên thiết bị thật:
   ```bash
   adb install android/app/build/outputs/apk/release/app-release.apk
   ```

2. Test các chức năng chính của app
3. Kiểm tra performance và không có crash

## Bước 6: Upload lên Google Play Store

1. Đăng nhập [Google Play Console](https://play.google.com/console)
2. Tạo app mới hoặc chọn app hiện có
3. Vào **Production** > **Create new release**
4. Upload file AAB (`app-release.aab`)
5. Điền thông tin release notes
6. Review và submit

### Yêu cầu trước khi publish:

- [ ] App icon (512x512px)
- [ ] Feature graphic (1024x500px)
- [ ] Screenshots (tối thiểu 2 ảnh)
- [ ] Mô tả app (tiếng Việt và tiếng Anh)
- [ ] Privacy policy URL (nếu app thu thập dữ liệu)
- [ ] Content rating
- [ ] Target audience

## Troubleshooting

### Lỗi: "keystore.properties not found"
- Đảm bảo đã copy `keystore.properties.example` thành `keystore.properties`
- Kiểm tra file có trong thư mục `android/`

### Lỗi: "Keystore was tampered with, or password was incorrect"
- Kiểm tra lại password trong `keystore.properties`
- Đảm bảo alias đúng

### Lỗi: "Duplicate version code"
- Tăng `versionCode` trong `build.gradle`
- Mỗi lần upload lên Play Store phải có versionCode mới

### Build chậm
- Đóng Metro bundler trước khi build
- Xóa cache: `cd android && gradlew.bat clean`

## Bảo mật

1. **Backup keystore**: Lưu `release.keystore` ở nhiều nơi an toàn (USB, cloud encrypted, ...)
2. **Không commit keystore**: Đã được thêm vào `.gitignore`
3. **Password mạnh**: Sử dụng password phức tạp cho keystore
4. **Lưu thông tin**: Ghi lại alias và password ở nơi an toàn

## Tài liệu tham khảo

- [React Native Android Release](https://reactnative.dev/docs/signed-apk-android)
- [Google Play Console Help](https://support.google.com/googleplay/android-developer)
- [Android App Bundle](https://developer.android.com/guide/app-bundle)

