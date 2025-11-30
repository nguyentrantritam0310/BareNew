import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

const Tab = createBottomTabNavigator();

export default function AttendanceLayout() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ color, size, focused }) => {
          let iconName = 'cloud-outline';
          if (route.name === 'index') iconName = 'calendar-check-outline';
          if (route.name === 'summary') iconName = 'calendar-month-outline';
          if (route.name === 'detail') iconName = 'file-document-outline';
          if (route.name === 'overtime') iconName = 'clock-plus-outline';
          return <Icon name={iconName} size={focused ? 26 : 24} color={color} />;
        },
        tabBarActiveTintColor: '#3498db',
        tabBarInactiveTintColor: '#95a5a6',
        tabBarLabelStyle: { 
          fontWeight: '600', 
          fontSize: 12,
          marginTop: -4,
        },
        tabBarStyle: { 
          backgroundColor: '#fff',
          borderTopWidth: 1,
          borderTopColor: '#e0e0e0',
          height: 60,
          paddingBottom: 8,
          paddingTop: 8,
          elevation: 8,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.1,
          shadowRadius: 8,
        },
        tabBarItemStyle: {
          paddingVertical: 4,
        },
      })}
    >
      <Tab.Screen name="summary" options={{ title: 'Tổng Công' }} component={require('./summary.js').default} />
      <Tab.Screen name="overtime" options={{ title: 'Tăng Ca' }} component={require('./overtime.js').default} />
      <Tab.Screen name="detail" options={{ title: 'Chi Tiết' }} component={require('./detail.js').default} />
      <Tab.Screen name="index" options={{ title: 'Dữ Liệu' }} component={require('./index.js').default} />
    </Tab.Navigator>
  );
}
