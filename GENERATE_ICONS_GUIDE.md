# Hướng dẫn tạo App Icon từ Logo

## Bước 1: Cài đặt thư viện xử lý ảnh

Chọn một trong hai cách:

### Cách 1: Dùng Sharp (nhanh hơn, khuyến nghị)
```bash
npm install --save-dev sharp
```

### Cách 2: Dùng Jimp (nhẹ hơn)
```bash
npm install --save-dev jimp
```

## Bước 2: Chạy script tạo icon

```bash
npm run generate-icons
```

Hoặc chạy trực tiếp:
```bash
node generate-icons-from-logo.js
```

## Bước 3: Rebuild app

Sau khi tạo icon, rebuild app để áp dụng thay đổi:

```bash
cd android
.\gradlew.bat clean
.\gradlew.bat assembleRelease
```

## Kết quả

Script sẽ tạo các icon với kích thước:
- **mipmap-mdpi**: 48x48 px
- **mipmap-hdpi**: 72x72 px  
- **mipmap-xhdpi**: 96x96 px
- **mipmap-xxhdpi**: 144x144 px
- **mipmap-xxxhdpi**: 192x192 px

Các file sẽ được tạo tại:
- `android/app/src/main/res/mipmap-*/ic_launcher.png`
- `android/app/src/main/res/mipmap-*/ic_launcher_round.png`

## Lưu ý

- Logo gốc phải ở: `assets/images/logo_construction.png`
- Icon sẽ được resize tự động để fit vào kích thước yêu cầu
- Nếu logo không vuông, sẽ được fit với background trong suốt

