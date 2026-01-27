// JWT 토큰 생성 및 검증 유틸리티
import { sign, verify } from 'hono/jwt'

export interface JWTPayload {
  userId: number
  username: string
  role: string
  exp: number
}

const JWT_SECRET = process.env.JWT_SECRET || 'northpalm-cc-secret-key-change-in-production'

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
  return await sign(payload, JWT_SECRET)
}

/**
 * JWT 토큰 검증
 */
export async function verifyToken(token: string): Promise<JWTPayload | null> {
  try {
    const payload = await verify(token, JWT_SECRET) as JWTPayload
    return payload
  } catch (error) {
    return null
  }
}
