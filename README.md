# 노스팜CC 일매출 관리 시스템

## 프로젝트 개요
- **이름**: 노스팜CC 일매출 관리 시스템 (Northpalm Country Club Sales Management)
- **목표**: 골프장 4개 점포(클럽하우스, 스타트하우스, 동그늘집, 서그늘집)의 일매출을 체계적으로 등록/관리하고, 실시간 대시보드로 매출 현황을 분석하는 F&B 전문 관리 시스템
- **기술스택**: Hono + Cloudflare D1 + TypeScript + TailwindCSS + Chart.js

## 🔗 접속 정보
- **개발 서버**: https://3000-irg0n80vhudz17xtp5hir-a402f90a.sandbox.novita.ai
- **API 엔드포인트**: `/api/*`
- **헬스체크**: `/api/health`

## 🔐 기본 계정
### 관리자 (매출 마감 해제 권한)
- 아이디: `admin`
- 비밀번호: `admin1234` (개발용)

### 직원 (일반 매출 등록/관리)
- 아이디: `staff1` 또는 `staff2`
- 비밀번호: `staff1234` (개발용)

## 📊 주요 기능

### ✅ 완료된 기능
1. **사용자 인증 시스템**
   - JWT 기반 로그인/로그아웃
   - 관리자/직원 권한 구분
   - 세션 관리 (7일 유효기간)

2. **일매출 등록**
   - 날짜별, 점포별 매출 등록
   - 메모 기능 (특이사항 기록)
   - 중복 등록 방지 (같은 날짜+점포)
   - 실시간 입력 검증

3. **매출 수정/삭제**
   - 미마감 매출만 수정 가능
   - 실수 대비 삭제 기능
   - 삭제 전 확인 알림

4. **매출 마감 시스템**
   - 일매출 마감 기능 (수정/삭제 불가)
   - 관리자 전용 마감 해제 (사유 필수)
   - 마감 이력 추적

5. **대시보드**
   - 점포별 매출 합계 (카드 형식)
   - 점포별 매출 비중 (도넛 차트)
   - 최근 7일 매출 추이 (라인 차트)
   - 기간별 조회 (날짜 범위 선택)

6. **매출 내역 조회**
   - 전체 매출 목록 (테이블 형식)
   - 다중 필터 (점포, 마감여부, 날짜범위)
   - 마감 상태 표시 (배지)
   - 등록자 정보 표시

7. **보안**
   - JWT 토큰 인증
   - 비밀번호 bcrypt 암호화
   - SQL Injection 방지
   - CORS 설정
   - HttpOnly 쿠키

### 📈 현재 기능 URI 정리

#### 인증 API
- `POST /api/auth/login` - 로그인
- `POST /api/auth/logout` - 로그아웃
- `GET /api/auth/me` - 현재 사용자 정보

#### 점포 API
- `GET /api/stores` - 점포 목록 조회

#### 매출 API
- `GET /api/sales` - 매출 목록 조회
  - Query: `?startDate=2026-01-01&endDate=2026-01-31&storeId=1&isClosed=false`
- `GET /api/sales/:id` - 매출 상세 조회
- `POST /api/sales` - 매출 등록
- `PUT /api/sales/:id` - 매출 수정 (미마감만)
- `DELETE /api/sales/:id` - 매출 삭제 (미마감만)
- `POST /api/sales/:id/close` - 매출 마감
- `POST /api/sales/:id/reopen` - 매출 마감 해제 (관리자)

#### 집계 API
- `GET /api/sales/summary/monthly` - 월별 집계
- `GET /api/sales/summary/yearly` - 연도별 집계
- `GET /api/sales/summary/dashboard` - 대시보드 종합 데이터

## 💾 데이터 구조

### 주요 테이블
1. **users** - 사용자 정보 (관리자/직원)
2. **stores** - 점포 정보 (4개 점포)
3. **daily_sales** - 일매출 데이터
4. **closing_history** - 마감 이력 (감사 추적)
5. **sessions** - 세션 관리

### 점포 구분
- `clubhouse` - 클럽하우스
- `starthouse` - 스타트하우스
- `east_shade` - 동그늘집
- `west_shade` - 서그늘집

### 데이터 관계
```
users (사용자)
  └─> daily_sales (매출) - created_by, closed_by
        └─> stores (점포) - store_id
        └─> closing_history (마감이력) - daily_sales_id
```

## 🚀 로컬 개발 가이드

### 필수 준비사항
- Node.js 18+
- npm

### 설치 및 실행
```bash
# 의존성 설치
npm install

# 데이터베이스 마이그레이션 (최초 1회)
npm run db:migrate:local

# 테스트 데이터 추가
npm run db:seed

# 빌드
npm run build

# 개발 서버 시작 (PM2)
pm2 start ecosystem.config.cjs

# 서버 상태 확인
pm2 list

# 로그 확인
pm2 logs northpalm-sales --nostream

# 서버 재시작
npm run clean-port
pm2 restart northpalm-sales

# 서버 중지
pm2 stop northpalm-sales
```

### 데이터베이스 관리
```bash
# 데이터베이스 초기화 (모든 데이터 삭제 후 재생성)
npm run db:reset

# SQL 직접 실행 (로컬)
npm run db:console:local -- --command="SELECT * FROM daily_sales"

# 마이그레이션 적용 (로컬)
npm run db:migrate:local

# 마이그레이션 적용 (프로덕션)
npm run db:migrate:prod
```

## 📱 사용자 가이드

### 1. 로그인
- 관리자 또는 직원 계정으로 로그인
- 권한에 따라 기능이 다르게 표시됨

### 2. 대시보드 (홈 화면)
- 4개 점포별 매출 합계 확인
- 기간 선택하여 조회
- 차트로 매출 비중 및 추이 분석

### 3. 매출 등록
- 날짜, 점포, 매출액 입력 (필수)
- 메모 입력 (선택)
- 같은 날짜에 같은 점포는 1건만 등록 가능

### 4. 매출 내역
- 전체 매출 내역 조회
- 점포/상태/날짜 필터링
- 미마감 매출: 수정/삭제/마감 가능
- 마감된 매출: 관리자만 해제 가능

### 5. 매출 마감
- 일매출 확정 시 "마감" 버튼 클릭
- 마감 후에는 수정/삭제 불가
- 관리자만 사유 입력 후 해제 가능

## 🔧 추천 개발 방향

### 우선순위 높음
1. **엑셀 다운로드**: 매출 내역 엑셀 추출 기능
2. **일괄 마감**: 날짜 범위 선택하여 한 번에 마감
3. **목표 설정**: 월별/점포별 목표 매출 설정 및 달성률 표시
4. **알림 기능**: 미마감 매출 알림, 목표 미달 알림

### 중기 계획
1. **통계 확장**: 요일별 패턴, 전년 대비 분석
2. **메뉴별 매출**: 점포 내 메뉴 카테고리별 세부 분석
3. **모바일 최적화**: 반응형 개선
4. **권한 세분화**: 점포별 담당자 권한

### 장기 계획
1. **재고 연동**: 매출-재고 자동 연동
2. **인건비 관리**: 매출 대비 인건비율 분석
3. **원가 분석**: 메뉴별 원가율 계산
4. **경영 리포트**: 일/주/월 자동 리포트 생성

## 🛠️ 기술 세부사항

### 백엔드
- **프레임워크**: Hono (경량 Edge Framework)
- **데이터베이스**: Cloudflare D1 (SQLite 기반)
- **인증**: JWT (hono/jwt)
- **암호화**: bcryptjs
- **배포**: Cloudflare Pages

### 프론트엔드
- **UI**: TailwindCSS (CDN)
- **차트**: Chart.js 4.x
- **아이콘**: Font Awesome 6.x
- **API 통신**: Fetch API

### 보안
- JWT 토큰 (7일 유효)
- 비밀번호 bcrypt 해싱
- SQL Prepared Statements
- HttpOnly 쿠키
- CORS 설정

## 📊 배포 상태
- **플랫폼**: Cloudflare Pages (준비 중)
- **현재 상태**: 로컬 개발 완료 ✅
- **마지막 업데이트**: 2026-01-27

## 📞 문의
F&B 매니저 (파주 노스팜CC)

---

## 개발 노트

### 실무 F&B 시스템 특화 기능
1. **마감 시스템**: 회계 마감 개념 도입, 수정 방지
2. **관리자 권한**: 이중 검증 체계
3. **메모 기능**: 특이사항 기록 (단체 예약, 행사 등)
4. **점포별 집계**: 실시간 성과 비교
5. **이력 추적**: 누가, 언제, 무엇을 변경했는지 감사

### 데이터 무결성
- 날짜+점포 UNIQUE 제약
- 외래키 관계 설정
- 트랜잭션 처리
- 입력값 검증

### 성능 최적화
- 인덱스 최적화 (날짜, 점포, 마감여부)
- View 활용 (집계 쿼리)
- Prepared Statements
- 클라이언트 캐싱 (localStorage)
