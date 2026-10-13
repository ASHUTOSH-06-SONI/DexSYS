DROP INDEX IF EXISTS orders_owner_status_created_idx;

ALTER TABLE orders
    DROP COLUMN IF EXISTS owner_principal_id;

DROP TABLE IF EXISTS auth_principals;
