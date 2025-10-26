import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

// Import screens
import HomeScreen from '../screens/(tabs)/index';
import LeaveListScreen from '../screens/leave/index';
import AddLeaveScreen from '../screens/leave/add';
import EditLeaveScreen from '../screens/leave/edit/[id]';
import LeaveDetailScreen from '../screens/leave/[id]';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// Leave Stack Navigator
function LeaveStackNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen name="LeaveList" component={LeaveListScreen} />
      <Stack.Screen name="AddLeave" component={AddLeaveScreen} />
      <Stack.Screen name="EditLeave" component={EditLeaveScreen} />
      <Stack.Screen name="LeaveDetail" component={LeaveDetailScreen} />
    </Stack.Navigator>
  );
}

// Main Tab Navigator
function TabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;

          if (route.name === 'Home') {
            iconName = focused ? 'home' : 'home-outline';
          } else if (route.name === 'Leave') {
            iconName = focused ? 'calendar-clock' : 'calendar-clock-outline';
          }

          return <Icon name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#3498db',
        tabBarInactiveTintColor: 'gray',
        headerShown: false,
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Leave" component={LeaveStackNavigator} />
    </Tab.Navigator>
  );
}

// Main App Navigator
export default function AppNavigator() {
  return (
    <NavigationContainer>
      <TabNavigator />
    </NavigationContainer>
  );
}
