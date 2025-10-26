import React, { useEffect } from 'react';
import { ScrollView, StyleSheet, Text, View, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useSalary } from '../composables/useSalary';
import CustomHeader from '../components/CustomHeader';

export default function PayslipScreen() {
  const {
    salaryData,
    loading,
    error,
    selectedYear,
    selectedMonth,
    refreshSalaryData,
    clearError,
    goToPreviousMonth,
    goToNextMonth,
    goToCurrentMonth,
    formatMoney,
  } = useSalary();

  useEffect(() => {
    if (error) {
      Alert.alert('Lỗi', error, [
        { text: 'Thử lại', onPress: refreshSalaryData },
        { text: 'Hủy', onPress: clearError }
      ]);
    }
  }, [error]);

  const renderSalaryCard = (title, icon, items) => (
    <View style={styles.salaryCard}>
      <View style={styles.cardHeader}>
        <Icon name={icon} size={20} color="#3498db" />
        <Text style={styles.cardTitle}>{title}</Text>
      </View>
      <View style={styles.cardBody}>
        {items.map((item, index) => (
          <View key={index} style={styles.salaryItem}>
            <Text style={styles.salaryLabel}>{item.label}:</Text>
            <Text style={styles.salaryValue}>{item.value}</Text>
          </View>
        ))}
      </View>
    </View>
  );

  const renderFinalSummary = () => {
    if (!salaryData) return null;

    return (
      <View style={styles.finalSummaryCard}>
        <View style={styles.cardHeader}>
          <Icon name="trophy" size={20} color="white" />
          <Text style={styles.cardTitleWhite}>Tổng kết</Text>
        </View>
        <View style={styles.cardBody}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Tổng thu nhập:</Text>
            <Text style={styles.summaryValueIncome}>{formatMoney(salaryData.totalIncome)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Tổng các khoản trừ:</Text>
            <Text style={styles.summaryValueDeduction}>{formatMoney(salaryData.totalDeduction)}</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.finalRow}>
            <Text style={styles.summaryLabel}>Thực lãnh:</Text>
            <Text style={styles.summaryValueNet}>{formatMoney(salaryData.netSalary)}</Text>
          </View>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <CustomHeader title="Phiếu lương" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3498db" />
          <Text style={styles.loadingText}>Đang tải dữ liệu lương...</Text>
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <CustomHeader title="Phiếu lương" />
        <View style={styles.errorContainer}>
          <Icon name="alert-circle" size={48} color="#e74c3c" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={refreshSalaryData}>
            <Text style={styles.retryButtonText}>Thử lại</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (!salaryData) {
    return (
      <View style={styles.container}>
        <CustomHeader title="Phiếu lương" />
        <View style={styles.noDataContainer}>
          <Icon name="file-document-outline" size={64} color="#bdc3c7" />
          <Text style={styles.noDataText}>Không có dữ liệu lương</Text>
          <Text style={styles.noDataSubText}>Không tìm thấy dữ liệu lương cho tháng {selectedMonth}/{selectedYear}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CustomHeader title="Phiếu lương" />
      
      {/* Month Navigation */}
      <View style={styles.monthNavigation}>
        <TouchableOpacity style={styles.navButton} onPress={goToPreviousMonth}>
          <Icon name="chevron-left" size={24} color="white" />
        </TouchableOpacity>
        <Text style={styles.monthText}>
          Tháng {selectedMonth}/{selectedYear}
        </Text>
        <TouchableOpacity style={styles.navButton} onPress={goToNextMonth}>
          <Icon name="chevron-right" size={24} color="white" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.currentButton} onPress={goToCurrentMonth}>
          <Icon name="calendar-today" size={20} color="white" />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Employee Info Header */}
        <View style={styles.employeeHeader}>
          <View style={styles.employeeInfo}>
            <Text style={styles.employeeName}>{salaryData.empName || 'N/A'}</Text>
            <Text style={styles.employeeCode}>Mã NV: {salaryData.empId || 'N/A'}</Text>
            <Text style={styles.employeePosition}>Chức vụ: {salaryData.title || 'N/A'}</Text>
          </View>
          <View style={styles.netSalaryDisplay}>
            <Text style={styles.netSalaryLabel}>Thực lãnh</Text>
            <Text style={styles.netSalaryAmount}>{formatMoney(salaryData.netSalary)}</Text>
          </View>
        </View>

        {/* Basic Salary Information */}
        {renderSalaryCard(
          'Thông tin lương cơ bản',
          'file-invoice-dollar',
          [
            { label: 'Lương hợp đồng', value: formatMoney(salaryData.contractSalary) },
            { label: 'Lương bảo hiểm', value: formatMoney(salaryData.insuranceSalary) },
            { label: 'Tổng lương theo hợp đồng', value: formatMoney(salaryData.totalContractSalary) },
            { label: 'Tổng ngày công chuẩn', value: `${salaryData.standardDays} ngày` },
            { label: 'Tổng ngày công', value: `${salaryData.totalDays} ngày` },
            { label: 'Lương theo ngày công', value: formatMoney(salaryData.salaryByDays) },
          ]
        )}

        {/* Overtime Information */}
        {renderSalaryCard(
          'Thông tin tăng ca',
          'business-time',
          [
            { label: 'Số ngày tăng ca', value: `${salaryData.otDays} ngày` },
            { label: 'Số ngày có hệ số', value: `${salaryData.otDaysWithCoeff} ngày` },
            { label: 'Lương tăng ca', value: formatMoney(salaryData.otSalary) },
            { label: 'Tổng lương thực tế', value: formatMoney(salaryData.actualSalary) },
          ]
        )}

        {/* Leave Information */}
        {renderSalaryCard(
          'Thông tin nghỉ phép',
          'calendar-check',
          [
            { label: 'Tổng nghỉ có lương', value: `${salaryData.paidLeaveDays} ngày` },
            { label: 'Tổng lương phép', value: formatMoney(salaryData.leaveSalary) },
          ]
        )}

        {/* Allowances */}
        {renderSalaryCard(
          'Các khoản phụ cấp',
          'plus-circle',
          [
            { label: 'Phụ cấp ăn ca', value: formatMoney(salaryData.mealAllowance) },
            { label: 'Phụ cấp xăng xe', value: formatMoney(salaryData.fuelAllowance) },
            { label: 'Phụ cấp trách nhiệm', value: formatMoney(salaryData.responsibilityAllowance) },
            { label: 'Tổng các khoản hỗ trợ', value: formatMoney(salaryData.totalSupport) },
          ]
        )}

        {/* Deductions */}
        {renderSalaryCard(
          'Các khoản trừ',
          'minus-circle',
          [
            { label: 'Bảo hiểm NV đóng', value: formatMoney(salaryData.insuranceEmployee) },
            { label: 'Đoàn phí', value: formatMoney(salaryData.unionFee) },
            { label: 'Các khoản trừ khác', value: formatMoney(salaryData.adjustmentDeductions) },
            { label: 'Giảm trừ bản thân', value: formatMoney(salaryData.personalDeduction) },
            { label: 'Số người phụ thuộc', value: `${salaryData.dependents} người` },
            { label: 'Giảm trừ người phụ thuộc', value: formatMoney(salaryData.dependentDeduction) },
            { label: 'Tổng các khoản trừ', value: formatMoney(salaryData.totalDeduction) },
          ]
        )}

        {/* Tax Information */}
        {renderSalaryCard(
          'Thông tin thuế',
          'calculator',
          [
            { label: 'Tổng thu nhập', value: formatMoney(salaryData.totalIncome) },
            { label: 'Tổng thu nhập chịu thuế', value: formatMoney(salaryData.taxableIncome) },
            { label: 'Khen thưởng', value: formatMoney(salaryData.bonus) },
            { label: 'Thu nhập khác', value: formatMoney(salaryData.otherIncome) },
            { label: 'Tổng thu nhập tính thuế PIT', value: formatMoney(salaryData.pitIncome) },
            { label: 'Thuế TNCN', value: formatMoney(salaryData.pitTax) },
          ]
        )}

        {/* Final Summary */}
        {renderFinalSummary()}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f6f8fa',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    marginTop: 10,
    fontSize: 16,
    color: '#e74c3c',
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 20,
    backgroundColor: '#3498db',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  noDataContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  noDataText: {
    marginTop: 10,
    fontSize: 18,
    fontWeight: 'bold',
    color: '#bdc3c7',
  },
  noDataSubText: {
    marginTop: 5,
    fontSize: 14,
    color: '#95a5a6',
    textAlign: 'center',
  },
  monthNavigation: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2c3e50',
    paddingVertical: 15,
    paddingHorizontal: 20,
    marginBottom: 10,
    borderRadius: 12,
    marginHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  navButton: {
    padding: 8,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  currentButton: {
    marginLeft: 10,
    padding: 8,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  monthText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    marginHorizontal: 20,
  },
  scrollContent: {
    padding: 16,
  },
  employeeHeader: {
    backgroundColor: '#2c3e50',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    marginHorizontal: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
  employeeInfo: {
    flex: 1,
  },
  employeeName: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  employeeCode: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 14,
    marginBottom: 2,
  },
  employeePosition: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 14,
  },
  netSalaryDisplay: {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 12,
    padding: 15,
    minWidth: 120,
  },
  netSalaryLabel: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 14,
    marginBottom: 5,
  },
  netSalaryAmount: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  salaryCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    marginBottom: 16,
    marginHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    borderLeftWidth: 4,
    borderLeftColor: '#3498db',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderBottomWidth: 2,
    borderBottomColor: '#dee2e6',
  },
  cardTitle: {
    marginLeft: 8,
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  cardTitleWhite: {
    marginLeft: 8,
    fontSize: 16,
    fontWeight: 'bold',
    color: 'white',
  },
  cardBody: {
    padding: 16,
  },
  salaryItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f3f4',
  },
  salaryLabel: {
    fontSize: 14,
    color: '#495057',
    fontWeight: '500',
    flex: 1,
  },
  salaryValue: {
    fontSize: 14,
    color: '#2c3e50',
    fontWeight: 'bold',
    textAlign: 'right',
  },
  finalSummaryCard: {
    backgroundColor: '#2c3e50',
    borderRadius: 16,
    marginBottom: 16,
    marginHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
    borderLeftWidth: 4,
    borderLeftColor: '#3498db',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.2)',
  },
  summaryLabel: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.9)',
    fontWeight: '500',
  },
  summaryValueIncome: {
    fontSize: 14,
    color: '#90ee90',
    fontWeight: 'bold',
  },
  summaryValueDeduction: {
    fontSize: 14,
    color: '#ffb6c1',
    fontWeight: 'bold',
  },
  summaryValueNet: {
    fontSize: 16,
    color: 'white',
    fontWeight: 'bold',
  },
  summaryDivider: {
    height: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    marginVertical: 8,
    borderRadius: 1,
  },
  finalRow: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    marginHorizontal: -16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 0,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
  },
});
