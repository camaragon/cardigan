-- Upgrade the built-in general role; owner-defined roles retain their capabilities.
UPDATE "AgentRole"
SET "capabilities" = array_append("capabilities", 'manage_boards')
WHERE "key" = 'agent' AND NOT ('manage_boards' = ANY("capabilities"));
