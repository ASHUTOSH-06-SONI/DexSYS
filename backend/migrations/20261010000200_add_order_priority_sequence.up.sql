ALTER TABLE orders
    ADD COLUMN priority_sequence BIGSERIAL;

CREATE UNIQUE INDEX orders_priority_sequence_idx
    ON orders (priority_sequence);
