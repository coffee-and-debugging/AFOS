-- New restaurants start on the free plan; existing rows keep whatever plan they have.
ALTER TABLE "Restaurant" ALTER COLUMN "plan" SET DEFAULT 'free';
