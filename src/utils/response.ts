// API 응답 표준화 유틸리티
export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

/**
 * 성공 응답
 */
export function successResponse<T>(data: T, message?: string): ApiResponse<T> {
  return {
    success: true,
    data,
    message
  }
}

/**
 * 에러 응답
 */
export function errorResponse(error: string, message?: string): ApiResponse {
  return {
    success: false,
    error,
    message: message || error
  }
}

/**
 * SQL Injection 방지를 위한 입력 검증
 */
export function sanitizeInput(input: string): string {
  // 기본적인 SQL 키워드 제거
  return input.replace(/[';\-\-]/g, '')
}

/**
 * 날짜 형식 검증 (YYYY-MM-DD)
 */
export function isValidDate(dateString: string): boolean {
  const regex = /^\d{4}-\d{2}-\d{2}$/
  if (!regex.test(dateString)) return false
  
  const date = new Date(dateString)
  return date instanceof Date && !isNaN(date.getTime())
}

/**
 * 금액 검증
 */
export function isValidAmount(amount: number): boolean {
  return typeof amount === 'number' && amount >= 0 && amount < 100000000
}
