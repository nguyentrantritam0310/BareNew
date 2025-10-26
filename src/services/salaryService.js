import api from '../api'
import AsyncStorage from '@react-native-async-storage/async-storage'

export const salaryService = {
  // Calculate personal salary data dynamically from multiple data sources
  async getPersonalSalaryData(year, month) {
    try {
      // Get current user from AsyncStorage
      const userString = await AsyncStorage.getItem('user')
      if (!userString) {
        throw new Error('Chưa đăng nhập')
      }
      
      const currentUser = JSON.parse(userString)
      console.log('Current user from AsyncStorage:', currentUser)
      
      if (!currentUser || !currentUser.id) {
        throw new Error('Không tìm thấy thông tin người dùng')
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

      // Find contract for current user
      const contract = contracts.find(c => c.employeeID === currentUser.id)
      
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

      // Calculate paid leave days
      const approvedLeaveRequests = leaveRequests.filter(leave => {
        const leaveStartDate = new Date(leave.startDateTime)
        return leave.employeeID === currentUser.id &&
               leaveStartDate.getMonth() + 1 === month &&
               leaveStartDate.getFullYear() === year &&
               (leave.approveStatus === 'Đã duyệt' || leave.approveStatus === 'Approved') &&
               leave.leaveTypeName && leave.leaveTypeName.toLowerCase().includes('phép')
      })
      
      let totalPaidLeaveDays = 0
      approvedLeaveRequests.forEach(leave => {
        const startDate = new Date(leave.startDateTime)
        const endDate = new Date(leave.endDateTime)
        const daysDiff = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1
        totalPaidLeaveDays += daysDiff
      })

      // Calculate overtime
      const approvedOvertimeForMonth = overtimeRequests.filter(ot => {
        if (!ot || !ot.startDateTime) return false
        const start = new Date(ot.startDateTime)
        const isSameMonth = (start.getFullYear() === year) && (start.getMonth() + 1 === month)
        const isApproved = ot.approveStatus === 'Đã duyệt' || ot.approveStatus === 'Approved' || ot.approveStatus === 2
        const employeeMatch = ot.employeeID === currentUser.id
        return isSameMonth && isApproved && employeeMatch
      })

      let totalOvertimeHours = 0
      let totalOvertimeDayUnits = 0
      let totalOvertimeDaysWithCoeff = 0
      
      approvedOvertimeForMonth.forEach(ot => {
        const start = new Date(ot.startDateTime)
        const end = new Date(ot.endDateTime)
        const hours = Math.max(0, (end - start) / (1000 * 60 * 60))
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

      return {
        empId: userEmployee.id,
        empName,
        title,
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
