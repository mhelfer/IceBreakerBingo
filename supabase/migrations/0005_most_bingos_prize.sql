alter type prize_kind add value if not exists 'most_bingos';

-- Drop the legacy fastest_bingo award from the first live run so the
-- facilitator results page no longer surfaces it.
delete from prize_awards where prize = 'fastest_bingo';
