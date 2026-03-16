-- Remove phone OTP infrastructure
-- Safe to run multiple times

DROP INDEX IF EXISTS idx_otp_verifications_phone_purpose;
DROP INDEX IF EXISTS idx_otp_verifications_expires_at;
DROP TABLE IF EXISTS otp_verifications;
