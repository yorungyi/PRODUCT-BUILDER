-- 노스팜CC 일매출 관리 시스템 초기 스키마
-- 작성일: 2026-01-27

-- 1. 사용자 테이블
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL, -- bcrypt 해시
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'staff', -- 'admin' 또는 'staff'
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 기본 관리자 계정 (비밀번호: admin1234)
INSERT OR IGNORE INTO users (username, password, name, role) VALUES 
  ('admin', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', '관리자', 'admin');

-- 2. 점포 구분 테이블
CREATE TABLE IF NOT EXISTS stores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  display_order INTEGER NOT NULL,
  is_active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 4개 점포 초기 데이터
INSERT OR IGNORE INTO stores (code, name, display_order) VALUES 
  ('clubhouse', '클럽하우스', 1),
  ('starthouse', '스타트하우스', 2),
  ('east_shade', '동그늘집', 3),
  ('west_shade', '서그늘집', 4);

-- 3. 일매출 테이블
CREATE TABLE IF NOT EXISTS daily_sales (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sale_date DATE NOT NULL, -- 매출 날짜
  store_id INTEGER NOT NULL, -- 점포 ID
  amount REAL NOT NULL, -- 매출액
  memo TEXT, -- 메모
  is_closed INTEGER DEFAULT 0, -- 마감 여부 (0: 미마감, 1: 마감)
  closed_at DATETIME, -- 마감 시각
  closed_by INTEGER, -- 마감한 사용자 ID
  created_by INTEGER NOT NULL, -- 등록한 사용자 ID
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (store_id) REFERENCES stores(id),
  FOREIGN KEY (closed_by) REFERENCES users(id),
  FOREIGN KEY (created_by) REFERENCES users(id),
  UNIQUE(sale_date, store_id) -- 같은 날짜, 같은 점포는 하나만
);

-- 4. 마감 이력 테이블 (감사 추적)
CREATE TABLE IF NOT EXISTS closing_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  daily_sales_id INTEGER NOT NULL,
  action TEXT NOT NULL, -- 'close' 또는 'reopen'
  performed_by INTEGER NOT NULL, -- 작업 수행자 ID
  performed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  reason TEXT, -- 재개방 사유 (관리자가 마감 해제 시)
  FOREIGN KEY (daily_sales_id) REFERENCES daily_sales(id),
  FOREIGN KEY (performed_by) REFERENCES users(id)
);

-- 5. 세션 테이블 (JWT 토큰 관리)
CREATE TABLE IF NOT EXISTS sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  token TEXT UNIQUE NOT NULL,
  expires_at DATETIME NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- 인덱스 생성 (성능 최적화)
CREATE INDEX IF NOT EXISTS idx_daily_sales_date ON daily_sales(sale_date);
CREATE INDEX IF NOT EXISTS idx_daily_sales_store ON daily_sales(store_id);
CREATE INDEX IF NOT EXISTS idx_daily_sales_closed ON daily_sales(is_closed);
CREATE INDEX IF NOT EXISTS idx_daily_sales_date_store ON daily_sales(sale_date, store_id);
CREATE INDEX IF NOT EXISTS idx_closing_history_sales ON closing_history(daily_sales_id);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

-- 뷰: 매출 상세 정보 (조인 결과)
CREATE VIEW IF NOT EXISTS v_sales_detail AS
SELECT 
  ds.id,
  ds.sale_date,
  s.code as store_code,
  s.name as store_name,
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
INNER JOIN users u_created ON ds.created_by = u_created.id;

-- 뷰: 월별 점포별 매출 집계
CREATE VIEW IF NOT EXISTS v_monthly_sales_summary AS
SELECT 
  strftime('%Y-%m', sale_date) as year_month,
  strftime('%Y', sale_date) as year,
  s.code as store_code,
  s.name as store_name,
  COUNT(*) as sales_count,
  SUM(amount) as total_amount,
  AVG(amount) as avg_amount,
  MIN(amount) as min_amount,
  MAX(amount) as max_amount
FROM daily_sales ds
INNER JOIN stores s ON ds.store_id = s.id
GROUP BY year_month, s.code, s.name;

-- 뷰: 연도별 점포별 매출 집계
CREATE VIEW IF NOT EXISTS v_yearly_sales_summary AS
SELECT 
  strftime('%Y', sale_date) as year,
  s.code as store_code,
  s.name as store_name,
  COUNT(*) as sales_count,
  SUM(amount) as total_amount,
  AVG(amount) as avg_amount
FROM daily_sales ds
INNER JOIN stores s ON ds.store_id = s.id
GROUP BY year, s.code, s.name;
