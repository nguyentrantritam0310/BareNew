import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

const Header = ({ 
  title, 
  onBackPress, 
  showBackButton = true, 
  rightComponent,
  backgroundColor = '#f8fafc',
  titleColor = '#1e293b'
}) => {
  return (
    <View style={[styles.header, { backgroundColor }]}>
      <View style={styles.headerContent}>
        {showBackButton ? (
          <TouchableOpacity style={styles.backBtn} onPress={onBackPress}>
            <View style={styles.backBtnContainer}>
              <Icon name="arrow-left" size={24} color="#64748b" />
            </View>
          </TouchableOpacity>
        ) : (
          <View style={styles.placeholder} />
        )}
        
        <Text style={[styles.headerTitle, { color: titleColor }]}>
          {title}
        </Text>
        
        {rightComponent ? (
          rightComponent
        ) : (
          <View style={styles.placeholder} />
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 20,
  },
  backBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backBtnContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontWeight: 'bold',
    fontSize: 22,
    textAlign: 'center',
    flex: 1,
    letterSpacing: 1,
  },
  placeholder: {
    width: 48,
  },
});

export default Header;
