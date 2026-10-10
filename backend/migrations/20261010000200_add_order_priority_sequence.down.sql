DROP INDEX orders_priority_sequence_idx;

ALTER TABLE orders
    DROP COLUMN priority_sequence;
