// 매출 관련 API 라우트
import { Hono } from 'hono'
import { authMiddleware, adminMiddleware } from '../middleware/auth'
import { successResponse, errorResponse, isValidDate, isValidAmount } from '../utils/response'

type Bindings = {
  DB: D1Database
}

const sales = new Hono<{ Bindings: Bindings }>()

// 모든 매출 API는 인증 필요
sales.use('/*', authMiddleware)

/**
 * GET /api/sales
 * 매출 목록 조회 (필터링: 날짜범위, 점포, 마감여부)
 */
sales.get('/', async (c) => {
  try {
    const { startDate, endDate, storeId, isClosed } = c.req.query()
    
    let query = `
      SELECT 
        ds.id,
        ds.sale_date,
        ds.store_id,
        s.name as store_name,
        s.code as store_code,
        ds.amount,
        ds.memo,
        ds.is_closed,
        ds.closed_at,
        u_closed.name as closed_by_name,
        u_created.name as created_by_name,
        ds.created_at,
        ds.updated_at
      FROM daily_sales ds
      INNER JOIN stores s ON ds.store_id = s.id
      LEFT JOIN users u_closed ON ds.closed_by = u_closed.id
      INNER JOIN users u_created ON ds.created_by = u_created.id
      WHERE 1=1
    `
    
    const params: any[] = []
    
    if (startDate) {
      query += ' AND ds.sale_date >= ?'
      params.push(startDate)
    }
    
    if (endDate) {
      query += ' AND ds.sale_date <= ?'
      params.push(endDate)
    }
    
    if (storeId) {
      query += ' AND ds.store_id = ?'
      params.push(parseInt(storeId))
    }
    
    if (isClosed !== undefined) {
      query += ' AND ds.is_closed = ?'
      params.push(isClosed === 'true' ? 1 : 0)
    }
    
    query += ' ORDER BY ds.sale_date DESC, s.display_order'
    
    const result = await c.env.DB.prepare(query).bind(...params).all()
    
    return c.json(successResponse(result.results))
    
  } catch (error) {
    console.error('Get sales error:', error)
    return c.json(errorResponse('매출 목록 조회 중 오류가 발생했습니다.'), 500)
  }
})

/**
 * GET /api/sales/:id
 * 매출 상세 조회
 */
sales.get('/:id', async (c) => {
  try {
    const id = parseInt(c.req.param('id'))
    
    const sale = await c.env.DB.prepare(`
      SELECT 
        ds.id,
        ds.sale_date,
        ds.store_id,
        s.name as store_name,
        s.code as store_code,
        ds.amount,
        ds.memo,
        ds.is_closed,
        ds.closed_at,
        u_closed.name as closed_by_name,
        u_created.name as created_by_name,
        ds.created_at,
        ds.updated_at
      FROM daily_sales ds
      INNER JOIN stores s ON ds.store_id = s.id
      LEFT JOIN users u_closed ON ds.closed_by = u_closed.id
      INNER JOIN users u_created ON ds.created_by = u_created.id
      WHERE ds.id = ?
    `).bind(id).first()
    
    if (!sale) {
      return c.json(errorResponse('매출 정보를 찾을 수 없습니다.'), 404)
    }
    
    return c.json(successResponse(sale))
    
  } catch (error) {
    console.error('Get sale error:', error)
    return c.json(errorResponse('매출 조회 중 오류가 발생했습니다.'), 500)
  }
})

/**
 * POST /api/sales
 * 매출 등록
 */
sales.post('/', async (c) => {
  try {
    const user = c.get('user')
    const { saleDate, storeId, amount, memo } = await c.req.json()
    
    // 입력 검증
    if (!saleDate || !storeId || amount === undefined) {
      return c.json(errorResponse('필수 항목을 모두 입력해주세요.'), 400)
    }
    
    if (!isValidDate(saleDate)) {
      return c.json(errorResponse('올바른 날짜 형식이 아닙니다. (YYYY-MM-DD)'), 400)
    }
    
    if (!isValidAmount(amount)) {
      return c.json(errorResponse('올바른 금액을 입력해주세요. (0 ~ 100,000,000)'), 400)
    }
    
    // 중복 체크 (같은 날짜, 같은 점포)
    const existing = await c.env.DB.prepare(
      'SELECT id FROM daily_sales WHERE sale_date = ? AND store_id = ?'
    ).bind(saleDate, storeId).first()
    
    if (existing) {
      return c.json(errorResponse('이미 해당 날짜에 매출이 등록되어 있습니다.'), 409)
    }
    
    // 매출 등록
    const result = await c.env.DB.prepare(`
      INSERT INTO daily_sales (sale_date, store_id, amount, memo, created_by)
      VALUES (?, ?, ?, ?, ?)
    `).bind(saleDate, storeId, amount, memo || '', user.userId).run()
    
    return c.json(successResponse({
      id: result.meta.last_row_id,
      saleDate,
      storeId,
      amount,
      memo
    }, '매출이 등록되었습니다.'), 201)
    
  } catch (error) {
    console.error('Create sale error:', error)
    return c.json(errorResponse('매출 등록 중 오류가 발생했습니다.'), 500)
  }
})

/**
 * PUT /api/sales/:id
 * 매출 수정 (마감되지 않은 경우만)
 */
sales.put('/:id', async (c) => {
  try {
    const id = parseInt(c.req.param('id'))
    const { amount, memo } = await c.req.json()
    
    // 매출 조회
    const sale = await c.env.DB.prepare(
      'SELECT id, is_closed FROM daily_sales WHERE id = ?'
    ).bind(id).first()
    
    if (!sale) {
      return c.json(errorResponse('매출 정보를 찾을 수 없습니다.'), 404)
    }
    
    // 마감 여부 확인
    if (sale.is_closed === 1) {
      return c.json(errorResponse('마감된 매출은 수정할 수 없습니다.'), 403)
    }
    
    // 입력 검증
    if (amount !== undefined && !isValidAmount(amount)) {
      return c.json(errorResponse('올바른 금액을 입력해주세요.'), 400)
    }
    
    // 매출 수정
    await c.env.DB.prepare(`
      UPDATE daily_sales 
      SET amount = ?, memo = ?, updated_at = datetime('now')
      WHERE id = ?
    `).bind(amount, memo || '', id).run()
    
    return c.json(successResponse({ id, amount, memo }, '매출이 수정되었습니다.'))
    
  } catch (error) {
    console.error('Update sale error:', error)
    return c.json(errorResponse('매출 수정 중 오류가 발생했습니다.'), 500)
  }
})

/**
 * DELETE /api/sales/:id
 * 매출 삭제 (마감되지 않은 경우만)
 */
sales.delete('/:id', async (c) => {
  try {
    const id = parseInt(c.req.param('id'))
    
    // 매출 조회
    const sale = await c.env.DB.prepare(
      'SELECT id, is_closed FROM daily_sales WHERE id = ?'
    ).bind(id).first()
    
    if (!sale) {
      return c.json(errorResponse('매출 정보를 찾을 수 없습니다.'), 404)
    }
    
    // 마감 여부 확인
    if (sale.is_closed === 1) {
      return c.json(errorResponse('마감된 매출은 삭제할 수 없습니다.'), 403)
    }
    
    // 관련된 마감 이력 먼저 삭제 (외래키 제약 조건)
    await c.env.DB.prepare('DELETE FROM closing_history WHERE daily_sales_id = ?').bind(id).run()
    
    // 매출 삭제
    await c.env.DB.prepare('DELETE FROM daily_sales WHERE id = ?').bind(id).run()
    
    return c.json(successResponse(null, '매출이 삭제되었습니다.'))
    
  } catch (error) {
    console.error('Delete sale error:', error)
    return c.json(errorResponse('매출 삭제 중 오류가 발생했습니다.'), 500)
  }
})

/**
 * POST /api/sales/:id/close
 * 매출 마감
 */
sales.post('/:id/close', async (c) => {
  try {
    const user = c.get('user')
    const id = parseInt(c.req.param('id'))
    
    // 매출 조회
    const sale = await c.env.DB.prepare(
      'SELECT id, is_closed FROM daily_sales WHERE id = ?'
    ).bind(id).first()
    
    if (!sale) {
      return c.json(errorResponse('매출 정보를 찾을 수 없습니다.'), 404)
    }
    
    // 이미 마감되었는지 확인
    if (sale.is_closed === 1) {
      return c.json(errorResponse('이미 마감된 매출입니다.'), 409)
    }
    
    // 매출 마감 처리
    await c.env.DB.prepare(`
      UPDATE daily_sales 
      SET is_closed = 1, closed_at = datetime('now'), closed_by = ?
      WHERE id = ?
    `).bind(user.userId, id).run()
    
    // 마감 이력 기록
    await c.env.DB.prepare(`
      INSERT INTO closing_history (daily_sales_id, action, performed_by)
      VALUES (?, 'close', ?)
    `).bind(id, user.userId).run()
    
    return c.json(successResponse(null, '매출이 마감되었습니다.'))
    
  } catch (error) {
    console.error('Close sale error:', error)
    return c.json(errorResponse('매출 마감 중 오류가 발생했습니다.'), 500)
  }
})

/**
 * POST /api/sales/:id/reopen
 * 매출 마감 해제 (관리자만)
 */
sales.post('/:id/reopen', adminMiddleware, async (c) => {
  try {
    const user = c.get('user')
    const id = parseInt(c.req.param('id'))
    const { reason } = await c.req.json()
    
    if (!reason) {
      return c.json(errorResponse('마감 해제 사유를 입력해주세요.'), 400)
    }
    
    // 매출 조회
    const sale = await c.env.DB.prepare(
      'SELECT id, is_closed FROM daily_sales WHERE id = ?'
    ).bind(id).first()
    
    if (!sale) {
      return c.json(errorResponse('매출 정보를 찾을 수 없습니다.'), 404)
    }
    
    // 마감되지 않았는지 확인
    if (sale.is_closed === 0) {
      return c.json(errorResponse('마감되지 않은 매출입니다.'), 409)
    }
    
    // 마감 해제 처리
    await c.env.DB.prepare(`
      UPDATE daily_sales 
      SET is_closed = 0, closed_at = NULL, closed_by = NULL
      WHERE id = ?
    `).bind(id).run()
    
    // 마감 해제 이력 기록
    await c.env.DB.prepare(`
      INSERT INTO closing_history (daily_sales_id, action, performed_by, reason)
      VALUES (?, 'reopen', ?, ?)
    `).bind(id, user.userId, reason).run()
    
    return c.json(successResponse(null, '매출 마감이 해제되었습니다.'))
    
  } catch (error) {
    console.error('Reopen sale error:', error)
    return c.json(errorResponse('매출 마감 해제 중 오류가 발생했습니다.'), 500)
  }
})

/**
 * GET /api/sales/summary/monthly
 * 월별 매출 집계
 */
sales.get('/summary/monthly', async (c) => {
  try {
    const { year, month } = c.req.query()
    
    let query = `
      SELECT 
        strftime('%Y-%m', sale_date) as year_month,
        s.code as store_code,
        s.name as store_name,
        COUNT(*) as sales_count,
        SUM(amount) as total_amount,
        AVG(amount) as avg_amount,
        MIN(amount) as min_amount,
        MAX(amount) as max_amount
      FROM daily_sales ds
      INNER JOIN stores s ON ds.store_id = s.id
      WHERE 1=1
    `
    
    const params: any[] = []
    
    if (year) {
      query += ` AND strftime('%Y', sale_date) = ?`
      params.push(year)
    }
    
    if (month) {
      query += ` AND strftime('%m', sale_date) = ?`
      params.push(month.padStart(2, '0'))
    }
    
    query += ` GROUP BY year_month, s.code, s.name ORDER BY year_month DESC, s.display_order`
    
    const result = await c.env.DB.prepare(query).bind(...params).all()
    
    return c.json(successResponse(result.results))
    
  } catch (error) {
    console.error('Get monthly summary error:', error)
    return c.json(errorResponse('월별 매출 집계 조회 중 오류가 발생했습니다.'), 500)
  }
})

/**
 * GET /api/sales/summary/yearly
 * 연도별 매출 집계
 */
sales.get('/summary/yearly', async (c) => {
  try {
    const { year } = c.req.query()
    
    let query = `
      SELECT 
        strftime('%Y', sale_date) as year,
        s.code as store_code,
        s.name as store_name,
        COUNT(*) as sales_count,
        SUM(amount) as total_amount,
        AVG(amount) as avg_amount
      FROM daily_sales ds
      INNER JOIN stores s ON ds.store_id = s.id
      WHERE 1=1
    `
    
    const params: any[] = []
    
    if (year) {
      query += ` AND strftime('%Y', sale_date) = ?`
      params.push(year)
    }
    
    query += ` GROUP BY year, s.code, s.name ORDER BY year DESC, s.display_order`
    
    const result = await c.env.DB.prepare(query).bind(...params).all()
    
    return c.json(successResponse(result.results))
    
  } catch (error) {
    console.error('Get yearly summary error:', error)
    return c.json(errorResponse('연도별 매출 집계 조회 중 오류가 발생했습니다.'), 500)
  }
})

/**
 * GET /api/sales/summary/dashboard
 * 대시보드용 종합 요약 데이터
 */
sales.get('/summary/dashboard', async (c) => {
  try {
    const { startDate, endDate } = c.req.query()
    
    // 기본값: 최근 30일
    const end = endDate || new Date().toISOString().split('T')[0]
    const start = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    
    // 점포별 매출 합계
    const storeTotal = await c.env.DB.prepare(`
      SELECT 
        s.code as store_code,
        s.name as store_name,
        COUNT(*) as sales_count,
        SUM(ds.amount) as total_amount,
        AVG(ds.amount) as avg_amount
      FROM daily_sales ds
      INNER JOIN stores s ON ds.store_id = s.id
      WHERE ds.sale_date BETWEEN ? AND ?
      GROUP BY s.code, s.name
      ORDER BY s.display_order
    `).bind(start, end).all()
    
    // 전체 합계
    const grandTotal = await c.env.DB.prepare(`
      SELECT 
        COUNT(*) as total_count,
        SUM(amount) as grand_total,
        AVG(amount) as overall_avg
      FROM daily_sales
      WHERE sale_date BETWEEN ? AND ?
    `).bind(start, end).first()
    
    // 최근 7일 일별 추이
    const dailyTrend = await c.env.DB.prepare(`
      SELECT 
        sale_date,
        SUM(amount) as daily_total
      FROM daily_sales
      WHERE sale_date BETWEEN date(?, '-7 days') AND ?
      GROUP BY sale_date
      ORDER BY sale_date
    `).bind(end, end).all()
    
    return c.json(successResponse({
      dateRange: { start, end },
      storeTotal: storeTotal.results,
      grandTotal,
      dailyTrend: dailyTrend.results
    }))
    
  } catch (error) {
    console.error('Get dashboard summary error:', error)
    return c.json(errorResponse('대시보드 데이터 조회 중 오류가 발생했습니다.'), 500)
  }
})

export default sales
