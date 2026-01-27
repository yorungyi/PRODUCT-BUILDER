// JWT 인증 미들웨어
import { Context, Next } from 'hono'
import { getCookie } from 'hono/cookie'
import { verifyToken, JWTPayload } from '../utils/jwt'
import { errorResponse } from '../utils/response'

// Context에 user 정보 타입 추가
declare module 'hono' {
  interface ContextVariableMap {
    user: JWTPayload
  }
}

/**
 * 인증 미들웨어 - 모든 요청에 대해 JWT 검증
 */
export async function authMiddleware(c: Context, next: Next) {
  // Authorization 헤더 또는 쿠키에서 토큰 가져오기
  const authHeader = c.req.header('Authorization')
  let token = authHeader?.replace('Bearer ', '')
  
  if (!token) {
    token = getCookie(c, 'auth_token')
  }
  
  if (!token) {
    return c.json(errorResponse('토큰이 없습니다. 로그인이 필요합니다.'), 401)
  }
  
  // 토큰 검증
  const payload = await verifyToken(token)
  
  if (!payload) {
    return c.json(errorResponse('유효하지 않은 토큰입니다.'), 401)
  }
  
  // 토큰 만료 검증
  if (payload.exp < Math.floor(Date.now() / 1000)) {
    return c.json(errorResponse('토큰이 만료되었습니다. 다시 로그인해주세요.'), 401)
  }
  
  // Context에 사용자 정보 저장
  c.set('user', payload)
  
  await next()
}

/**
 * 관리자 권한 미들웨어
 */
export async function adminMiddleware(c: Context, next: Next) {
  const user = c.get('user')
  
  if (!user || user.role !== 'admin') {
    return c.json(errorResponse('관리자 권한이 필요합니다.'), 403)
  }
  
  await next()
}
