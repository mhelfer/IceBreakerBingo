-- When false (default), scans return 1 random eligible square.
-- When true, scans return all eligible squares and the player picks.
alter table events add column show_all_matches boolean not null default false;
