package com.mobileappbarenew

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.util.Log
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.Arguments
import java.io.File
import java.io.FileOutputStream
import java.io.InputStream

class AssetCopyModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {
  
  override fun getName(): String {
    return "AssetCopyModule"
  }

  @ReactMethod
  fun copyAssetToFiles(assetName: String, targetPath: String, promise: Promise) {
    try {
      val context: Context = reactApplicationContext.applicationContext
      
      // Open asset file
      val inputStream: InputStream = context.assets.open(assetName)
      
      // Create target file
      val targetFile = File(targetPath)
      targetFile.parentFile?.mkdirs()
      
      // Copy file
      val outputStream = FileOutputStream(targetFile)
      inputStream.copyTo(outputStream)
      
      inputStream.close()
      outputStream.close()
      
      Log.d("AssetCopyModule", "Successfully copied $assetName to $targetPath")
      promise.resolve(targetPath)
    } catch (e: Exception) {
      Log.e("AssetCopyModule", "Error copying asset: ${e.message}", e)
      promise.reject("ASSET_COPY_ERROR", "Failed to copy asset: ${e.message}", e)
    }
  }

  @ReactMethod
  fun copyResourceToFiles(resourceId: Int, targetPath: String, promise: Promise) {
    try {
      val context: Context = reactApplicationContext.applicationContext
      
      // Open resource by ID
      val inputStream: InputStream = context.resources.openRawResource(resourceId)
      
      // Create target file
      val targetFile = File(targetPath)
      targetFile.parentFile?.mkdirs()
      
      // Copy file
      val outputStream = FileOutputStream(targetFile)
      inputStream.copyTo(outputStream)
      
      inputStream.close()
      outputStream.close()
      
      Log.d("AssetCopyModule", "Successfully copied resource $resourceId to $targetPath")
      promise.resolve(targetPath)
    } catch (e: Exception) {
      Log.e("AssetCopyModule", "Error copying resource: ${e.message}", e)
      promise.reject("RESOURCE_COPY_ERROR", "Failed to copy resource: ${e.message}", e)
    }
  }

  @ReactMethod
  fun decodeImageToPixels(imagePath: String, promise: Promise) {
    try {
      Log.d("AssetCopyModule", "Decoding image to pixels: $imagePath")
      
      // Load bitmap from file
      val bitmap = BitmapFactory.decodeFile(imagePath)
      if (bitmap == null) {
        promise.reject("IMAGE_DECODE_ERROR", "Failed to decode image from path: $imagePath")
        return
      }
      
      val width = bitmap.width
      val height = bitmap.height
      Log.d("AssetCopyModule", "Image dimensions: ${width}x${height}")
      
      // Extract RGB pixels and normalize to [0, 1]
      // Format: [R, G, B, R, G, B, ...] row by row
      val pixelArray = Arguments.createArray()
      val pixels = IntArray(width * height)
      bitmap.getPixels(pixels, 0, width, 0, 0, width, height)
      
      for (pixel in pixels) {
        // Extract RGB values (ARGB format)
        val r = ((pixel shr 16) and 0xFF) / 255.0f
        val g = ((pixel shr 8) and 0xFF) / 255.0f
        val b = (pixel and 0xFF) / 255.0f
        
        // Add normalized values to array
        pixelArray.pushDouble(r.toDouble())
        pixelArray.pushDouble(g.toDouble())
        pixelArray.pushDouble(b.toDouble())
      }
      
      bitmap.recycle()
      
      Log.d("AssetCopyModule", "Successfully decoded image: ${pixelArray.size()} pixels")
      promise.resolve(pixelArray)
    } catch (e: Exception) {
      Log.e("AssetCopyModule", "Error decoding image: ${e.message}", e)
      promise.reject("IMAGE_DECODE_ERROR", "Failed to decode image: ${e.message}", e)
    }
  }
}

