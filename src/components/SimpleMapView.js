import React from 'react';
import { WebView } from 'react-native-webview';

const SimpleMapView = ({ 
  latitude, 
  longitude, 
  markers = [], 
  style,
  onMapReady 
}) => {
  // Tạo HTML cho OpenStreetMap với Leaflet (không cần API key)
  const createMapHTML = () => {
    const markersHTML = markers.map((marker, index) => {
      const color = marker.color === 'green' ? 'green' : marker.color === 'blue' ? 'blue' : 'red';
      return `
        L.marker([${marker.latitude}, ${marker.longitude}])
          .addTo(map)
          .bindPopup('${marker.title || ''}')
          .openPopup();
      `;
    }).join('');

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
        <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
        <style>
          body { margin: 0; padding: 0; }
          #map { width: 100%; height: 100%; }
        </style>
      </head>
      <body>
        <div id="map"></div>
        <script>
          let map;
          
          function initMap() {
            // Khởi tạo map với OpenStreetMap
            map = L.map('map').setView([${latitude}, ${longitude}], 16);
            
            // Thêm tile layer từ OpenStreetMap
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
              attribution: '© OpenStreetMap contributors'
            }).addTo(map);
            
            // Marker cho vị trí hiện tại
            L.marker([${latitude}, ${longitude}])
              .addTo(map)
              .bindPopup('Vị trí hiện tại')
              .openPopup();
            
            // Các markers khác
            ${markersHTML}
            
            // Thông báo map đã sẵn sàng
            if (window.ReactNativeWebView) {
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'mapReady',
                message: 'Map is ready'
              }));
            }
          }
          
          // Khởi tạo map khi trang load
          window.onload = initMap;
        </script>
      </body>
      </html>
    `;
  };

  const handleMessage = (event) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'mapReady' && onMapReady) {
        onMapReady();
      }
    } catch (error) {
      console.log('Error parsing WebView message:', error);
    }
  };

  return (
    <WebView
      source={{ html: createMapHTML() }}
      style={style}
      onMessage={handleMessage}
      javaScriptEnabled={true}
      domStorageEnabled={true}
      startInLoadingState={true}
      scalesPageToFit={false}
      scrollEnabled={false}
      bounces={false}
      showsHorizontalScrollIndicator={false}
      showsVerticalScrollIndicator={false}
    />
  );
};

export default SimpleMapView;
