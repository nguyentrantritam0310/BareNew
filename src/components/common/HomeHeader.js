import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';
// import { LinearGradient } from 'expo-linear-gradient';
// import { BlurView } from 'expo-blur';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

const HomeHeader = ({ 
  userName,
  onLogoutPress,
  avatarSource
}) => {
  return (
    <View style={styles.headerWrap}>
      <View style={styles.headerBlur}>
        <View style={styles.headerRow}>
          <TouchableOpacity style={styles.logoutButton} onPress={onLogoutPress}>
            <View style={styles.logoutButtonGradient}>
              <Icon name="logout" size={20} color="#ffffff" />
            </View>
          </TouchableOpacity>
          
          <View style={styles.logoContainer}>
            <View style={styles.logoGradient}>
              <Image source={avatarSource} style={styles.logo} />
            </View>
          </View>
        </View>
        
        <View style={styles.userInfoSection}>
          <Text style={styles.hello}>Xin chào blef</Text>
          <Text style={styles.userName}>{userName}</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  headerWrap: {
    width: '100%',
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    paddingTop: 50,
    paddingBottom: 32,
    alignItems: 'center',
    marginBottom: 24,
    position: 'relative',
    backgroundColor: '#2c3e50', // Thay thế gradient bằng solid color
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  headerBlur: {
    width: '100%',
    alignItems: 'center',
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  headerRow: {
    flexDirection: 'row',
    width: '100%',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    marginBottom: 20,
    paddingTop: 8,
  },
  logoContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 6,
    },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
  },
  logoGradient: {
    width: '100%',
    height: '100%',
    borderRadius: 28,
    padding: 2,
    backgroundColor: '#3498db', // Thay thế gradient bằng solid color
  },
  logo: {
    width: 52,
    height: 52,
    borderRadius: 26,
  },
  logoutButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  logoutButtonGradient: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 24,
    backgroundColor: '#e74c3c', // Thay thế gradient bằng solid color
  },
  userInfoSection: {
    alignItems: 'center',
    paddingBottom: 8,
  },
  hello: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 16,
    marginBottom: 4,
    fontWeight: '500',
    letterSpacing: 0.3,
  },
  userName: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 4,
    letterSpacing: 0.2,
  },
});

export default HomeHeader;
