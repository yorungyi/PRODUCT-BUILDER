import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { serveStatic } from 'hono/cloudflare-workers'

// Routes
import auth from './routes/auth'
import stores from './routes/stores'
import sales from './routes/sales'

type Bindings = {
  DB: D1Database
}

const app = new Hono<{ Bindings: Bindings }>()

// 미들웨어
app.use('*', logger())
app.use('/api/*', cors({
  origin: '*',
  credentials: true,
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization']
}))

// 정적 파일 서빙
app.use('/static/*', serveStatic({ root: './public' }))

// API 라우트
app.route('/api/auth', auth)
app.route('/api/stores', stores)
app.route('/api/sales', sales)

// 헬스체크
app.get('/api/health', (c) => {
  return c.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    service: '노스팜CC 일매출 관리 시스템'
  })
})

// 메인 페이지
app.get('/', (c) => {
  return c.html(`
<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>노스팜CC 일매출 관리</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
    <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
    <style>
      @media print {
        .no-print { display: none; }
      }
    </style>
</head>
<body class="bg-gray-50">
    <!-- 로딩 스피너 -->
    <div id="loading" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 hidden">
        <div class="bg-white p-6 rounded-lg shadow-xl">
            <i class="fas fa-spinner fa-spin text-4xl text-blue-600"></i>
            <p class="mt-4 text-gray-700">처리 중...</p>
        </div>
    </div>

    <!-- 로그인 페이지 -->
    <div id="loginPage" class="min-h-screen flex items-center justify-center">
        <div class="bg-white p-8 rounded-lg shadow-lg w-96">
            <div class="text-center mb-6">
                <i class="fas fa-golf-ball text-4xl text-green-600 mb-2"></i>
                <h1 class="text-2xl font-bold text-gray-800">노스팜CC</h1>
                <p class="text-gray-600">일매출 관리 시스템</p>
            </div>
            <form id="loginForm" class="space-y-4">
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">아이디</label>
                    <input type="text" id="username" required
                        class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">비밀번호</label>
                    <input type="password" id="password" required
                        class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                </div>
                <button type="submit"
                    class="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition">
                    <i class="fas fa-sign-in-alt mr-2"></i>로그인
                </button>
            </form>
            <div class="mt-4 text-sm text-gray-600 text-center">
                <p>관리자: admin / staff: staff1</p>
                <p class="text-xs">(개발용 계정)</p>
            </div>
        </div>
    </div>

    <!-- 메인 애플리케이션 -->
    <div id="mainApp" class="hidden">
        <!-- 헤더 -->
        <header class="bg-white shadow-sm no-print">
            <div class="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
                <div class="flex items-center space-x-4">
                    <i class="fas fa-golf-ball text-2xl text-green-600"></i>
                    <div>
                        <h1 class="text-xl font-bold text-gray-800">노스팜CC 일매출 관리</h1>
                        <p class="text-sm text-gray-600">Northpalm Country Club Sales Management</p>
                    </div>
                </div>
                <div class="flex items-center space-x-4">
                    <span id="userName" class="text-sm text-gray-700"></span>
                    <span id="userRole" class="text-xs px-2 py-1 bg-blue-100 text-blue-800 rounded"></span>
                    <button id="logoutBtn" class="text-sm text-red-600 hover:text-red-800">
                        <i class="fas fa-sign-out-alt mr-1"></i>로그아웃
                    </button>
                </div>
            </div>
        </header>

        <!-- 탭 네비게이션 -->
        <div class="bg-white border-b no-print">
            <div class="max-w-7xl mx-auto px-4">
                <nav class="flex space-x-8">
                    <button class="tab-btn py-4 px-2 border-b-2 border-blue-600 text-blue-600 font-medium" data-tab="dashboard">
                        <i class="fas fa-chart-line mr-2"></i>대시보드
                    </button>
                    <button class="tab-btn py-4 px-2 border-b-2 border-transparent text-gray-600 hover:text-gray-800" data-tab="register">
                        <i class="fas fa-cash-register mr-2"></i>매출 등록
                    </button>
                    <button class="tab-btn py-4 px-2 border-b-2 border-transparent text-gray-600 hover:text-gray-800" data-tab="list">
                        <i class="fas fa-list mr-2"></i>매출 내역
                    </button>
                </nav>
            </div>
        </div>

        <!-- 컨텐츠 영역 -->
        <main class="max-w-7xl mx-auto px-4 py-6">
            <!-- 대시보드 탭 -->
            <div id="dashboardTab" class="tab-content">
                <div class="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
                    <div class="bg-white p-6 rounded-lg shadow">
                        <div class="flex items-center justify-between">
                            <div>
                                <p class="text-sm text-gray-600">클럽하우스</p>
                                <p id="clubhouseTotal" class="text-2xl font-bold text-gray-800">0원</p>
                            </div>
                            <i class="fas fa-utensils text-3xl text-blue-600"></i>
                        </div>
                    </div>
                    <div class="bg-white p-6 rounded-lg shadow">
                        <div class="flex items-center justify-between">
                            <div>
                                <p class="text-sm text-gray-600">스타트하우스</p>
                                <p id="starthouseTotal" class="text-2xl font-bold text-gray-800">0원</p>
                            </div>
                            <i class="fas fa-mug-hot text-3xl text-green-600"></i>
                        </div>
                    </div>
                    <div class="bg-white p-6 rounded-lg shadow">
                        <div class="flex items-center justify-between">
                            <div>
                                <p class="text-sm text-gray-600">동그늘집</p>
                                <p id="eastShadeTotal" class="text-2xl font-bold text-gray-800">0원</p>
                            </div>
                            <i class="fas fa-umbrella-beach text-3xl text-orange-600"></i>
                        </div>
                    </div>
                    <div class="bg-white p-6 rounded-lg shadow">
                        <div class="flex items-center justify-between">
                            <div>
                                <p class="text-sm text-gray-600">서그늘집</p>
                                <p id="westShadeTotal" class="text-2xl font-bold text-gray-800">0원</p>
                            </div>
                            <i class="fas fa-umbrella-beach text-3xl text-purple-600"></i>
                        </div>
                    </div>
                </div>

                <div class="bg-white p-6 rounded-lg shadow mb-6">
                    <h2 class="text-lg font-bold text-gray-800 mb-4">
                        <i class="fas fa-calendar-alt mr-2"></i>기간별 조회
                    </h2>
                    <div class="flex space-x-4">
                        <input type="date" id="dashStartDate" class="px-4 py-2 border rounded-lg">
                        <input type="date" id="dashEndDate" class="px-4 py-2 border rounded-lg">
                        <button id="dashSearchBtn" class="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                            <i class="fas fa-search mr-2"></i>조회
                        </button>
                    </div>
                </div>

                <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div class="bg-white p-6 rounded-lg shadow">
                        <h3 class="text-lg font-bold text-gray-800 mb-4">점포별 매출 비중</h3>
                        <canvas id="storeChart"></canvas>
                    </div>
                    <div class="bg-white p-6 rounded-lg shadow">
                        <h3 class="text-lg font-bold text-gray-800 mb-4">최근 7일 매출 추이</h3>
                        <canvas id="trendChart"></canvas>
                    </div>
                </div>
            </div>

            <!-- 매출 등록 탭 -->
            <div id="registerTab" class="tab-content hidden">
                <div class="bg-white p-6 rounded-lg shadow max-w-2xl mx-auto">
                    <h2 class="text-xl font-bold text-gray-800 mb-6">
                        <i class="fas fa-cash-register mr-2"></i>일매출 등록
                    </h2>
                    <form id="salesForm" class="space-y-4">
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-2">매출 날짜 *</label>
                            <input type="date" id="saleDate" required
                                class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-2">점포 선택 *</label>
                            <select id="storeSelect" required
                                class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
                                <option value="">점포를 선택하세요</option>
                            </select>
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-2">매출액 (원) *</label>
                            <input type="number" id="amount" required min="0" step="1000"
                                class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                placeholder="예: 1250000">
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-2">메모</label>
                            <textarea id="memo" rows="3"
                                class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                placeholder="특이사항이나 참고사항을 입력하세요 (선택)"></textarea>
                        </div>
                        <div class="flex space-x-4">
                            <button type="submit" class="flex-1 bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 font-medium">
                                <i class="fas fa-save mr-2"></i>등록하기
                            </button>
                            <button type="reset" class="px-6 bg-gray-300 text-gray-700 py-3 rounded-lg hover:bg-gray-400">
                                <i class="fas fa-redo mr-2"></i>초기화
                            </button>
                        </div>
                    </form>
                </div>
            </div>

            <!-- 매출 내역 탭 -->
            <div id="listTab" class="tab-content hidden">
                <div class="bg-white p-6 rounded-lg shadow mb-6">
                    <div class="flex justify-between items-center mb-4">
                        <h2 class="text-xl font-bold text-gray-800">
                            <i class="fas fa-list mr-2"></i>매출 내역
                        </h2>
                        <div class="flex space-x-2">
                            <select id="filterStore" class="px-4 py-2 border rounded-lg">
                                <option value="">전체 점포</option>
                            </select>
                            <select id="filterClosed" class="px-4 py-2 border rounded-lg">
                                <option value="">전체 상태</option>
                                <option value="false">미마감</option>
                                <option value="true">마감완료</option>
                            </select>
                            <input type="date" id="filterStartDate" class="px-4 py-2 border rounded-lg">
                            <input type="date" id="filterEndDate" class="px-4 py-2 border rounded-lg">
                            <button id="filterBtn" class="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                                <i class="fas fa-filter mr-2"></i>필터
                            </button>
                        </div>
                    </div>
                    <div class="overflow-x-auto">
                        <table class="w-full text-sm">
                            <thead class="bg-gray-50">
                                <tr>
                                    <th class="px-4 py-3 text-left">날짜</th>
                                    <th class="px-4 py-3 text-left">점포</th>
                                    <th class="px-4 py-3 text-right">매출액</th>
                                    <th class="px-4 py-3 text-left">메모</th>
                                    <th class="px-4 py-3 text-center">상태</th>
                                    <th class="px-4 py-3 text-left">등록자</th>
                                    <th class="px-4 py-3 text-center no-print">작업</th>
                                </tr>
                            </thead>
                            <tbody id="salesTableBody" class="divide-y divide-gray-200">
                                <!-- 동적 로드 -->
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </main>
    </div>

    <script src="/static/app.js"></script>
</body>
</html>
  `)
})

export default app
