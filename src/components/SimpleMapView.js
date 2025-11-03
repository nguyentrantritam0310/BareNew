import React, { useState } from 'react';
import { View, ActivityIndicator, Text, StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';

const SimpleMapView = ({ 
  latitude, 
  longitude, 
  markers = [], 
  style,
  onMapReady 
}) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Tạo HTML cho OpenStreetMap với Leaflet (không cần API key)
  const createMapHTML = () => {
    const markersHTML = markers.map((marker, index) => {
      // Escape single quotes trong title để tránh lỗi JS
      const escapedTitle = (marker.title || '').replace(/'/g, "\\'");
      return `
        L.marker([${marker.latitude}, ${marker.longitude}], {
          icon: L.icon({
            iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-${marker.color || 'red'}.png',
            shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
            iconSize: [25, 41],
            iconAnchor: [12, 41],
            popupAnchor: [1, -34],
            shadowSize: [41, 41]
          })
        })
          .addTo(map)
          .bindPopup('${escapedTitle}');
      `;
    }).join('');

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" 
              integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=" 
              crossorigin=""/>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          html, body { width: 100%; height: 100%; overflow: hidden; }
          #map { width: 100%; height: 100vh; position: absolute; top: 0; left: 0; }
        </style>
      </head>
      <body>
        <div id="map"></div>
        <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"
                integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo="
                crossorigin=""></script>
        <script>
          let map = null;
          let isInitializing = false;
          
          function initMap() {
            // Tránh khởi tạo nhiều lần
            if (map !== null || isInitializing) {
              console.log('Map already initialized or initializing, skipping...');
              return;
            }
            
            // Kiểm tra xem container có tồn tại không
            const mapContainer = document.getElementById('map');
            if (!mapContainer) {
              console.error('Map container not found');
              return;
            }
            
            // Kiểm tra xem Leaflet đã load chưa
            if (typeof L === 'undefined') {
              console.log('Leaflet not loaded yet, retrying...');
              setTimeout(initMap, 100);
              return;
            }
            
            isInitializing = true;
            
            try {
              // Xóa map cũ nếu có (phòng trường hợp container đã có map)
              if (mapContainer._leaflet_id) {
                try {
                  // Thử lấy map từ global registry hoặc xóa trực tiếp
                  if (typeof L !== 'undefined' && L.Map) {
                    // Xóa map bằng cách remove từ container
                    const existingMapId = mapContainer._leaflet_id;
                    // Tìm map trong Leaflet's internal storage
                    if (L.map && typeof L.map === 'function') {
                      // Xóa innerHTML để reset container
                      mapContainer.innerHTML = '';
                      delete mapContainer._leaflet_id;
                      map = null;
                    } else {
                      // Fallback: clear container
                      mapContainer.innerHTML = '';
                      delete mapContainer._leaflet_id;
                      map = null;
                    }
                  } else {
                    // Leaflet chưa load, chỉ clear container
                    mapContainer.innerHTML = '';
                    delete mapContainer._leaflet_id;
                    map = null;
                  }
                } catch (e) {
                  // Nếu không xóa được, xóa innerHTML để reset
                  console.log('Could not remove existing map, clearing container:', e);
                  mapContainer.innerHTML = '';
                  mapContainer.style.width = '100%';
                  mapContainer.style.height = '100vh';
                  delete mapContainer._leaflet_id;
                  map = null;
                }
              }
              
              // Khởi tạo map với OpenStreetMap (chỉ khi chưa có map)
              if (!map || !mapContainer._leaflet_id) {
                map = L.map('map', {
                  zoomControl: true,
                  scrollWheelZoom: true,
                  doubleClickZoom: true,
                  boxZoom: true,
                  dragging: true,
                  touchZoom: true
                }).setView([${latitude || 0}, ${longitude || 0}], 18);
                
                // Thêm tile layer từ OpenStreetMap - zoom tối đa là 19
                const tileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                  maxZoom: 19,
                  minZoom: 1,
                  attribution: '© OpenStreetMap contributors',
                  noWrap: false
                }).addTo(map);
                
                // Đợi map load tiles xong rồi mới zoom chi tiết
                map.whenReady(function() {
                  setTimeout(function() {
                    map.setView([${latitude || 0}, ${longitude || 0}], 18);
                  }, 300);
                });
              } else {
                // Map đã tồn tại, chỉ cập nhật view với zoom cao (18 - chi tiết nhưng không mất tile)
                map.setView([${latitude || 0}, ${longitude || 0}], 18);
                
                // Xóa tất cả markers cũ
                map.eachLayer(function(layer) {
                  if (layer instanceof L.Marker) {
                    map.removeLayer(layer);
                  }
                });
              }
              
              if (map) {
                
                // Marker cho vị trí hiện tại với icon màu xanh
                L.marker([${latitude || 0}, ${longitude || 0}], {
                  icon: L.icon({
                    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-blue.png',
                    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
                    iconSize: [25, 41],
                    iconAnchor: [12, 41],
                    popupAnchor: [1, -34],
                    shadowSize: [41, 41]
                  })
                })
                  .addTo(map)
                  .bindPopup('Vị trí của bạn')
                  .openPopup();
                
                // Các markers khác
                ${markersHTML}
                
                // Zoom cao vào vị trí hiện tại để hiển thị chi tiết (level 18 - hợp lý với OpenStreetMap)
                try {
                  // Đợi map sẵn sàng rồi mới zoom
                  map.whenReady(function() {
                    setTimeout(function() {
                      map.setView([${latitude || 0}, ${longitude || 0}], 18);
                    }, 300);
                  });
                } catch (e) {
                  console.log('Zoom error:', e);
                }
              }
              
              isInitializing = false;
              
              // Thông báo map đã sẵn sàng
              if (window.ReactNativeWebView) {
                window.ReactNativeWebView.postMessage(JSON.stringify({
                  type: 'mapReady',
                  message: 'Map is ready'
                }));
              }
            } catch (error) {
              isInitializing = false;
              console.error('Map initialization error:', error);
              if (window.ReactNativeWebView) {
                window.ReactNativeWebView.postMessage(JSON.stringify({
                  type: 'mapError',
                  message: error.toString()
                }));
              }
            }
          }
          
          // Chỉ khởi tạo map một lần khi DOM ready
          let initCalled = false;
          function tryInit() {
            if (initCalled) return;
            initCalled = true;
            setTimeout(initMap, 200);
          }
          
          // Thử khởi tạo khi DOM ready
          if (document.readyState === 'complete' || document.readyState === 'interactive') {
            tryInit();
          } else {
            document.addEventListener('DOMContentLoaded', tryInit, { once: true });
          }
          
          // Fallback: thử init sau khi window load (chỉ nếu chưa init)
          window.addEventListener('load', function() {
            if (!initCalled && !map) {
              tryInit();
            }
          }, { once: true });
        </script>
      </body>
      </html>
    `;
  };

  const handleMessage = (event) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'mapReady') {
        setLoading(false);
        setError(null);
        if (onMapReady) {
          onMapReady();
        }
      } else if (data.type === 'mapError') {
        setLoading(false);
        setError(data.message || 'Lỗi khi tải bản đồ');
      }
    } catch (error) {
      console.log('Error parsing WebView message:', error);
    }
  };

  const handleError = (syntheticEvent) => {
    const { nativeEvent } = syntheticEvent;
    console.error('WebView error:', nativeEvent);
    setLoading(false);
    setError('Không thể tải bản đồ. Vui lòng kiểm tra kết nối mạng.');
  };

  const handleLoadEnd = () => {
    // Nếu sau 3 giây vẫn loading thì coi như có lỗi
    setTimeout(() => {
      if (loading) {
        setLoading(false);
      }
    }, 3000);
  };

  if (!latitude || !longitude) {
    return (
      <View style={[styles.container, style]}>
        <Text style={styles.errorText}>Không có thông tin vị trí</Text>
      </View>
    );
  }

  // Tạo key duy nhất dựa trên lat/lng để force re-render khi thay đổi vị trí lớn
  const mapKey = `${latitude?.toFixed(2)}_${longitude?.toFixed(2)}`;

  return (
    <View style={[styles.container, style]}>
      <WebView
        key={mapKey}
        source={{ html: createMapHTML() }}
        style={styles.webview}
        onMessage={handleMessage}
        onError={handleError}
        onLoadEnd={handleLoadEnd}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        startInLoadingState={true}
        scalesPageToFit={true}
        scrollEnabled={true}
        bounces={false}
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
        allowsInlineMediaPlayback={true}
        mediaPlaybackRequiresUserAction={false}
        mixedContentMode="always"
        originWhitelist={['*']}
      />
      {loading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2563eb" />
          <Text style={styles.loadingText}>Đang tải bản đồ...</Text>
        </View>
      )}
      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: 'relative',
  },
  webview: {
    flex: 1,
    backgroundColor: '#f0f0f0',
  },
  loadingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
  },
  loadingText: {
    marginTop: 10,
    color: '#2563eb',
    fontSize: 14,
  },
  errorContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    padding: 20,
  },
  errorText: {
    color: '#ef4444',
    fontSize: 14,
    textAlign: 'center',
  },
});

export default SimpleMapView;
