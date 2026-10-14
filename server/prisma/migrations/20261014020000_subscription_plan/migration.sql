-- Subscription plan for feature gating. Existing restaurants keep full access (pro).
ALTER TABLE "Restaurant" ADD COLUMN IF NOT EXISTS "plan" TEXT NOT NULL DEFAULT 'pro';
