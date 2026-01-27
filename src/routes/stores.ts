// 점포 관련 API 라우트
import { Hono } from 'hono'
import { successResponse, errorResponse } from '../utils/response'

type Bindings = {
  DB: D1Database
}

const stores = new Hono<{ Bindings: Bindings }>()

/**
 * GET /api/stores
 * 점포 목록 조회
 */
stores.get('/', async (c) => {
  try {
    const result = await c.env.DB.prepare(`
      SELECT id, code, name, display_order, is_active
      FROM stores
      WHERE is_active = 1
      ORDER BY display_order
    `).all()
    
    return c.json(successResponse(result.results))
    
  } catch (error) {
    console.error('Get stores error:', error)
    return c.json(errorResponse('점포 목록 조회 중 오류가 발생했습니다.'), 500)
  }
})

export default stores
