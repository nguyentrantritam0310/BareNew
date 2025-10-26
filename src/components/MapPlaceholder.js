import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

const MapPlaceholder = ({ 
  latitude, 
  longitude, 
  markers = [], 
  style,
  activeMachineName 
}) => {
  return (
    <View style={[styles.container, style]}>
      {/* Header với thông tin vị trí */}
      <View style={styles.header}>
        <Icon name="map-marker" size={24} color="#3498db" />
        <Text style={styles.headerText}>Vị trí hiện tại</Text>
      </View>
      
      {/* Thông tin tọa độ */}
      <View style={styles.coordinateContainer}>
        <View style={styles.coordinateItem}>
          <Text style={styles.coordinateLabel}>Vĩ độ</Text>
          <Text style={styles.coordinateValue}>{latitude?.toFixed(6)}</Text>
        </View>
        <View style={styles.coordinateItem}>
          <Text style={styles.coordinateLabel}>Kinh độ</Text>
          <Text style={styles.coordinateValue}>{longitude?.toFixed(6)}</Text>
        </View>
      </View>
      
      {/* Danh sách máy chấm công */}
      <View style={styles.machinesContainer}>
        <Text style={styles.machinesTitle}>Máy chấm công</Text>
        {markers.map((machine, index) => (
          <View key={index} style={[
            styles.machineItem,
            machine.title === activeMachineName && styles.machineItemActive
          ]}>
            <Icon 
              name={machine.title === activeMachineName ? "check-circle" : "circle"} 
              size={16} 
              color={machine.title === activeMachineName ? "#27ae60" : "#95a5a6"} 
            />
            <Text style={[
              styles.machineText,
              machine.title === activeMachineName && styles.machineTextActive
            ]}>
              {machine.title}
            </Text>
            <Text style={styles.machineCoords}>
              {machine.latitude.toFixed(4)}, {machine.longitude.toFixed(4)}
            </Text>
          </View>
        ))}
      </View>
      
      {/* Footer */}
      <View style={styles.footer}>
        <Icon name="information" size={16} color="#7f8c8d" />
        <Text style={styles.footerText}>Bản đồ sẽ được cập nhật trong phiên bản tiếp theo</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginLeft: 8,
  },
  coordinateContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  coordinateItem: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 8,
    marginHorizontal: 4,
  },
  coordinateLabel: {
    fontSize: 12,
    color: '#7f8c8d',
    marginBottom: 4,
  },
  coordinateValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  machinesContainer: {
    marginBottom: 16,
  },
  machinesTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 12,
  },
  machineItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    borderRadius: 6,
    marginBottom: 4,
  },
  machineItemActive: {
    backgroundColor: '#e8f5e8',
  },
  machineText: {
    flex: 1,
    fontSize: 14,
    color: '#2c3e50',
    marginLeft: 8,
  },
  machineTextActive: {
    color: '#27ae60',
    fontWeight: 'bold',
  },
  machineCoords: {
    fontSize: 12,
    color: '#7f8c8d',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#ecf0f1',
  },
  footerText: {
    fontSize: 12,
    color: '#7f8c8d',
    marginLeft: 4,
    textAlign: 'center',
  },
});

export default MapPlaceholder;
