import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useAuth } from '../contexts/AuthContext';
import { useNavigation } from '@react-navigation/native';

const ChangePasswordScreen = () => {
  const { changePassword, isLoading, isAuthenticated, isLoading: authLoading } = useAuth();
  const navigation = useNavigation();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const isFormValid = currentPassword.trim().length > 0 && 
                     newPassword.trim().length > 0 && 
                     confirmPassword.trim().length > 0 &&
                     newPassword === confirmPassword;

  // Kiểm tra authentication state và chuyển hướng nếu cần
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigation.replace('Login');
    }
  }, [isAuthenticated, authLoading, navigation]);

  const handleChangePassword = async () => {
    if (!isFormValid) {
      Alert.alert('Lỗi', 'Vui lòng nhập đầy đủ thông tin và xác nhận mật khẩu mới');
      return;
    }

    if (newPassword.length < 6) {
      Alert.alert('Lỗi', 'Mật khẩu mới phải có ít nhất 6 ký tự');
      return;
    }

    const result = await changePassword(currentPassword, newPassword);
    
    if (result.success) {
      Alert.alert(
        'Thành công',
        result.message,
        [
            {
              text: 'OK',
              onPress: () => {
                // Navigate back to main app - go to Home screen instead of Attendance
                navigation.replace('(tabs)');
              }
            }
        ]
      );
    } else {
      Alert.alert('Lỗi', result.message);
    }
  };

  // Hiển thị loading nếu đang kiểm tra authentication
  if (authLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text>Đang tải...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.card}>
            {/* Header */}
            <View style={styles.header}>
            <TouchableOpacity 
              style={styles.backButton}
              onPress={() => navigation.goBack()}
            >
                <Icon name="arrow-left" size={24} color="#007bff" />
              </TouchableOpacity>
              <Text style={styles.title}>Đổi mật khẩu</Text>
              <View style={{ width: 24 }} />
            </View>

            <Text style={styles.subtitle}>
              Vui lòng nhập mật khẩu hiện tại và mật khẩu mới
            </Text>

            {/* Form */}
            <View style={styles.form}>
              {/* Current Password */}
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>
                  <Icon name="lock" size={20} color="#666" /> Mật khẩu hiện tại
                </Text>
                <View style={styles.passwordContainer}>
                  <TextInput
                    style={styles.passwordInput}
                    value={currentPassword}
                    onChangeText={setCurrentPassword}
                    placeholder="Nhập mật khẩu hiện tại"
                    placeholderTextColor="#999"
                    secureTextEntry={!showCurrentPassword}
                    autoCapitalize="none"
                    autoCorrect={false}
                    editable={!isLoading}
                  />
                  <TouchableOpacity
                    style={styles.eyeButton}
                    onPress={() => setShowCurrentPassword(!showCurrentPassword)}
                    disabled={isLoading}
                  >
                    <Icon 
                      name={showCurrentPassword ? "eye-off" : "eye"} 
                      size={24} 
                      color="#666" 
                    />
                  </TouchableOpacity>
                </View>
              </View>

              {/* New Password */}
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>
                  <Icon name="lock-plus" size={20} color="#666" /> Mật khẩu mới
                </Text>
                <View style={styles.passwordContainer}>
                  <TextInput
                    style={styles.passwordInput}
                    value={newPassword}
                    onChangeText={setNewPassword}
                    placeholder="Nhập mật khẩu mới"
                    placeholderTextColor="#999"
                    secureTextEntry={!showNewPassword}
                    autoCapitalize="none"
                    autoCorrect={false}
                    editable={!isLoading}
                  />
                  <TouchableOpacity
                    style={styles.eyeButton}
                    onPress={() => setShowNewPassword(!showNewPassword)}
                    disabled={isLoading}
                  >
                    <Icon 
                      name={showNewPassword ? "eye-off" : "eye"} 
                      size={24} 
                      color="#666" 
                    />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Confirm Password */}
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>
                  <Icon name="lock-check" size={20} color="#666" /> Xác nhận mật khẩu mới
                </Text>
                <View style={styles.passwordContainer}>
                  <TextInput
                    style={styles.passwordInput}
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    placeholder="Nhập lại mật khẩu mới"
                    placeholderTextColor="#999"
                    secureTextEntry={!showConfirmPassword}
                    autoCapitalize="none"
                    autoCorrect={false}
                    editable={!isLoading}
                  />
                  <TouchableOpacity
                    style={styles.eyeButton}
                    onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                    disabled={isLoading}
                  >
                    <Icon 
                      name={showConfirmPassword ? "eye-off" : "eye"} 
                      size={24} 
                      color="#666" 
                    />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Password Requirements */}
              <View style={styles.requirementsContainer}>
                <Text style={styles.requirementsTitle}>Yêu cầu mật khẩu:</Text>
                <Text style={styles.requirementsText}>• Ít nhất 6 ký tự</Text>
                <Text style={styles.requirementsText}>• Nên bao gồm chữ hoa, chữ thường và số</Text>
                <Text style={styles.requirementsText}>• Tránh sử dụng thông tin cá nhân</Text>
              </View>

              {/* Change Password Button */}
              <TouchableOpacity
                style={[
                  styles.changePasswordButton,
                  (!isFormValid || isLoading) && styles.changePasswordButtonDisabled
                ]}
                onPress={handleChangePassword}
                disabled={!isFormValid || isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Icon name="key-change" size={24} color="#fff" />
                )}
                <Text style={styles.changePasswordButtonText}>
                  {isLoading ? 'Đang đổi mật khẩu...' : 'Đổi mật khẩu'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 20,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  backButton: {
    padding: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
  },
  form: {
    marginBottom: 24,
  },
  inputContainer: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    backgroundColor: '#f8f9fa',
  },
  passwordInput: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
  },
  eyeButton: {
    padding: 14,
  },
  requirementsContainer: {
    backgroundColor: '#f8f9fa',
    padding: 16,
    borderRadius: 8,
    marginBottom: 24,
  },
  requirementsTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  requirementsText: {
    fontSize: 13,
    color: '#666',
    marginBottom: 4,
  },
  changePasswordButton: {
    backgroundColor: '#007bff',
    borderRadius: 12,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  changePasswordButtonDisabled: {
    backgroundColor: '#ccc',
  },
  changePasswordButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 8,
  },
});

export default ChangePasswordScreen;
