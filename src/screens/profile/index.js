import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import CustomHeader from '../../components/CustomHeader';

export default function ProfileScreen() {
  return (
    <View style={styles.container}>
      <CustomHeader title="HỒ SƠ" />
      <View style={styles.content}>
        <Text style={styles.text}>Màn hình hồ sơ</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f6f8fa' },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  text: {
    fontSize: 18,
    color: '#666',
  },
});
