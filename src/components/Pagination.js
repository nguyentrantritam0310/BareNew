import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

export default function Pagination({
  currentPage,
  totalPages,
  totalItems,
  itemsPerPage,
  onPreviousPage,
  onNextPage,
  showInfo = true,
  style
}) {
  if (totalItems === 0 || totalPages === 0) {
    return null;
  }

  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, totalItems);

  return (
    <View style={[styles.paginationCard, style]}>
      {showInfo && (
        <Text style={styles.paginationText}>
          Hiển thị {startIndex + 1}-{endIndex} trên {totalItems} bản ghi
        </Text>
      )}
      <View style={styles.paginationControls}>
        <TouchableOpacity 
          style={[styles.pageButton, currentPage === 1 && styles.pageButtonDisabled]} 
          onPress={onPreviousPage}
          disabled={currentPage === 1}
          activeOpacity={0.7}
        >
          <Icon name="chevron-left" size={24} color={currentPage === 1 ? '#ccc' : '#3498db'} />
        </TouchableOpacity>
        <View style={styles.pageInfoContainer}>
          <Text style={styles.pageInfo}>
            {currentPage} / {totalPages}
          </Text>
        </View>
        <TouchableOpacity 
          style={[styles.pageButton, currentPage === totalPages && styles.pageButtonDisabled]} 
          onPress={onNextPage}
          disabled={currentPage === totalPages}
          activeOpacity={0.7}
        >
          <Icon name="chevron-right" size={24} color={currentPage === totalPages ? '#ccc' : '#3498db'} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  paginationCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  paginationText: {
    fontSize: 14,
    color: '#6c757d',
    fontWeight: '500',
    flex: 1,
  },
  paginationControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  pageButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#e3f2fd',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pageButtonDisabled: {
    backgroundColor: '#f5f5f5',
    opacity: 0.5,
  },
  pageInfoContainer: {
    minWidth: 60,
    alignItems: 'center',
  },
  pageInfo: {
    fontSize: 15,
    fontWeight: '700',
    color: '#3498db',
  },
});

