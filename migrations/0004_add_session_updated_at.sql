-- 세션 활동 시간 추적을 위한 updated_at 컬럼 추가

-- sessions 테이블에 updated_at 추가 (기본값 없이)
ALTER TABLE sessions ADD COLUMN updated_at DATETIME;

-- 기존 세션 데이터의 updated_at 초기화 (현재 시간으로)
UPDATE sessions SET updated_at = datetime('now') WHERE updated_at IS NULL;

-- 인덱스 추가 (성능 향상)
CREATE INDEX IF NOT EXISTS idx_sessions_updated_at ON sessions(updated_at);
CREATE INDEX IF NOT EXISTS idx_active_sessions_last_activity ON active_sessions(last_activity);
