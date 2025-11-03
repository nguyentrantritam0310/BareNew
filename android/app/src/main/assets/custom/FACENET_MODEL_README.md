# FaceNet Model Setup

Để sử dụng FaceNet on-device, bạn cần download và đặt file model `.tflite` vào thư mục assets.

## Download FaceNet Model

### Option 1: Pre-trained FaceNet Model (Khuyến nghị)

1. **Download từ TensorFlow Hub hoặc GitHub:**
   - Tìm kiếm "FaceNet TensorFlow Lite" hoặc "facenet tflite"
   - Model cần có output là 512-dim embeddings
   - Input size: 160x160x3 RGB

2. **Nguồn tham khảo:**
   - TensorFlow Hub: https://tfhub.dev/
   - GitHub: https://github.com/davidsandberg/facenet (convert to TFLite)
   - Google Colab để convert: https://colab.research.google.com/

3. **Đặt tên file:** `facenet.tflite`

4. **Đặt vào thư mục:**
   - Android: Copy vào `BareNew/android/app/src/main/assets/facenet.tflite`
   - iOS: Thêm vào Xcode project trong `assets` folder

### Option 2: Convert từ Python FaceNet Model

Nếu bạn đã có FaceNet model từ server (InceptionResnetV1), bạn có thể convert sang TFLite:

```python
import tensorflow as tf
from facenet_pytorch import InceptionResnetV1

# Load model
model = InceptionResnetV1(pretrained='vggface2').eval()

# Convert to TensorFlow Lite
converter = tf.lite.TFLiteConverter.from_saved_model(model_path)
converter.optimizations = [tf.lite.Optimize.DEFAULT]
tflite_model = converter.convert()

# Save
with open('facenet.tflite', 'wb') as f:
    f.write(tflite_model)
```

## Model Requirements

- **Format:** TensorFlow Lite (.tflite)
- **Input:** 160x160x3 RGB image, normalized [0, 1]
- **Output:** 512-dim embedding vector (L2 normalized)
- **Size:** ~5-10MB

## Verification

Sau khi đặt model vào đúng vị trí, khởi động lại app và kiểm tra console logs:
- `✅ FaceNet model loaded successfully` = Model đã được load thành công
- `⚠️ FaceNet model file not found` = Cần đặt model vào đúng vị trí

## Fallback

Nếu model không có sẵn, hệ thống sẽ fallback về custom embedding (256-dim) hiện tại.

