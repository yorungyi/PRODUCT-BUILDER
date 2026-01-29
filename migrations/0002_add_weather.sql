-- 날씨 필드 추가 마이그레이션
ALTER TABLE daily_sales ADD COLUMN weather TEXT DEFAULT '맑음' CHECK(weather IN ('맑음', '흐림', '비', '눈', '휴장'));

-- 기존 데이터에 기본값 설정
UPDATE daily_sales SET weather = '맑음' WHERE weather IS NULL;
