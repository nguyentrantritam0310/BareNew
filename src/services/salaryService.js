import api from '../api'
import AsyncStorage from '@react-native-async-storage/async-storage'

export const salaryService = {
  // Calculate personal salary data dynamically from multiple data sources
  async getPersonalSalaryData(year, month, userId = null) {
    try {
      // Get current user from AsyncStorage or use provided userId
      let currentUser = null;
      
      if (userId) {
        // Use provided userId
        currentUser = { id: userId };
      } else {
        // Try to get from AsyncStorage
        const userString = await AsyncStorage.getItem('user');
        if (userString) {
          currentUser = JSON.parse(userString);
        } else {
          // Try to get from token
          const token = await AsyncStorage.getItem('token');
          if (token) {
            // Decode token to get user info (basic implementation)
            try {
              const payload = JSON.parse(atob(token.split('.')[1]));
              currentUser = { id: payload.nameid || payload.sub || payload.userId };
            } catch (e) {
              console.error('Error decoding token:', e);
            }
          }
        }
      }
      
      console.log('Current user for salary:', currentUser);
      
      if (!currentUser || !currentUser.id) {
        throw new Error('Chưa đăng nhập')
      }

      // Get all required data sources
      const [
        employeesResponse,
        contractsResponse,
        attendanceResponse,
        shiftAssignmentsResponse,
        familyRelationsResponse,
        leaveRequestsResponse,
        overtimeRequestsResponse,
        payrollAdjustmentsResponse
      ] = await Promise.all([
        api.get('/ApplicationUser'),
        api.get('/Contract'),
        api.get('/AttendanceData'),
        api.get('/ShiftAssignment'),
        api.get('/FamilyRelation'),
        api.get('/EmployeeRequest/leave'),
        api.get('/EmployeeRequest/overtime'),
        api.get('/PayrollAdjustment')
      ])

      const employees = employeesResponse.data
      const contracts = contractsResponse.data
      const attendanceList = attendanceResponse.data
      const shiftAssignments = shiftAssignmentsResponse.data
      const familyRelations = familyRelationsResponse.data
      const leaveRequests = leaveRequestsResponse.data
      const overtimeRequests = overtimeRequestsResponse.data
      const payrollAdjustments = payrollAdjustmentsResponse.data

      // Find current user in employees list
      console.log('Employees list:', employees)
      console.log('Looking for user ID:', currentUser.id)
      
      const userEmployee = employees.find(emp => 
        emp.id === currentUser.id || 
        emp.id === String(currentUser.id) ||
        String(emp.id) === String(currentUser.id)
      )
      
      console.log('Found user employee:', userEmployee)
      
      if (!userEmployee) {
        throw new Error(`Không tìm thấy thông tin nhân viên với ID: ${currentUser.id}`)
      }

      // Helper function to check if approveStatus indicates approved
      const isApproved = (approveStatus) => {
        if (!approveStatus) return false
        // Check for string values
        if (typeof approveStatus === 'string') {
          return approveStatus === 'Đã duyệt' || approveStatus === 'Approved'
        }
        // Check for number values (ApproveStatusEnum.Approved = 2)
        if (typeof approveStatus === 'number') {
          return approveStatus === 2
        }
        return false
      }

      // Helper function to check if contract is indeterminate term
      const isIndeterminateTermContract = (endDate) => {
        if (!endDate || endDate === null || endDate === undefined || endDate === '') {
          return true
        }
        
        if (typeof endDate === 'string' && (
          endDate.includes('0001-01-01') || 
          endDate.startsWith('0001-')
        )) {
          return true
        }
        
        try {
          const date = new Date(endDate)
          if (isNaN(date.getTime()) || date.getFullYear() <= 1 || date.getFullYear() < 1900) {
            return true
          }
        } catch (error) {
          return true
        }
        
        return false
      }

      // Helper function to get all contracts active in a month for an employee
      const getContractsInMonth = (employeeId, year, month) => {
        const monthStartDate = new Date(year, month - 1, 1)
        monthStartDate.setHours(0, 0, 0, 0)
        const monthEndDate = new Date(year, month, 0)
        monthEndDate.setHours(23, 59, 59, 999)

        console.log('🔍 getContractsInMonth - Debug:', {
          employeeId,
          employeeIdType: typeof employeeId,
          year,
          month,
          contractsCount: contracts.length,
          contracts: contracts.map(c => ({
            id: c.id,
            employeeID: c.employeeID,
            employeeIDType: typeof c.employeeID,
            approveStatus: c.approveStatus,
            approveStatusType: typeof c.approveStatus,
            startDate: c.startDate,
            endDate: c.endDate,
            isIndeterminate: isIndeterminateTermContract(c.endDate)
          }))
        })

        return contracts
          .filter(contract => {
            // So sánh employeeID bằng string để đảm bảo khớp
            const contractEmployeeId = String(contract.employeeID || '')
            const empId = String(employeeId || '')
            
            console.log('  📋 Checking contract:', {
              contractId: contract.id,
              contractEmployeeId,
              empId,
              match: contractEmployeeId === empId,
              approveStatus: contract.approveStatus,
              isApproved: isApproved(contract.approveStatus)
            })
            
            if (contractEmployeeId !== empId) {
              console.log('    ❌ Employee ID mismatch')
              return false
            }
            
            if (!isApproved(contract.approveStatus)) {
              console.log('    ❌ Not approved:', contract.approveStatus)
              return false
            }

            const contractStartDate = new Date(contract.startDate)
            contractStartDate.setHours(0, 0, 0, 0)

            // Contract must start before or on the last day of the month
            if (contractStartDate > monthEndDate) {
              console.log('    ❌ Contract starts after month end')
              return false
            }

            // Contract must end after or on the first day of the month (or be indeterminate)
            // Kiểm tra xem có phải hợp đồng không xác định thời hạn không
            if (!isIndeterminateTermContract(contract.endDate)) {
              const contractEndDate = new Date(contract.endDate)
              contractEndDate.setHours(23, 59, 59, 999)
              if (contractEndDate < monthStartDate) {
                console.log('    ❌ Contract ends before month start')
                return false
              }
            }
            // If indeterminate term contract (no endDate or "0001-01-01"), it's always active

            console.log('    ✅ Contract matches!')
            return true
          })
          .sort((a, b) => {
            // Sort by startDate
            const dateA = new Date(a.startDate)
            const dateB = new Date(b.startDate)
            return dateA - dateB
          })
      }

      // Get approved contracts active in the selected month
      const contractsInMonth = getContractsInMonth(currentUser.id, year, month)
      
      console.log('📊 Found contracts in month:', contractsInMonth.length)
      
      if (contractsInMonth.length === 0) {
        console.error('❌ No approved contracts found for employee', currentUser.id, 'in month', month, '/', year)
        console.error('Available contracts:', contracts.map(c => ({
          id: c.id,
          employeeID: c.employeeID,
          approveStatus: c.approveStatus,
          startDate: c.startDate,
          endDate: c.endDate
        })))
        throw new Error(`Không tìm thấy hợp đồng đã duyệt cho nhân viên trong tháng ${month}/${year}`)
      }

      // Use the first contract (or aggregate if multiple contracts)
      // For now, use the first contract (similar to web version's first contract)
      const contract = contractsInMonth[0]
      
      // Calculate contract period in month (giống logic trong payslip.js)
      const contractPeriodStart = new Date(year, month - 1, 1)
      contractPeriodStart.setHours(0, 0, 0, 0)
      const contractPeriodEnd = new Date(year, month, 0)
      contractPeriodEnd.setHours(23, 59, 59, 999)
      
      const contractStartDate = new Date(contract.startDate)
      contractStartDate.setHours(0, 0, 0, 0)
      
      let contractEndDate
      if (!isIndeterminateTermContract(contract.endDate)) {
        contractEndDate = new Date(contract.endDate)
        contractEndDate.setHours(23, 59, 59, 999)
      } else {
        contractEndDate = contractPeriodEnd
      }
      
      const periodStart = contractStartDate > contractPeriodStart ? contractStartDate : contractPeriodStart
      const periodEnd = contractEndDate < contractPeriodEnd ? contractEndDate : contractPeriodEnd
      
      // Find attendance data for current user in selected month/year
      const attendanceData = attendanceList.filter(att => 
        att.employeeID === currentUser.id && 
        new Date(att.date).getMonth() + 1 === month &&
        new Date(att.date).getFullYear() === year
      )

      // Calculate standard days from shift assignments
      const assignedDays = shiftAssignments.filter(assignment => {
        const assignmentDate = new Date(assignment.workDate)
        return assignment.employeeID === currentUser.id && 
               assignmentDate.getMonth() + 1 === month &&
               assignmentDate.getFullYear() === year
      }).length
      
      const standardDays = assignedDays || 22 // Default to 22 days if no assignments

      // Calculate total work days from attendance
      const validAttendanceDays = attendanceData.filter(att => {
        const hasValidCheckIn = att.scanTime && att.type === 'ĐiLam'
        const hasValidCheckOut = att.scanTime && (att.type === 'Về' || att.type === 'Về sớm')
        return hasValidCheckIn || hasValidCheckOut
      })
      
      const uniqueWorkDays = new Set()
      validAttendanceDays.forEach(att => {
        const workDate = new Date(att.date).toISOString().split('T')[0]
        uniqueWorkDays.add(workDate)
      })
      
      const totalDays = uniqueWorkDays.size

      // Calculate paid leave days - CHỈ tính trong khoảng thời gian hợp đồng
      const approvedLeaveRequests = leaveRequests.filter(leave => {
        if (!leave || !leave.startDateTime) return false
        const leaveStartDate = new Date(leave.startDateTime)
        const leaveEndDate = new Date(leave.endDateTime)
        return String(leave.employeeID) === String(currentUser.id) &&
               leaveStartDate <= periodEnd && leaveEndDate >= periodStart &&
               (leave.approveStatus === 'Đã duyệt' || leave.approveStatus === 'Approved' || leave.approveStatus === 2) &&
               leave.leaveTypeName && leave.leaveTypeName.toLowerCase().includes('phép')
      })
      
      let totalPaidLeaveDays = 0
      approvedLeaveRequests.forEach(leave => {
        const startDate = new Date(leave.startDateTime)
        const endDate = new Date(leave.endDateTime)
        
        // Chỉ tính phần thời gian nằm trong khoảng thời gian hợp đồng
        const actualStart = startDate > periodStart ? startDate : periodStart
        const actualEnd = endDate < periodEnd ? endDate : periodEnd
        
        if (actualStart > actualEnd) {
          // Không có phần nào nằm trong period, bỏ qua
          return
        }
        
        // Tính số ngày nghỉ phép: đếm số ngày, không tính từ giờ
        // Chỉ tính phần trong period
        const periodStartDay = new Date(actualStart.getFullYear(), actualStart.getMonth(), actualStart.getDate())
        const periodEndDay = new Date(actualEnd.getFullYear(), actualEnd.getMonth(), actualEnd.getDate())
        
        // Đếm số ngày nghỉ (chỉ trong period)
        const daysDiff = Math.ceil((periodEndDay - periodStartDay) / (1000 * 60 * 60 * 24)) + 1
        totalPaidLeaveDays += daysDiff
      })

      // Calculate overtime - CHỈ tính trong khoảng thời gian hợp đồng
      const approvedOvertimeForMonth = overtimeRequests.filter(ot => {
        if (!ot || !ot.startDateTime) return false
        const start = new Date(ot.startDateTime)
        const end = new Date(ot.endDateTime)
        const isApproved = ot.approveStatus === 'Đã duyệt' || ot.approveStatus === 'Approved' || ot.approveStatus === 2
        const employeeMatch = ot.employeeID === currentUser.id
        // Kiểm tra xem đơn tăng ca có nằm trong khoảng thời gian của hợp đồng không
        return start <= periodEnd && end >= periodStart && isApproved && employeeMatch
      })

      let totalOvertimeHours = 0
      let totalOvertimeDayUnits = 0
      let totalOvertimeDaysWithCoeff = 0
      
      approvedOvertimeForMonth.forEach(ot => {
        const start = new Date(ot.startDateTime)
        const end = new Date(ot.endDateTime)
        
        // Chỉ tính phần thời gian nằm trong khoảng thời gian hợp đồng
        const actualStart = start > periodStart ? start : periodStart
        const actualEnd = end < periodEnd ? end : periodEnd
        
        if (actualStart > actualEnd) {
          // Không có phần nào nằm trong period, bỏ qua
          return
        }
        
        // Tính số giờ tăng ca (chỉ tính phần trong period)
        const hours = Math.max(0, (actualEnd - actualStart) / (1000 * 60 * 60))
        const dayUnits = hours / 8
        const coeff = Number(ot.coefficient) || 1
        
        totalOvertimeHours += hours
        totalOvertimeDayUnits += dayUnits
        totalOvertimeDaysWithCoeff += dayUnits * coeff
      })

      const otDays = Math.round(totalOvertimeDayUnits * 100) / 100
      const otDaysWithCoeff = Math.round(totalOvertimeDaysWithCoeff * 100) / 100

      // Calculate salary components
      const contractSalary = contract?.contractSalary || 0
      const insuranceSalary = contract?.insuranceSalary || 0
      const salaryByDays = standardDays > 0 ? contractSalary * (totalDays / standardDays) : 0
      const leaveSalary = standardDays > 0 ? contractSalary * (totalPaidLeaveDays / standardDays) : 0
      const actualSalary = salaryByDays + leaveSalary
      const otSalary = standardDays > 0 ? (contractSalary * totalOvertimeDaysWithCoeff / standardDays) : 0

      // Calculate allowances from contract
      const mealAllowance = contract?.allowances?.find(a => 
        a.allowanceName?.toLowerCase().includes('ăn') || 
        a.allowanceName?.toLowerCase().includes('meal')
      )?.value || 0
      
      const fuelAllowance = contract?.allowances?.find(a => 
        a.allowanceName?.toLowerCase().includes('xăng') || 
        a.allowanceName?.toLowerCase().includes('xe')
      )?.value || 0
      
      const responsibilityAllowance = contract?.allowances?.find(a => 
        a.allowanceName?.toLowerCase().includes('trách nhiệm')
      )?.value || 0

      // Calculate insurance and deductions
      const insuranceEmployee = insuranceSalary * 0.105 // 10.5%
      const unionFee = insuranceSalary * 0.01 // 1%

      // Calculate dependents from family relations
      const monthStartDate = new Date(year, month - 1, 1)
      const monthEndDate = new Date(year, month, 0)
      
      const dependents = familyRelations.filter(relation => {
        const isEmployeeRelation = relation.employeeID === currentUser.id
        const startDate = new Date(relation.startDate)
        const endDate = new Date(relation.endDate)
        const isActiveInMonth = (startDate <= monthEndDate) && (endDate >= monthStartDate)
        const isDependentRelation = ['Con', 'Vợ', 'Chồng', 'Cha', 'Mẹ'].includes(relation.relationShipName)
        
        return isEmployeeRelation && isActiveInMonth && isDependentRelation
      }).length

      // Calculate adjustment deductions
      const approvedAdjustments = payrollAdjustments.filter(adj => {
        if (!adj || !adj.decisionDate) return false
        const adjDate = new Date(adj.decisionDate)
        const adjMonth = adjDate.getMonth() + 1
        const adjYear = adjDate.getFullYear()
        
        return adjYear === year && 
               adjMonth === month &&
               (adj.approveStatus === 'Đã duyệt' || adj.approveStatus === 'Approved') &&
               ['Kỷ luật', 'Truy thu', 'Tạm ứng'].includes(adj.adjustmentTypeName)
      })
      
      let adjustmentDeductions = 0
      approvedAdjustments.forEach(adj => {
        const employees = adj.Employees || adj.employees || []
        employees.forEach(emp => {
          if (emp.employeeID === currentUser.id) {
            adjustmentDeductions += Math.abs(emp.Value || emp.value || 0)
          }
        })
      })

      // Calculate tax
      const personalDeduction = 11000000
      const dependentDeduction = dependents * 4400000
      const totalIncome = actualSalary + mealAllowance + fuelAllowance + responsibilityAllowance + otSalary
      const taxableIncome = totalIncome
      const pitIncome = Math.max(0, totalIncome - insuranceEmployee - personalDeduction - dependentDeduction)
      
      let pitTax = 0
      if (pitIncome > 0) {
        if (pitIncome <= 5000000) {
          pitTax = pitIncome * 0.05
        } else if (pitIncome <= 10000000) {
          pitTax = 250000 + (pitIncome - 5000000) * 0.1
        } else if (pitIncome <= 18000000) {
          pitTax = 750000 + (pitIncome - 10000000) * 0.15
        } else if (pitIncome <= 32000000) {
          pitTax = 1950000 + (pitIncome - 18000000) * 0.2
        } else if (pitIncome <= 52000000) {
          pitTax = 4750000 + (pitIncome - 32000000) * 0.25
        } else if (pitIncome <= 80000000) {
          pitTax = 9750000 + (pitIncome - 52000000) * 0.3
        } else {
          pitTax = 18150000 + (pitIncome - 80000000) * 0.35
        }
      }

      const totalDeduction = insuranceEmployee + unionFee + pitTax + adjustmentDeductions
      const netSalary = Math.max(0, totalIncome - totalDeduction)

      // Build employee name from available fields
      let empName = 'N/A'
      if (userEmployee.employeeName) {
        empName = userEmployee.employeeName
      } else if (userEmployee.firstName && userEmployee.lastName) {
        empName = `${userEmployee.firstName} ${userEmployee.lastName}`
      } else if (userEmployee.fullName) {
        empName = userEmployee.fullName
      } else if (userEmployee.name) {
        empName = userEmployee.name
      } else if (userEmployee.firstName) {
        empName = userEmployee.firstName
      } else if (userEmployee.lastName) {
        empName = userEmployee.lastName
      }

      // Build title from available fields
      let title = 'Nhân viên'
      if (userEmployee.roleName) {
        title = userEmployee.roleName
      } else if (userEmployee.role) {
        title = userEmployee.role
      } else if (userEmployee.position) {
        title = userEmployee.position
      } else if (userEmployee.title) {
        title = userEmployee.title
      }

      console.log('Final employee data:', {
        empId: userEmployee.id,
        empName,
        title,
        userEmployee
      })

      // Format contract period string
      const formatContractPeriod = (startDate, endDate) => {
        if (!startDate || !endDate) return '-'
        const start = new Date(startDate)
        const end = new Date(endDate)
        const startStr = `${String(start.getDate()).padStart(2, '0')}/${String(start.getMonth() + 1).padStart(2, '0')}`
        const endStr = `${String(end.getDate()).padStart(2, '0')}/${String(end.getMonth() + 1).padStart(2, '0')}`
        return `${startStr} - ${endStr}`
      }

      return {
        empId: userEmployee.id,
        empName,
        title,
        contractNumber: contract?.contractNumber || '-',
        contractPeriod: contract?.startDate && contract?.endDate 
          ? formatContractPeriod(contract.startDate, contract.endDate)
          : (contract?.startDate ? formatContractPeriod(contract.startDate, contract.endDate || new Date()) : '-'),
        contractType: contract?.contractTypeName || 'Không xác định',
        contractSalary,
        insuranceSalary,
        totalContractSalary: contractSalary + insuranceSalary,
        standardDays,
        totalDays,
        salaryByDays,
        paidLeaveDays: totalPaidLeaveDays,
        leaveSalary,
        actualSalary,
        otDays,
        otDaysWithCoeff,
        otSalary,
        mealAllowance,
        fuelAllowance,
        responsibilityAllowance,
        totalSupport: mealAllowance + fuelAllowance + responsibilityAllowance,
        insuranceEmployee,
        unionFee,
        adjustmentDeductions,
        personalDeduction,
        dependents,
        dependentDeduction,
        totalIncome,
        taxableIncome,
        bonus: 0,
        otherIncome: 0,
        pitIncome,
        pitTax,
        totalDeduction,
        netSalary
      }

    } catch (error) {
      console.error('Error calculating personal salary data:', error)
      throw error
    }
  },

  // Get salary data by year and month (for admin view)
  async getSalaryData(year, month) {
    try {
      // This would calculate salary for all employees
      // For now, return personal salary data
      return await this.getPersonalSalaryData(year, month)
    } catch (error) {
      console.error('Error fetching salary data:', error)
      throw error
    }
  },

  // Get salary summary data
  async getSalarySummary(year, month) {
    try {
      const personalSalary = await this.getPersonalSalaryData(year, month)
      return {
        totalEmployees: 1,
        totalIncome: personalSalary.totalIncome,
        totalTax: personalSalary.pitTax,
        totalInsurance: personalSalary.insuranceEmployee
      }
    } catch (error) {
      console.error('Error fetching salary summary:', error)
      throw error
    }
  }
}
