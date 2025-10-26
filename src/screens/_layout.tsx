import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Platform } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { AuthProvider } from '../contexts/AuthContext';

const Tab = createBottomTabNavigator();

export default function RootLayout() {
  return (
    <AuthProvider>
      <NavigationContainer>
        <Tab.Navigator
          initialRouteName="Home"
          screenOptions={{
            tabBarActiveTintColor: '#008080',
            tabBarInactiveTintColor: '#bdbdbd',
            headerShown: false,
            tabBarStyle: Platform.select({
              ios: {
                position: 'absolute',
              },
              default: {},
            }),
          }}
        >
          <Tab.Screen
            name="Home"
            component={require('(tabs)/index.tsx').default}
            options={{
              title: 'Nhân sự',
              tabBarIcon: ({ color }) => <Icon name="account-group" size={28} color={color} />,
            }}
          />
          <Tab.Screen
            name="Construction"
            component={require('(tabs)/explore.tsx').default}
            options={{
              title: 'Công trình',
              tabBarIcon: ({ color }) => <Icon name="office-building" size={28} color={color} />,
            }}
          />
        </Tab.Navigator>
      </NavigationContainer>
    </AuthProvider>
  );
}
