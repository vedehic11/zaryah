-- OTP verification table for phone-based forgot password and phone number changes
CREATE TABLE IF NOT EXISTS otp_verifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  phone VARCHAR(20) NOT NULL,
  otp VARCHAR(6) NOT NULL,
  purpose VARCHAR(30) NOT NULL CHECK (purpose IN ('forgot-password', 'change-phone')),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL, -- optional, set when user is known
  new_phone VARCHAR(20), -- used for change-phone purpose (the new phone being verified)
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '10 minutes'),
  used BOOLEAN NOT NULL DEFAULT FALSE,
  attempts INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast lookup by phone + purpose
CREATE INDEX IF NOT EXISTS idx_otp_verifications_phone_purpose
  ON otp_verifications (phone, purpose);

-- Index for cleanup queries
CREATE INDEX IF NOT EXISTS idx_otp_verifications_expires_at
  ON otp_verifications (expires_at);

-- Auto-delete expired OTPs (optional: run via cron or use a trigger)
-- In production, you may want to add a pg_cron job:
-- SELECT cron.schedule('cleanup-otps', '*/30 * * * *', 'DELETE FROM otp_verifications WHERE expires_at < NOW()');
