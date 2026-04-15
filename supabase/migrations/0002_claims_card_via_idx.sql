-- Composite index for the reuse-policy check hot path.
-- The claim route queries claims by (card_id, via_player_id) on every claim
-- attempt when reuse is locked.
create index claims_card_via_idx on claims (card_id, via_player_id);
