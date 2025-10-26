import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import CustomHeader from '../../components/CustomHeader';

export default function AttendanceOvertime() {
  
  return (
    <View style={styles.container}>
        <CustomHeader title="Tăng ca" />
        <View style={styles.content}>
          <Icon name="clock-outline" size={64} color="#bdbdbd" />
          <Text style={styles.text}>Tính năng tăng ca đang được phát triển</Text>
          <Text style={styles.subText}>Vui lòng quay lại sau</Text>
        </View>
      </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f6f8fa',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  text: {
    color: '#666',
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 16,
    textAlign: 'center',
  },
  subText: {
    color: '#999',
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
});
