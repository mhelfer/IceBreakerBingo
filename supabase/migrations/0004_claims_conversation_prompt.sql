-- Persist the personalized conversation prompt on each claim so it survives
-- the reveal modal being dismissed. For discovery squares the prompt is
-- synthesised at claim time ("Ask Mike about 'hiking'") and was previously
-- only returned in the API response.
alter table claims add column conversation_prompt text;
