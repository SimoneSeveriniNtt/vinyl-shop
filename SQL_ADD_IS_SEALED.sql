-- Add a dedicated sealed flag on vinyls and migrate legacy encoded values.

ALTER TABLE vinyls
ADD COLUMN IF NOT EXISTS is_sealed BOOLEAN NOT NULL DEFAULT false;

-- Mark rows as sealed when legacy condition text contains sealed/sigillato hints.
UPDATE vinyls
SET is_sealed = true
WHERE is_sealed = false
  AND (
    condition ~* '^\s*sealed\b'
    OR condition ~* '\(\s*(sealed|sigillat[oa]?)\s*\)\s*$'
    OR condition ~* '^\s*sigillat[oa]?\b'
  );

-- Remove legacy sealed markers from condition and keep only quality.
UPDATE vinyls
SET condition = TRIM(
  REGEXP_REPLACE(
    REGEXP_REPLACE(condition, '^\s*(sealed|sigillat[oa]?)\s*[-:/|]?\s*', '', 'i'),
    '\s*\((sealed|sigillat[oa]?)\)\s*$',
    '',
    'i'
  )
)
WHERE condition ~* 'sealed|sigillat';

-- Ensure condition remains valid after cleanup.
UPDATE vinyls
SET condition = 'Mint'
WHERE condition IS NULL OR TRIM(condition) = '';

ALTER TABLE vinyls
DROP CONSTRAINT IF EXISTS vinyls_condition_check;

ALTER TABLE vinyls
ADD CONSTRAINT vinyls_condition_check
CHECK (condition IN ('Mint', 'Near Mint', 'Very Good', 'Good', 'Fair', 'Poor'));
