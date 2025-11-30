import { Image, ScrollView, StyleSheet, Text, View, ActivityIndicator, Alert, Modal, TouchableOpacity, TextInput, Picker } from 'react-native';
import { useState, useEffect } from 'react';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import CustomHeader from '../components/CustomHeader';
import { useAuth } from '../contexts/AuthContext';
import api from '../api';

export default function ProfileScreen() {
  const { user } = useAuth();
  const [employeeData, setEmployeeData] = useState(null);
  const [contractInfo, setContractInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editFormData, setEditFormData] = useState({
    lastName: '',
    firstName: '',
    birthday: '',
    joinDate: '',
    phone: '',
    email: '',
    gender: '',
    roleID: '',
    status: '0'
  });
  const [roles, setRoles] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadProfileData();
    loadRoles();
  }, []);

  const loadProfileData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch employee and contract data
      const [employeesResponse, contractsResponse] = await Promise.all([
        api.get('/ApplicationUser'),
        api.get('/Contract')
      ]);

      const employees = employeesResponse.data;
      const contracts = contractsResponse.data;

      // Find current user in employees list
      const userEmployee = employees.find(emp => 
        emp.id === user?.id || 
        emp.id === String(user?.id) ||
        String(emp.id) === String(user?.id)
      );

      if (!userEmployee) {
        throw new Error('Không tìm thấy thông tin nhân viên');
      }

      // Debug: Log employee data structure
      console.log('=== DEBUG: Loaded Employee Data ===');
      console.log('Full userEmployee:', JSON.stringify(userEmployee, null, 2));
      console.log('userEmployee.gender:', userEmployee.gender);
      console.log('userEmployee.Gender:', userEmployee.Gender);
      console.log('userEmployee.roleID:', userEmployee.roleID);
      console.log('userEmployee.RoleID:', userEmployee.RoleID);
      console.log('userEmployee.roleName:', userEmployee.roleName);
      console.log('All keys:', Object.keys(userEmployee));

      // Find contract for current user
      const contract = contracts.find(c => 
        c.employeeID === user?.id || 
        c.employeeID === String(user?.id) ||
        String(c.employeeID) === String(user?.id)
      );

      setEmployeeData(userEmployee);
      setContractInfo(contract);

    } catch (err) {
      console.error('Error loading profile data:', err);
      setError(err.message || 'Có lỗi xảy ra khi tải dữ liệu');
      Alert.alert('Lỗi', err.message || 'Có lỗi xảy ra khi tải dữ liệu');
    } finally {
      setLoading(false);
    }
  };

  const loadRoles = async () => {
    try {
      console.log('Loading roles...');
      const response = await api.get('/ApplicationUser/roles');
      console.log('Roles response:', response.data);
      setRoles(response.data);
    } catch (err) {
      console.error('Error loading roles:', err);
    }
  };

  const formatDateForInput = (dateValue) => {
    if (!dateValue) return '';
    const date = new Date(dateValue);
    if (isNaN(date.getTime())) return '';
    
    // Fix timezone issue by using local date
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    
    return `${year}-${month}-${day}`;
  };

  const handleEditPress = async () => {
    if (!employeeData) return;
    
    console.log('=== DEBUG: Employee data for edit ===');
    console.log('Full employeeData:', JSON.stringify(employeeData, null, 2));
    console.log('employeeData.gender:', employeeData.gender);
    console.log('employeeData.Gender:', employeeData.Gender);
    console.log('employeeData.roleID:', employeeData.roleID);
    console.log('employeeData.RoleID:', employeeData.RoleID);
    console.log('employeeData.roleName:', employeeData.roleName);
    console.log('All keys:', Object.keys(employeeData));
    
    // Đảm bảo roles đã được load trước khi mở modal
    if (roles.length === 0) {
      await loadRoles();
    }
    console.log('Available roles:', roles);
    
    // Fetch chi tiết employee từ API để lấy đầy đủ thông tin (gender, roleID)
    let detailedEmployeeData = employeeData;
    try {
      console.log('Fetching detailed employee data for:', employeeData.id);
      const detailResponse = await api.get(`/ApplicationUser/employee/${employeeData.id}`);
      if (detailResponse.data) {
        detailedEmployeeData = { ...employeeData, ...detailResponse.data };
        console.log('Detailed employee data:', JSON.stringify(detailedEmployeeData, null, 2));
      }
    } catch (err) {
      console.warn('Could not fetch detailed employee data, using basic data:', err.message);
    }
    
    // Status luôn là 'Active' (không cho chỉnh sửa)
    let statusValue = '0';

    // Extract name from employeeName if firstName/lastName not available
    let firstName = detailedEmployeeData.firstName || detailedEmployeeData.FirstName || '';
    let lastName = detailedEmployeeData.lastName || detailedEmployeeData.LastName || '';
    
    if (!firstName && !lastName && detailedEmployeeData.employeeName) {
      const nameParts = detailedEmployeeData.employeeName.split(' ');
      if (nameParts.length >= 2) {
        lastName = nameParts.slice(0, -1).join(' '); // All parts except last
        firstName = nameParts[nameParts.length - 1]; // Last part
      } else {
        firstName = detailedEmployeeData.employeeName;
      }
    }

    // Map gender - kiểm tra cả camelCase và PascalCase
    let genderValue = detailedEmployeeData.gender || detailedEmployeeData.Gender || '';
    console.log('Raw gender value:', genderValue);
    
    // Map từ các format có thể có
    if (genderValue === 'Male' || genderValue === 'male' || genderValue === 'MALE') {
      genderValue = 'Nam';
    } else if (genderValue === 'Female' || genderValue === 'female' || genderValue === 'FEMALE') {
      genderValue = 'Nữ';
    } else if (genderValue === 'Other' || genderValue === 'other' || genderValue === 'OTHER' || genderValue === 'Khác') {
      genderValue = 'Khác';
    }
    // Nếu đã là "Nam", "Nữ", "Khác" thì giữ nguyên
    console.log('Mapped gender value:', genderValue);
    
    // Map roleID - ưu tiên từ API, nếu không có thì map từ roleName
    let roleIDValue = detailedEmployeeData.roleID || detailedEmployeeData.RoleID || detailedEmployeeData.roleId || detailedEmployeeData.role_id || '';
    console.log('Raw roleID value from API:', roleIDValue);
    
    // Nếu không có roleID từ API, map từ roleName
    if (!roleIDValue && detailedEmployeeData.roleName) {
      const matchedRole = roles.find(role => {
        const roleName = role.roleName || role.RoleName || role.name || '';
        return roleName === detailedEmployeeData.roleName || 
               roleName.trim() === detailedEmployeeData.roleName.trim();
      });
      
      if (matchedRole) {
        roleIDValue = String(matchedRole.id || matchedRole.ID || '');
        console.log('Mapped roleID from roleName:', detailedEmployeeData.roleName, '->', roleIDValue);
      } else {
        console.warn('Could not find roleID for roleName:', detailedEmployeeData.roleName);
      }
    }
    
    // Convert to string để so sánh dễ dàng hơn
    if (roleIDValue) {
      roleIDValue = String(roleIDValue);
    }
    console.log('Final roleID value:', roleIDValue);

    const formData = {
      lastName: lastName,
      firstName: firstName,
      birthday: formatDateForInput(detailedEmployeeData.birthday || detailedEmployeeData.Birthday),
      joinDate: formatDateForInput(detailedEmployeeData.joinDate || detailedEmployeeData.JoinDate),
      phone: detailedEmployeeData.phone || detailedEmployeeData.Phone || '',
      email: detailedEmployeeData.email || detailedEmployeeData.Email || '',
      gender: genderValue,
      roleID: roleIDValue,
      status: statusValue
    };
    
    console.log('=== Final form data ===');
    console.log('Form data:', JSON.stringify(formData, null, 2));
    console.log('Gender in form:', formData.gender);
    console.log('RoleID in form:', formData.roleID);
    
    setEditFormData(formData);
    setShowEditModal(true);
  };

  const handleSaveEdit = async () => {
    try {
      setSaving(true);

      // Validate required fields
      if (!editFormData.firstName || !editFormData.lastName || !editFormData.email || !editFormData.phone) {
        Alert.alert('Lỗi', 'Vui lòng điền đầy đủ thông tin bắt buộc');
        return;
      }

      if (!editFormData.gender) {
        Alert.alert('Lỗi', 'Vui lòng chọn giới tính');
        return;
      }

      if (!editFormData.roleID) {
        Alert.alert('Lỗi', 'Vui lòng chọn chức danh');
        return;
      }

      // Status luôn là 'Active' (không cho chỉnh sửa)
      const statusString = 'Active';

      const updateData = {
        Id: employeeData.id,
        FirstName: editFormData.firstName,
        LastName: editFormData.lastName,
        Birthday: new Date(editFormData.birthday),
        JoinDate: new Date(editFormData.joinDate),
        Phone: editFormData.phone,
        Email: editFormData.email,
        Gender: editFormData.gender,
        RoleID: parseInt(editFormData.roleID),
        Status: statusString
      };

      console.log('Sending update data:', updateData);
      await api.put('/ApplicationUser/employee', updateData);
      
      Alert.alert('Thành công', 'Cập nhật thông tin thành công');
      setShowEditModal(false);
      loadProfileData(); // Reload data
      
    } catch (err) {
      console.error('Error updating profile:', err);
      Alert.alert('Lỗi', err.message || 'Có lỗi xảy ra khi cập nhật thông tin');
    } finally {
      setSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setShowEditModal(false);
  };

  const getEmployeeFullName = (employee) => {
    if (!employee) return 'N/A';
    if (employee.employeeName) return employee.employeeName;
    if (employee.firstName && employee.lastName) {
      return `${employee.firstName} ${employee.lastName}`;
    }
    if (employee.fullName) return employee.fullName;
    if (employee.name) return employee.name;
    if (employee.firstName) return employee.firstName;
    if (employee.lastName) return employee.lastName;
    return 'N/A';
  };

  const getRoleDisplayName = (role) => {
    const roleMap = {
      'worker': 'Công nhân',
      'technician': 'Nhân viên kỹ thuật',
      'supervisor': 'Chỉ huy công trình',
      'hr_employee': 'Nhân viên Hành chính Nhân sự',
      'hr_manager': 'Trưởng phòng Hành chính Nhân sự',
      'director': 'Giám đốc'
    };
    return roleMap[role] || role || 'N/A';
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('vi-VN');
    } catch (error) {
      return dateString;
    }
  };

  const formatMoney = (amount) => {
    if (!amount) return 'N/A';
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND'
    }).format(amount);
  };

  const getEmployeeStatus = (employee) => {
    if (!employee) return false;
    return employee.status === 'Active' || employee.isActive === true;
  };

  const getEmployeeStatusText = (employee) => {
    if (!employee) return 'N/A';
    const status = employee.status || (employee.isActive ? 'Active' : 'Inactive');
    
    switch (status) {
      case 'Active':
        return 'Hoạt động';
      case 'Resigned':
        return 'Nghỉ việc';
      case 'MaternityLeave':
        return 'Nghỉ thai sản';
      default:
        return 'Không hoạt động';
    }
  };

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#f5f5f5' }}>
        <CustomHeader title="Hồ sơ cá nhân" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3498db" />
          <Text style={styles.loadingText}>Đang tải dữ liệu...</Text>
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={{ flex: 1, backgroundColor: '#f5f5f5' }}>
        <CustomHeader title="Hồ sơ cá nhân" />
        <View style={styles.errorContainer}>
          <Icon name="alert-circle" size={48} color="#e74c3c" />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#f5f5f5' }}>
      <CustomHeader title="Hồ sơ cá nhân" />
      <ScrollView contentContainerStyle={styles.container}>
        {/* Profile Card */}
        <View style={styles.profileCard}>
          <TouchableOpacity style={styles.editButton} onPress={handleEditPress}>
            <Icon name="pencil" size={20} color="#3498db" />
          </TouchableOpacity>
        <View style={styles.avatarWrap}>
            <View style={styles.avatarCircle}>
              <Icon name="account" size={40} color="white" />
            </View>
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.name}>{getEmployeeFullName(employeeData)}</Text>
            <Text style={styles.position}>{getRoleDisplayName(employeeData?.roleName)}</Text>
          </View>
        </View>

        {/* Quick Stats */}
        <View style={styles.quickStats}>
          <View style={styles.statItem}>
            <View style={styles.statIcon}>
              <Icon name="calendar" size={20} color="white" />
            </View>
            <View style={styles.statContent}>
              <Text style={styles.statLabel}>Ngày vào làm</Text>
              <Text style={styles.statValue}>{formatDate(employeeData?.joinDate)}</Text>
            </View>
          </View>
          
          <View style={styles.statItem}>
            <View style={styles.statIcon}>
              <Icon name="office-building" size={20} color="white" />
            </View>
            <View style={styles.statContent}>
              <Text style={styles.statLabel}>Phòng ban</Text>
              <Text style={styles.statValue}>{getRoleDisplayName(employeeData?.roleName)}</Text>
            </View>
          </View>

          {contractInfo && (
            <View style={styles.statItem}>
              <View style={styles.statIcon}>
                <Icon name="file-document" size={20} color="white" />
              </View>
              <View style={styles.statContent}>
                <Text style={styles.statLabel}>Hợp đồng</Text>
                <Text style={styles.statValue}>{contractInfo.contractNumber || 'N/A'}</Text>
              </View>
            </View>
          )}
        </View>

        {/* Basic Information */}
        <View style={styles.infoBox}>
          <View style={styles.cardHeader}>
            <Icon name="information" size={20} color="#3498db" />
            <Text style={styles.cardTitle}>Thông tin cơ bản</Text>
          </View>
          
          <View style={styles.infoRow}>
            <Icon name="card-account-details" size={20} color="#3498db" style={styles.infoIcon} />
            <Text style={styles.infoLabel}>Mã nhân viên:</Text>
            <Text style={styles.infoValue}>{employeeData?.id || 'N/A'}</Text>
          </View>
          
          <View style={styles.infoRow}>
            <Icon name="email" size={20} color="#3498db" style={styles.infoIcon} />
            <Text style={styles.infoLabel}>Email:</Text>
            <Text style={styles.infoValue}>{employeeData?.email || 'N/A'}</Text>
          </View>
          
          <View style={styles.infoRow}>
            <Icon name="phone" size={20} color="#3498db" style={styles.infoIcon} />
            <Text style={styles.infoLabel}>Số điện thoại:</Text>
            <Text style={styles.infoValue}>{employeeData?.phone || 'N/A'}</Text>
          </View>
          
          <View style={styles.infoRow}>
            <Icon name="briefcase" size={20} color="#3498db" style={styles.infoIcon} />
            <Text style={styles.infoLabel}>Chức vụ:</Text>
            <Text style={styles.infoValue}>{getRoleDisplayName(employeeData?.roleName)}</Text>
          </View>
          
          <View style={styles.infoRow}>
            <Icon name="cake" size={20} color="#3498db" style={styles.infoIcon} />
            <Text style={styles.infoLabel}>Ngày sinh:</Text>
            <Text style={styles.infoValue}>{formatDate(employeeData?.birthday)}</Text>
          </View>
        </View>

        {/* Contract Information */}
        {contractInfo && (
          <View style={styles.infoBox}>
            <View style={styles.cardHeader}>
              <Icon name="file-document" size={20} color="#3498db" />
              <Text style={styles.cardTitle}>Thông tin hợp đồng</Text>
            </View>
            
            <View style={styles.infoRow}>
              <Icon name="hash" size={20} color="#3498db" style={styles.infoIcon} />
              <Text style={styles.infoLabel}>Số hợp đồng:</Text>
              <Text style={styles.infoValue}>{contractInfo.contractNumber || 'N/A'}</Text>
            </View>
            
            <View style={styles.infoRow}>
              <Icon name="file-document-outline" size={20} color="#3498db" style={styles.infoIcon} />
              <Text style={styles.infoLabel}>Loại hợp đồng:</Text>
              <Text style={styles.infoValue}>{contractInfo.contractTypeName || 'N/A'}</Text>
            </View>
            
            <View style={styles.infoRow}>
              <Icon name="calendar-check" size={20} color="#3498db" style={styles.infoIcon} />
              <Text style={styles.infoLabel}>Ngày bắt đầu:</Text>
              <Text style={styles.infoValue}>{formatDate(contractInfo.startDate)}</Text>
            </View>
            
            <View style={styles.infoRow}>
              <Icon name="calendar-remove" size={20} color="#3498db" style={styles.infoIcon} />
              <Text style={styles.infoLabel}>Ngày hết hạn:</Text>
              <Text style={styles.infoValue}>{formatDate(contractInfo.endDate)}</Text>
            </View>
            
            <View style={styles.infoRow}>
              <Icon name="currency-usd" size={20} color="#3498db" style={styles.infoIcon} />
              <Text style={styles.infoLabel}>Lương hợp đồng:</Text>
              <Text style={[styles.infoValue, styles.moneyValue]}>{formatMoney(contractInfo.contractSalary)}</Text>
            </View>
            
          <View style={styles.infoRow}>
              <Icon name="shield-check" size={20} color="#3498db" style={styles.infoIcon} />
              <Text style={styles.infoLabel}>Lương bảo hiểm:</Text>
              <Text style={[styles.infoValue, styles.moneyValue]}>{formatMoney(contractInfo.insuranceSalary)}</Text>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Edit Modal */}
      <Modal
        visible={showEditModal}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Chỉnh sửa thông tin</Text>
            <TouchableOpacity onPress={handleCancelEdit}>
              <Icon name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            {/* Basic Information */}
            <View style={styles.formGroup}>
              <Text style={styles.groupTitle}>
                <Icon name="card-account-details" size={16} color="#3498db" />
                <Text style={styles.groupTitleText}> Thông tin cơ bản</Text>
              </Text>
              
              <View style={styles.inputRow}>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Họ và tên đệm *</Text>
                  <TextInput
                    style={styles.textInput}
                    value={editFormData.lastName}
                    onChangeText={(text) => setEditFormData({...editFormData, lastName: text})}
                    placeholder="Nhập họ và tên đệm"
                  />
                </View>
                
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Tên nhân viên *</Text>
                  <TextInput
                    style={styles.textInput}
                    value={editFormData.firstName}
                    onChangeText={(text) => setEditFormData({...editFormData, firstName: text})}
                    placeholder="Nhập tên nhân viên"
                  />
                </View>
              </View>
            </View>

            {/* Personal Information */}
            <View style={styles.formGroup}>
              <Text style={styles.groupTitle}>
                <Icon name="account" size={16} color="#3498db" />
                <Text style={styles.groupTitleText}> Thông tin cá nhân</Text>
              </Text>
              
              <View style={styles.inputRow}>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Ngày sinh *</Text>
                  <TextInput
                    style={styles.textInput}
                    value={editFormData.birthday}
                    onChangeText={(text) => setEditFormData({...editFormData, birthday: text})}
                    placeholder="YYYY-MM-DD"
                  />
                </View>
                
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Ngày vào làm *</Text>
                  <TextInput
                    style={styles.textInput}
                    value={editFormData.joinDate}
                    onChangeText={(text) => setEditFormData({...editFormData, joinDate: text})}
                    placeholder="YYYY-MM-DD"
                  />
                </View>
              </View>

              <View style={styles.inputRow}>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Giới tính *</Text>
                  <View style={styles.dropdownContainer}>
                    <TouchableOpacity
                      style={styles.dropdownButton}
                      onPress={() => {
                        Alert.alert(
                          'Chọn giới tính',
                          '',
                          [
                            { text: 'Nam', onPress: () => setEditFormData({...editFormData, gender: 'Nam'}) },
                            { text: 'Nữ', onPress: () => setEditFormData({...editFormData, gender: 'Nữ'}) },
                            { text: 'Khác', onPress: () => setEditFormData({...editFormData, gender: 'Khác'}) },
                            { text: 'Hủy', style: 'cancel' }
                          ]
                        );
                      }}
                    >
                      <Text style={styles.dropdownText}>
                        {(() => {
                          const currentGender = editFormData.gender;
                          console.log('=== DEBUG Gender Dropdown ===');
                          console.log('Current gender in form:', currentGender);
                          console.log('Type:', typeof currentGender);
                          
                          if (!currentGender || currentGender === '' || currentGender === null || currentGender === undefined) {
                            return 'Chọn giới tính';
                          }
                          
                          // Map lại nếu cần (xử lý cả lowercase và uppercase)
                          let displayGender = String(currentGender).trim();
                          const lowerGender = displayGender.toLowerCase();
                          
                          if (lowerGender === 'male' || displayGender === 'Male' || displayGender === 'MALE') {
                            displayGender = 'Nam';
                          } else if (lowerGender === 'female' || displayGender === 'Female' || displayGender === 'FEMALE') {
                            displayGender = 'Nữ';
                          } else if (lowerGender === 'other' || displayGender === 'Other' || displayGender === 'OTHER') {
                            displayGender = 'Khác';
                          }
                          // Nếu đã là "Nam", "Nữ", "Khác" thì giữ nguyên
                          
                          console.log('Display gender:', displayGender);
                          return displayGender;
                        })()}
                      </Text>
                      <Icon name="chevron-down" size={20} color="#666" />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </View>

            {/* Contact Information */}
            <View style={styles.formGroup}>
              <Text style={styles.groupTitle}>
                <Icon name="phone" size={16} color="#3498db" />
                <Text style={styles.groupTitleText}> Thông tin liên hệ</Text>
              </Text>
              
              <View style={styles.inputRow}>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Email *</Text>
                  <TextInput
                    style={styles.textInput}
                    value={editFormData.email}
                    onChangeText={(text) => setEditFormData({...editFormData, email: text})}
                    placeholder="Nhập email"
                    keyboardType="email-address"
                  />
                </View>
                
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Số điện thoại *</Text>
                  <TextInput
                    style={styles.textInput}
                    value={editFormData.phone}
                    onChangeText={(text) => setEditFormData({...editFormData, phone: text})}
                    placeholder="Nhập số điện thoại"
                    keyboardType="phone-pad"
                  />
                </View>
              </View>
            </View>

            {/* Work Information */}
            <View style={styles.formGroup}>
              <Text style={styles.groupTitle}>
                <Icon name="briefcase" size={16} color="#3498db" />
                <Text style={styles.groupTitleText}> Thông tin công việc</Text>
              </Text>
              
              <View style={styles.inputRow}>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Chức danh *</Text>
                  <View style={styles.dropdownContainer}>
                    <TouchableOpacity
                      style={styles.dropdownButton}
                      onPress={() => {
                        if (roles && roles.length > 0) {
                          const roleOptions = roles.map(role => ({
                            text: role.roleName || role.RoleName || role.name,
                            onPress: () => setEditFormData({...editFormData, roleID: role.id || role.ID})
                          }));
                          roleOptions.push({ text: 'Hủy', style: 'cancel' });
                          
                          Alert.alert(
                            'Chọn chức danh',
                            '',
                            roleOptions
                          );
                        } else {
                          Alert.alert('Thông báo', 'Không có chức danh nào');
                        }
                      }}
                    >
                      <Text style={styles.dropdownText}>
                        {(() => {
                          const currentRoleID = editFormData.roleID;
                          console.log('=== DEBUG Role Dropdown ===');
                          console.log('Current roleID in form:', currentRoleID, 'Type:', typeof currentRoleID);
                          console.log('Available roles:', JSON.stringify(roles, null, 2));
                          
                          if (!currentRoleID || currentRoleID === '' || currentRoleID === null || currentRoleID === undefined) {
                            console.log('No roleID found, showing placeholder');
                            return 'Chọn chức danh';
                          }
                          
                          // Convert roleID to string for comparison
                          const roleIDStr = String(currentRoleID).trim();
                          console.log('Looking for roleID:', roleIDStr);
                          
                          // Try multiple comparison methods
                          let selectedRole = roles?.find(role => {
                            const roleId = String(role.id || role.ID || role.roleId || role.role_id || '').trim();
                            const roleIdNum = Number(role.id || role.ID || 0);
                            const formRoleIdNum = Number(currentRoleID);
                            
                            console.log(`Comparing: roleId="${roleId}", roleIDStr="${roleIDStr}", roleIdNum=${roleIdNum}, formRoleIdNum=${formRoleIdNum}`);
                            
                            return roleId === roleIDStr || 
                                   role.id == currentRoleID || 
                                   role.ID == currentRoleID ||
                                   roleIdNum === formRoleIdNum ||
                                   String(role.id) === String(currentRoleID) ||
                                   String(role.ID) === String(currentRoleID);
                          });
                          
                          console.log('Found selected role:', selectedRole);
                          
                          if (selectedRole) {
                            const roleName = selectedRole.roleName || selectedRole.RoleName || selectedRole.name || 'Unknown Role';
                            console.log('Display role name:', roleName);
                            return roleName;
                          }
                          
                          console.log('No matching role found, showing placeholder');
                          return 'Chọn chức danh';
                        })()}
                      </Text>
                      <Icon name="chevron-down" size={20} color="#666" />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </View>
          </ScrollView>

          <View style={styles.modalFooter}>
            <TouchableOpacity style={styles.cancelButton} onPress={handleCancelEdit}>
              <Text style={styles.cancelButtonText}>Hủy</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.saveButton, saving && styles.saveButtonDisabled]} 
              onPress={handleSaveEdit}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <Text style={styles.saveButtonText}>Lưu</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    backgroundColor: '#f5f5f5',
    flexGrow: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
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
    marginTop: 16,
    fontSize: 16,
    color: '#e74c3c',
    textAlign: 'center',
  },
  profileCard: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 24,
    marginBottom: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
    borderLeftWidth: 4,
    borderLeftColor: '#3498db',
  },
  avatarWrap: {
    alignItems: 'center',
    marginBottom: 16,
    position: 'relative',
  },
  avatarCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#3498db',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#3498db',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  profileInfo: {
    alignItems: 'center',
  },
  name: {
    fontSize: 24,
    fontWeight: '700',
    color: '#2c3e50',
    marginBottom: 8,
    textAlign: 'center',
  },
  position: {
    fontSize: 16,
    fontWeight: '600',
    color: '#3498db',
    marginBottom: 12,
    textAlign: 'center',
  },
  quickStats: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  statIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#3498db',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  statContent: {
    flex: 1,
  },
  statLabel: {
    fontSize: 14,
    color: '#6c757d',
    marginBottom: 4,
    fontWeight: '500',
  },
  statValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#2c3e50',
  },
  infoBox: {
    backgroundColor: 'white',
    borderRadius: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
    borderLeftWidth: 4,
    borderLeftColor: '#3498db',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderBottomWidth: 2,
    borderBottomColor: '#dee2e6',
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#2c3e50',
    marginLeft: 8,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  infoIcon: {
    marginRight: 12,
  },
  infoLabel: {
    fontWeight: '600',
    color: '#495057',
    minWidth: 120,
    fontSize: 15,
  },
  infoValue: {
    color: '#2c3e50',
    fontSize: 15,
    fontWeight: '500',
    flex: 1,
  },
  moneyValue: {
    color: '#28a745',
    fontWeight: '700',
    fontSize: 16,
  },
  editButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(52, 152, 219, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#2c3e50',
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },
  formGroup: {
    backgroundColor: 'white',
    borderRadius: 12,
    marginBottom: 16,
    overflow: 'hidden',
  },
  groupTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  groupTitleText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#495057',
    marginLeft: 8,
  },
  inputRow: {
    padding: 16,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#495057',
    marginBottom: 8,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#ced4da',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: 'white',
  },
  pickerContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  pickerOption: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#ced4da',
    backgroundColor: 'white',
  },
  pickerOptionSelected: {
    backgroundColor: '#3498db',
    borderColor: '#3498db',
  },
  pickerText: {
    fontSize: 14,
    color: '#495057',
  },
  pickerTextSelected: {
    color: 'white',
    fontWeight: '600',
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#6c757d',
    marginRight: 8,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6c757d',
  },
  saveButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#3498db',
    marginLeft: 8,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    backgroundColor: '#bdc3c7',
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
  noRolesText: {
    fontSize: 14,
    color: '#6c757d',
    fontStyle: 'italic',
    padding: 8,
  },
  dropdownContainer: {
    marginBottom: 8,
  },
  dropdownButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ced4da',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: 'white',
  },
  dropdownText: {
    fontSize: 16,
    color: '#495057',
    flex: 1,
  },
});
