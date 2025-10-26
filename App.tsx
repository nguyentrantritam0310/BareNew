import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'react-native';

// Import contexts
import { AuthProvider, useAuth } from './src/contexts/AuthContext';

// Import screens
import LoginScreen from './src/screens/login';
import HomeScreen from './src/screens/(tabs)/index';
import AttendanceLayout from './src/screens/attendance/_layout';
import ProfileScreen from './src/screens/profile';
import PayslipScreen from './src/screens/payslip';
import CheckinScreen from './src/screens/checkin';
import FaceRegistrationScreen from './src/screens/FaceRegistrationScreen';

// Import Leave screens
import LeaveListScreen from './src/screens/leave/index';
import AddLeaveScreen from './src/screens/leave/add';
import EditLeaveScreen from './src/screens/leave/edit/[id]';
import LeaveDetailScreen from './src/screens/leave/[id]';
import OvertimeListScreen from './src/screens/overtime/index';
import AddOvertimeScreen from './src/screens/overtime/add';
import EditOvertimeScreen from './src/screens/overtime/edit/[id]';
import OvertimeDetailScreen from './src/screens/overtime/[id]';

const Stack = createNativeStackNavigator();

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

// Overtime Stack Navigator
function OvertimeStackNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen name="OvertimeList" component={OvertimeListScreen} />
      <Stack.Screen name="AddOvertime" component={AddOvertimeScreen} />
      <Stack.Screen name="EditOvertime" component={EditOvertimeScreen} />
      <Stack.Screen name="OvertimeDetail" component={OvertimeDetailScreen} />
    </Stack.Navigator>
  );
}

// Main Stack Navigator
function MainStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="HomeMain" component={HomeScreen} />
      <Stack.Screen name="AttendanceLayout" component={AttendanceLayout} />
      <Stack.Screen name="Profile" component={ProfileScreen} />
      <Stack.Screen name="Payslip" component={PayslipScreen} />
      <Stack.Screen name="Checkin" component={CheckinScreen} />
      <Stack.Screen name="Leave" component={LeaveStackNavigator} />
      <Stack.Screen name="Overtime" component={OvertimeStackNavigator} />
      <Stack.Screen name="FaceRegistration" component={FaceRegistrationScreen} />
    </Stack.Navigator>
  );
}

// Main App Component với Authentication
function MainApp() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return null; // Hoặc loading screen
  }

  return (
    <NavigationContainer>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      {isAuthenticated ? (
        <MainStack />
      ) : (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Login" component={LoginScreen} />
        </Stack.Navigator>
      )}
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}
