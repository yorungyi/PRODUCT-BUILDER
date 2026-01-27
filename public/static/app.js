// 노스팜CC 일매출 관리 시스템 - 프론트엔드
const API_BASE = '/api'
let currentUser = null
let authToken = null
let stores = []
let storeChart = null
let trendChart = null

// ===== 유틸리티 함수 =====
function showLoading() {
  document.getElementById('loading').classList.remove('hidden')
}

function hideLoading() {
  document.getElementById('loading').classList.add('hidden')
}

function showAlert(message, type = 'info') {
  const colors = {
    success: 'bg-green-100 border-green-500 text-green-800',
    error: 'bg-red-100 border-red-500 text-red-800',
    info: 'bg-blue-100 border-blue-500 text-blue-800'
  }
  
  const alertDiv = document.createElement('div')
  alertDiv.className = `fixed top-4 right-4 px-6 py-4 border-l-4 rounded shadow-lg z-50 ${colors[type]}`
  alertDiv.textContent = message
  document.body.appendChild(alertDiv)
  
  setTimeout(() => alertDiv.remove(), 3000)
}

function formatCurrency(amount) {
  return new Intl.NumberFormat('ko-KR').format(amount) + '원'
}

function formatDate(dateString) {
  return new Date(dateString).toLocaleDateString('ko-KR')
}

// ===== API 호출 함수 =====
async function apiCall(endpoint, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers
  }
  
  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`
  }
  
  try {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers
    })
    
    const data = await response.json()
    
    // 401 에러 시 자동 로그아웃
    if (response.status === 401) {
      console.error('인증 실패:', data.error)
      // 로그인 페이지가 아닌 경우에만 자동 로그아웃
      if (!endpoint.includes('/auth/login')) {
        showAlert('세션이 만료되었습니다. 다시 로그인해주세요.', 'error')
        setTimeout(() => {
          authToken = null
          currentUser = null
          localStorage.removeItem('authToken')
          localStorage.removeItem('currentUser')
          showLoginPage()
        }, 1500)
      }
      throw new Error(data.error || data.message || '인증에 실패했습니다.')
    }
    
    if (!response.ok) {
      throw new Error(data.error || data.message || '오류가 발생했습니다.')
    }
    
    return data
  } catch (error) {
    if (error.message) throw error
    throw new Error('네트워크 오류가 발생했습니다.')
  }
}

// ===== 인증 관련 =====
async function login(username, password) {
  showLoading()
  try {
    const result = await apiCall('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password })
    })
    
    authToken = result.data.token
    currentUser = result.data.user
    localStorage.setItem('authToken', authToken)
    localStorage.setItem('currentUser', JSON.stringify(currentUser))
    
    showMainApp()
    showAlert('로그인 되었습니다.', 'success')
  } catch (error) {
    showAlert(error.message, 'error')
  } finally {
    hideLoading()
  }
}

async function logout() {
  showLoading()
  try {
    await apiCall('/auth/logout', { method: 'POST' })
  } catch (error) {
    console.error('Logout error:', error)
  } finally {
    authToken = null
    currentUser = null
    localStorage.removeItem('authToken')
    localStorage.removeItem('currentUser')
    showLoginPage()
    hideLoading()
  }
}

function checkAuth() {
  const token = localStorage.getItem('authToken')
  const user = localStorage.getItem('currentUser')
  
  if (token && user) {
    authToken = token
    currentUser = JSON.parse(user)
    showMainApp()
  } else {
    showLoginPage()
  }
}

// ===== 페이지 표시 =====
function showLoginPage() {
  document.getElementById('loginPage').classList.remove('hidden')
  document.getElementById('mainApp').classList.add('hidden')
}

function showMainApp() {
  document.getElementById('loginPage').classList.add('hidden')
  document.getElementById('mainApp').classList.remove('hidden')
  
  document.getElementById('userName').textContent = currentUser.name
  document.getElementById('userRole').textContent = currentUser.role === 'admin' ? '관리자' : '직원'
  
  loadStores()
  loadDashboard()
}

// ===== 점포 관련 =====
async function loadStores() {
  try {
    const result = await apiCall('/stores')
    stores = result.data
    
    // 매출 등록 폼의 점포 선택
    const storeSelect = document.getElementById('storeSelect')
    const filterStore = document.getElementById('filterStore')
    
    stores.forEach(store => {
      const option1 = new Option(store.name, store.id)
      const option2 = new Option(store.name, store.id)
      storeSelect.add(option1)
      filterStore.add(option2)
    })
  } catch (error) {
    showAlert('점포 목록을 불러올 수 없습니다.', 'error')
  }
}

// ===== 대시보드 =====
async function loadDashboard() {
  showLoading()
  try {
    const endDate = document.getElementById('dashEndDate').value || new Date().toISOString().split('T')[0]
    const startDate = document.getElementById('dashStartDate').value || 
      new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    
    const result = await apiCall(`/sales/summary/dashboard?startDate=${startDate}&endDate=${endDate}`)
    const data = result.data
    
    // 점포별 합계 표시
    const storeTotals = {}
    data.storeTotal.forEach(store => {
      storeTotals[store.store_code] = store.total_amount || 0
    })
    
    document.getElementById('clubhouseTotal').textContent = formatCurrency(storeTotals['clubhouse'] || 0)
    document.getElementById('starthouseTotal').textContent = formatCurrency(storeTotals['starthouse'] || 0)
    document.getElementById('eastShadeTotal').textContent = formatCurrency(storeTotals['east_shade'] || 0)
    document.getElementById('westShadeTotal').textContent = formatCurrency(storeTotals['west_shade'] || 0)
    
    // 점포별 매출 비중 차트
    updateStoreChart(data.storeTotal)
    
    // 일별 추이 차트
    updateTrendChart(data.dailyTrend)
    
  } catch (error) {
    showAlert('대시보드 데이터를 불러올 수 없습니다.', 'error')
  } finally {
    hideLoading()
  }
}

function updateStoreChart(storeData) {
  const ctx = document.getElementById('storeChart')
  
  if (storeChart) {
    storeChart.destroy()
  }
  
  const labels = storeData.map(s => s.store_name)
  const data = storeData.map(s => s.total_amount || 0)
  const colors = ['#3B82F6', '#10B981', '#F59E0B', '#8B5CF6']
  
  storeChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: labels,
      datasets: [{
        data: data,
        backgroundColor: colors,
        borderWidth: 2,
        borderColor: '#fff'
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          position: 'bottom'
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              return context.label + ': ' + formatCurrency(context.parsed)
            }
          }
        }
      }
    }
  })
}

function updateTrendChart(trendData) {
  const ctx = document.getElementById('trendChart')
  
  if (trendChart) {
    trendChart.destroy()
  }
  
  const labels = trendData.map(d => formatDate(d.sale_date))
  const data = trendData.map(d => d.daily_total || 0)
  
  trendChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        label: '일 매출',
        data: data,
        borderColor: '#3B82F6',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        tension: 0.4,
        fill: true
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              return formatCurrency(context.parsed.y)
            }
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            callback: function(value) {
              return (value / 10000) + '만원'
            }
          }
        }
      }
    }
  })
}

// ===== 매출 등록 =====
async function registerSales(saleDate, storeId, amount, memo) {
  showLoading()
  try {
    await apiCall('/sales', {
      method: 'POST',
      body: JSON.stringify({ saleDate, storeId: parseInt(storeId), amount: parseFloat(amount), memo })
    })
    
    showAlert('매출이 등록되었습니다.', 'success')
    document.getElementById('salesForm').reset()
    
    // 대시보드 새로고침
    if (document.getElementById('dashboardTab').classList.contains('hidden') === false) {
      loadDashboard()
    }
  } catch (error) {
    showAlert(error.message, 'error')
  } finally {
    hideLoading()
  }
}

// ===== 매출 내역 =====
async function loadSalesList() {
  showLoading()
  try {
    const storeId = document.getElementById('filterStore').value
    const isClosed = document.getElementById('filterClosed').value
    const startDate = document.getElementById('filterStartDate').value
    const endDate = document.getElementById('filterEndDate').value
    
    let url = '/sales?'
    if (storeId) url += `storeId=${storeId}&`
    if (isClosed) url += `isClosed=${isClosed}&`
    if (startDate) url += `startDate=${startDate}&`
    if (endDate) url += `endDate=${endDate}&`
    
    const result = await apiCall(url)
    const sales = result.data
    
    const tbody = document.getElementById('salesTableBody')
    tbody.innerHTML = ''
    
    if (sales.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" class="text-center py-4 text-gray-500">매출 내역이 없습니다.</td></tr>'
      return
    }
    
    sales.forEach(sale => {
      const row = document.createElement('tr')
      row.className = 'hover:bg-gray-50'
      
      const closedBadge = sale.is_closed 
        ? '<span class="px-2 py-1 bg-green-100 text-green-800 text-xs rounded">마감완료</span>'
        : '<span class="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs rounded">미마감</span>'
      
      const actions = sale.is_closed === 0 
        ? `
          <button onclick="editSale(${sale.id})" class="text-blue-600 hover:text-blue-800 mr-2">
            <i class="fas fa-edit"></i>
          </button>
          <button onclick="deleteSale(${sale.id})" class="text-red-600 hover:text-red-800 mr-2">
            <i class="fas fa-trash"></i>
          </button>
          <button onclick="closeSale(${sale.id})" class="text-green-600 hover:text-green-800">
            <i class="fas fa-lock"></i> 마감
          </button>
        `
        : currentUser.role === 'admin'
        ? `
          <button onclick="reopenSale(${sale.id})" class="text-orange-600 hover:text-orange-800">
            <i class="fas fa-unlock"></i> 해제
          </button>
        `
        : '<span class="text-gray-400">-</span>'
      
      row.innerHTML = `
        <td class="px-4 py-3">${formatDate(sale.sale_date)}</td>
        <td class="px-4 py-3">${sale.store_name}</td>
        <td class="px-4 py-3 text-right font-medium">${formatCurrency(sale.amount)}</td>
        <td class="px-4 py-3 text-sm text-gray-600">${sale.memo || '-'}</td>
        <td class="px-4 py-3 text-center">${closedBadge}</td>
        <td class="px-4 py-3 text-sm">${sale.created_by_name}</td>
        <td class="px-4 py-3 text-center no-print">${actions}</td>
      `
      
      tbody.appendChild(row)
    })
  } catch (error) {
    showAlert('매출 내역을 불러올 수 없습니다.', 'error')
  } finally {
    hideLoading()
  }
}

async function deleteSale(id) {
  if (!confirm('정말 삭제하시겠습니까?')) return
  
  showLoading()
  try {
    await apiCall(`/sales/${id}`, { method: 'DELETE' })
    showAlert('매출이 삭제되었습니다.', 'success')
    loadSalesList()
  } catch (error) {
    showAlert(error.message, 'error')
  } finally {
    hideLoading()
  }
}

async function closeSale(id) {
  if (!confirm('매출을 마감하시겠습니까? 마감 후에는 수정/삭제할 수 없습니다.')) return
  
  showLoading()
  try {
    await apiCall(`/sales/${id}/close`, { method: 'POST' })
    showAlert('매출이 마감되었습니다.', 'success')
    loadSalesList()
  } catch (error) {
    showAlert(error.message, 'error')
  } finally {
    hideLoading()
  }
}

async function reopenSale(id) {
  const reason = prompt('마감 해제 사유를 입력하세요:')
  if (!reason) return
  
  showLoading()
  try {
    await apiCall(`/sales/${id}/reopen`, {
      method: 'POST',
      body: JSON.stringify({ reason })
    })
    showAlert('매출 마감이 해제되었습니다.', 'success')
    loadSalesList()
  } catch (error) {
    showAlert(error.message, 'error')
  } finally {
    hideLoading()
  }
}

// ===== 탭 전환 =====
function switchTab(tabName) {
  // 모든 탭 버튼 비활성화
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.remove('border-blue-600', 'text-blue-600')
    btn.classList.add('border-transparent', 'text-gray-600')
  })
  
  // 선택된 탭 버튼 활성화
  const activeBtn = document.querySelector(`[data-tab="${tabName}"]`)
  activeBtn.classList.add('border-blue-600', 'text-blue-600')
  activeBtn.classList.remove('border-transparent', 'text-gray-600')
  
  // 모든 탭 컨텐츠 숨기기
  document.querySelectorAll('.tab-content').forEach(content => {
    content.classList.add('hidden')
  })
  
  // 선택된 탭 컨텐츠 표시
  const tabMap = {
    'dashboard': 'dashboardTab',
    'register': 'registerTab',
    'list': 'listTab'
  }
  
  document.getElementById(tabMap[tabName]).classList.remove('hidden')
  
  // 탭별 데이터 로드
  if (tabName === 'dashboard') {
    loadDashboard()
  } else if (tabName === 'list') {
    loadSalesList()
  }
}

// ===== 이벤트 리스너 =====
document.addEventListener('DOMContentLoaded', () => {
  // 로그인 폼
  document.getElementById('loginForm').addEventListener('submit', (e) => {
    e.preventDefault()
    const username = document.getElementById('username').value
    const password = document.getElementById('password').value
    login(username, password)
  })
  
  // 로그아웃
  document.getElementById('logoutBtn').addEventListener('click', logout)
  
  // 탭 전환
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      switchTab(btn.dataset.tab)
    })
  })
  
  // 매출 등록 폼
  document.getElementById('salesForm').addEventListener('submit', (e) => {
    e.preventDefault()
    const saleDate = document.getElementById('saleDate').value
    const storeId = document.getElementById('storeSelect').value
    const amount = document.getElementById('amount').value
    const memo = document.getElementById('memo').value
    registerSales(saleDate, storeId, amount, memo)
  })
  
  // 대시보드 기간 조회
  document.getElementById('dashSearchBtn').addEventListener('click', loadDashboard)
  
  // 매출 내역 필터
  document.getElementById('filterBtn').addEventListener('click', loadSalesList)
  
  // 날짜 초기값 설정
  const today = new Date().toISOString().split('T')[0]
  const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  
  document.getElementById('saleDate').value = today
  document.getElementById('dashEndDate').value = today
  document.getElementById('dashStartDate').value = monthAgo
  document.getElementById('filterEndDate').value = today
  document.getElementById('filterStartDate').value = monthAgo
  
  // 인증 체크
  checkAuth()
})
