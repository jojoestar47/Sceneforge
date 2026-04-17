-- Enforce one session row per campaign.
-- Previously every "go live" inserted a new row; now we upsert, so at most
-- one row exists per campaign at any time.

-- Step 1: Remove duplicate rows, keeping the most recently created per campaign.
DELETE FROM sessions
WHERE id NOT IN (
  SELECT DISTINCT ON (campaign_id) id
  FROM sessions
  ORDER BY campaign_id, created_at DESC
);

-- Step 2: Add the unique constraint so upsert can conflict on campaign_id.
ALTER TABLE sessions
  ADD CONSTRAINT sessions_campaign_id_key UNIQUE (campaign_id);
