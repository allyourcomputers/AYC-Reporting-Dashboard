-- Clear the automatic mappings created during migration
-- This allows HaloPSA clients to be properly assigned to real companies

-- Delete all HaloPSA client mappings from Default Company
DELETE FROM company_halopsa_clients
WHERE company_id = '00000000-0000-0000-0000-000000000001'::UUID;

-- Optionally, you can also delete the Default Company entirely
-- Uncomment the line below if you want to remove it:
-- DELETE FROM companies WHERE id = '00000000-0000-0000-0000-000000000001'::UUID;
