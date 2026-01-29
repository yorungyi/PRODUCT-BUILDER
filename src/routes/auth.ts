// 인증 관련 API 라우트
import { Hono } from 'hono'
import { setCookie } from 'hono/cookie'
import { verifyPassword, hashPassword } from '../utils/password'
import { generateToken } from '../utils/jwt'
import { successResponse, errorResponse } from '../utils/response'

type Bindings = {
  DB: D1Database
}

const auth = new Hono<{ Bindings: Bindings }>()

/**
 * POST /api/auth/login
 * 로그인 - 사용자 인증 및 JWT 발급
 */
auth.post('/login', async (c) => {
  try {
    const { username, password } = await c.req.json()
    
    if (!username || !password) {
      return c.json(errorResponse('아이디와 비밀번호를 입력해주세요.'), 400)
    }
    
    // 사용자 조회
    const user = await c.env.DB.prepare(
      'SELECT id, username, password, name, role FROM users WHERE username = ?'
    ).bind(username).first()
    
    if (!user) {
      return c.json(errorResponse('아이디 또는 비밀번호가 올바르지 않습니다.'), 401)
    }
    
    // 비밀번호 검증
    const isValid = await verifyPassword(password, user.password as string)
    
    if (!isValid) {
      return c.json(errorResponse('아이디 또는 비밀번호가 올바르지 않습니다.'), 401)
    }
    
    // JWT 토큰 생성
    const token = await generateToken(
      user.id as number,
      user.username as string,
      user.role as string
    )
    
    // 쿠키에 토큰 저장 (HttpOnly, Secure)
    setCookie(c, 'auth_token', token, {
      httpOnly: true,
      secure: true,
      sameSite: 'Strict',
      maxAge: 60 * 60 * 24 * 7 // 7일
    })
    
    // 세션 DB에 저장
    await c.env.DB.prepare(
      'INSERT INTO sessions (user_id, token, expires_at) VALUES (?, ?, datetime("now", "+7 days"))'
    ).bind(user.id, token).run()
    
    return c.json(successResponse({
      token,
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        role: user.role
      }
    }, '로그인 성공'))
    
  } catch (error) {
    console.error('Login error:', error)
    return c.json(errorResponse('로그인 처리 중 오류가 발생했습니다.'), 500)
  }
})

/**
 * POST /api/auth/logout
 * 로그아웃 - 세션 삭제
 */
auth.post('/logout', async (c) => {
  try {
    const authHeader = c.req.header('Authorization')
    const token = authHeader?.replace('Bearer ', '')
    
    if (token) {
      // 세션 DB에서 삭제
      await c.env.DB.prepare(
        'DELETE FROM sessions WHERE token = ?'
      ).bind(token).run()
    }
    
    // 쿠키 삭제
    setCookie(c, 'auth_token', '', {
      maxAge: 0
    })
    
    return c.json(successResponse(null, '로그아웃 되었습니다.'))
    
  } catch (error) {
    console.error('Logout error:', error)
    return c.json(errorResponse('로그아웃 처리 중 오류가 발생했습니다.'), 500)
  }
})

/**
 * GET /api/auth/me
 * 현재 로그인한 사용자 정보 조회
 */
auth.get('/me', async (c) => {
  try {
    const authHeader = c.req.header('Authorization')
    const token = authHeader?.replace('Bearer ', '')
    
    if (!token) {
      return c.json(errorResponse('로그인이 필요합니다.'), 401)
    }
    
    // 세션 조회
    const session = await c.env.DB.prepare(`
      SELECT u.id, u.username, u.name, u.role 
      FROM sessions s
      INNER JOIN users u ON s.user_id = u.id
      WHERE s.token = ? AND s.expires_at > datetime('now')
    `).bind(token).first()
    
    if (!session) {
      return c.json(errorResponse('유효하지 않은 세션입니다.'), 401)
    }
    
    return c.json(successResponse({
      id: session.id,
      username: session.username,
      name: session.name,
      role: session.role
    }))
    
  } catch (error) {
    console.error('Get user error:', error)
    return c.json(errorResponse('사용자 정보 조회 중 오류가 발생했습니다.'), 500)
  }
})

/**
 * POST /api/auth/change-password
 * 비밀번호 변경
 */
auth.post('/change-password', async (c) => {
  try {
    const authHeader = c.req.header('Authorization')
    const token = authHeader?.replace('Bearer ', '')
    
    if (!token) {
      return c.json(errorResponse('로그인이 필요합니다.'), 401)
    }
    
    const { currentPassword, newPassword } = await c.req.json()
    
    if (!currentPassword || !newPassword) {
      return c.json(errorResponse('현재 비밀번호와 새 비밀번호를 입력해주세요.'), 400)
    }
    
    if (newPassword.length < 4) {
      return c.json(errorResponse('새 비밀번호는 최소 4자 이상이어야 합니다.'), 400)
    }
    
    // 세션에서 사용자 ID 조회
    const session = await c.env.DB.prepare(`
      SELECT u.id, u.password
      FROM sessions s
      INNER JOIN users u ON s.user_id = u.id
      WHERE s.token = ? AND s.expires_at > datetime('now')
    `).bind(token).first()
    
    if (!session) {
      return c.json(errorResponse('유효하지 않은 세션입니다.'), 401)
    }
    
    // 현재 비밀번호 확인
    const isValid = await verifyPassword(currentPassword, session.password as string)
    
    if (!isValid) {
      return c.json(errorResponse('현재 비밀번호가 올바르지 않습니다.'), 401)
    }
    
    // 새 비밀번호 해시화
    const hashedPassword = await hashPassword(newPassword)
    
    // 비밀번호 업데이트
    await c.env.DB.prepare(`
      UPDATE users 
      SET password = ?, updated_at = datetime('now')
      WHERE id = ?
    `).bind(hashedPassword, session.id).run()
    
    return c.json(successResponse(null, '비밀번호가 변경되었습니다.'))
    
  } catch (error) {
    console.error('Change password error:', error)
    return c.json(errorResponse('비밀번호 변경 중 오류가 발생했습니다.'), 500)
  }
})

export default auth
