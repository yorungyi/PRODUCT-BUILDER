// JWT 토큰 생성 및 검증 유틸리티
import { sign, verify } from 'hono/jwt'

export interface JWTPayload {
  userId: number
  username: string
  role: string
  exp: number
}

// Cloudflare Workers 환경에서는 process.env 사용 불가
// 프로덕션에서는 wrangler.jsonc의 vars 또는 secrets 사용
const JWT_SECRET = 'northpalm-cc-secret-key-2026-change-in-production-env'
const JWT_ALGORITHM = 'HS256' // HMAC SHA-256

/**
 * JWT 토큰 생성
 */
export async function generateToken(userId: number, username: string, role: string): Promise<string> {
  const payload: JWTPayload = {
    userId,
    username,
    role,
    exp: Math.floor(Date.now() / 1000) + (60 * 60 * 24 * 7) // 7일 유효
  }
  return await sign(payload, JWT_SECRET, JWT_ALGORITHM)
}

/**
 * JWT 토큰 검증
 */
export async function verifyToken(token: string): Promise<JWTPayload | null> {
  try {
    const payload = await verify(token, JWT_SECRET, JWT_ALGORITHM) as JWTPayload
    return payload
  } catch (error) {
    console.error('[JWT] 토큰 검증 실패:', error)
    return null
  }
}
