import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

const Tab = createBottomTabNavigator();

export default function AttendanceLayout() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ color, size }) => {
          let iconName = 'cloud-outline';
          if (route.name === 'summary') iconName = 'calendar-month-outline';
          if (route.name === 'detail') iconName = 'file-document-outline';
          if (route.name === 'overtime') iconName = 'clock-plus-outline';
          return <Icon name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#008080',
        tabBarInactiveTintColor: '#bdbdbd',
        tabBarLabelStyle: { fontWeight: 'bold', fontSize: 13 },
        tabBarStyle: { backgroundColor: '#fff' },
      })}
    >
      <Tab.Screen name="index" options={{ title: 'Dữ Liệu' }} component={require('./index.js').default} />
      <Tab.Screen name="summary" options={{ title: 'Tổng Công' }} component={require('./summary.js').default} />
      <Tab.Screen name="detail" options={{ title: 'Chi Tiết' }} component={require('./detail.js').default} />
      <Tab.Screen name="overtime" options={{ title: 'Tăng Ca' }} component={require('./overtime.js').default} />
    </Tab.Navigator>
  );
}
