-- Dynamic CMS: two more page blocks (kurikulum 3.1; CATATAN_PERBAIKAN 2bs).
--   media   = heading + text beside one image (image left or right), as in the About opening;
--   gallery = 1-8 photos in a row with optional captions.
-- Only the block check _cms_block_problem changes; it is replaced whole (same signature),
-- so the seven existing block types keep exactly the same rules. No table changes.
-- Safe to run more than once.

CREATE OR REPLACE FUNCTION public._cms_block_problem(_b jsonb, _domain text)
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_type text := _b->>'type'; v_item jsonb; v_n integer;
BEGIN
  IF jsonb_typeof(_b) IS DISTINCT FROM 'object' THEN RETURN 'cms_block_invalid'; END IF;
  IF v_type = 'banner' THEN
    IF NOT public._cms_s(_b, 'title_id', 2, 160) OR NOT public._cms_s(_b, 'title_en', 0, 160) THEN RETURN 'cms_block_title_invalid'; END IF;
    IF NOT public._cms_s(_b, 'text_id', 0, 1000) OR NOT public._cms_s(_b, 'text_en', 0, 1000) THEN RETURN 'cms_block_text_invalid'; END IF;
    IF NOT public._cms_image_ok(_b, 'image') THEN RETURN 'cms_block_image_invalid'; END IF;
    IF _b ? 'stats' AND jsonb_typeof(_b->'stats') <> 'null' THEN
      IF jsonb_typeof(_b->'stats') <> 'array' OR jsonb_array_length(_b->'stats') > 4 THEN RETURN 'cms_block_stats_invalid'; END IF;
      FOR v_item IN SELECT * FROM jsonb_array_elements(_b->'stats') LOOP
        IF NOT public._cms_s(v_item, 'label_id', 1, 60) OR NOT public._cms_s(v_item, 'label_en', 0, 60)
           OR NOT public._cms_s(v_item, 'value', 1, 30) THEN RETURN 'cms_block_stats_invalid'; END IF;
      END LOOP;
    END IF;
  ELSIF v_type = 'text' THEN
    IF NOT public._cms_s(_b, 'heading_id', 0, 160) OR NOT public._cms_s(_b, 'heading_en', 0, 160) THEN RETURN 'cms_block_title_invalid'; END IF;
    IF NOT public._cms_s(_b, 'body_id', 1, 5000) OR NOT public._cms_s(_b, 'body_en', 0, 5000) THEN RETURN 'cms_block_text_invalid'; END IF;
  ELSIF v_type = 'cards' THEN
    IF NOT public._cms_s(_b, 'heading_id', 0, 160) OR NOT public._cms_s(_b, 'heading_en', 0, 160) THEN RETURN 'cms_block_title_invalid'; END IF;
    IF jsonb_typeof(_b->'items') IS DISTINCT FROM 'array' THEN RETURN 'cms_block_items_invalid'; END IF;
    v_n := jsonb_array_length(_b->'items');
    IF v_n < 1 OR v_n > 12 THEN RETURN 'cms_block_items_invalid'; END IF;
    FOR v_item IN SELECT * FROM jsonb_array_elements(_b->'items') LOOP
      IF jsonb_typeof(v_item) IS DISTINCT FROM 'object' THEN RETURN 'cms_block_items_invalid'; END IF;
      IF NOT public._cms_s(v_item, 'title_id', 2, 160) OR NOT public._cms_s(v_item, 'title_en', 0, 160) THEN RETURN 'cms_block_title_invalid'; END IF;
      IF NOT public._cms_s(v_item, 'text_id', 0, 600) OR NOT public._cms_s(v_item, 'text_en', 0, 600) THEN RETURN 'cms_block_text_invalid'; END IF;
      IF NOT public._cms_image_ok(v_item, 'image') THEN RETURN 'cms_block_image_invalid'; END IF;
      IF NOT public._cms_s(v_item, 'url', 0, 500) OR (COALESCE(btrim(v_item->>'url'), '') <> '' AND NOT public._cms_url_ok(btrim(v_item->>'url'))) THEN
        RETURN 'cms_block_url_invalid';
      END IF;
    END LOOP;
  ELSIF v_type = 'cta' THEN
    IF NOT public._cms_s(_b, 'title_id', 2, 160) OR NOT public._cms_s(_b, 'title_en', 0, 160) THEN RETURN 'cms_block_title_invalid'; END IF;
    IF NOT public._cms_s(_b, 'text_id', 0, 600) OR NOT public._cms_s(_b, 'text_en', 0, 600) THEN RETURN 'cms_block_text_invalid'; END IF;
    IF NOT public._cms_s(_b, 'button_id', 1, 60) OR NOT public._cms_s(_b, 'button_en', 0, 60) THEN RETURN 'cms_block_button_invalid'; END IF;
    IF NOT public._cms_url_ok(btrim(COALESCE(_b->>'url', ''))) THEN RETURN 'cms_block_url_invalid'; END IF;
  ELSIF v_type = 'faq' THEN
    IF NOT public._cms_s(_b, 'heading_id', 0, 160) OR NOT public._cms_s(_b, 'heading_en', 0, 160) THEN RETURN 'cms_block_title_invalid'; END IF;
    IF jsonb_typeof(_b->'items') IS DISTINCT FROM 'array' THEN RETURN 'cms_block_items_invalid'; END IF;
    v_n := jsonb_array_length(_b->'items');
    IF v_n < 1 OR v_n > 20 THEN RETURN 'cms_block_items_invalid'; END IF;
    FOR v_item IN SELECT * FROM jsonb_array_elements(_b->'items') LOOP
      IF NOT public._cms_s(v_item, 'q_id', 2, 300) OR NOT public._cms_s(v_item, 'q_en', 0, 300)
         OR NOT public._cms_s(v_item, 'a_id', 1, 2000) OR NOT public._cms_s(v_item, 'a_en', 0, 2000) THEN
        RETURN 'cms_block_items_invalid';
      END IF;
    END LOOP;
  ELSIF v_type = 'links' THEN
    IF NOT public._cms_s(_b, 'heading_id', 0, 160) OR NOT public._cms_s(_b, 'heading_en', 0, 160) THEN RETURN 'cms_block_title_invalid'; END IF;
    IF jsonb_typeof(_b->'items') IS DISTINCT FROM 'array' THEN RETURN 'cms_block_items_invalid'; END IF;
    v_n := jsonb_array_length(_b->'items');
    IF v_n < 1 OR v_n > 20 THEN RETURN 'cms_block_items_invalid'; END IF;
    FOR v_item IN SELECT * FROM jsonb_array_elements(_b->'items') LOOP
      IF NOT public._cms_s(v_item, 'label_id', 1, 160) OR NOT public._cms_s(v_item, 'label_en', 0, 160) THEN RETURN 'cms_block_items_invalid'; END IF;
      IF NOT public._cms_url_ok(btrim(COALESCE(v_item->>'url', ''))) THEN RETURN 'cms_block_url_invalid'; END IF;
    END LOOP;
  ELSIF v_type = 'media' THEN
    -- Text beside an image (image left or right), like the opening section of About.
    IF NOT public._cms_s(_b, 'heading_id', 0, 160) OR NOT public._cms_s(_b, 'heading_en', 0, 160) THEN RETURN 'cms_block_title_invalid'; END IF;
    IF NOT public._cms_s(_b, 'body_id', 1, 5000) OR NOT public._cms_s(_b, 'body_en', 0, 5000) THEN RETURN 'cms_block_text_invalid'; END IF;
    IF COALESCE(btrim(_b->>'image'), '') = '' THEN RETURN 'cms_block_image_required'; END IF;
    IF NOT public._cms_image_ok(_b, 'image') THEN RETURN 'cms_block_image_invalid'; END IF;
    IF _b ? 'image_side' AND jsonb_typeof(_b->'image_side') <> 'null'
       AND (jsonb_typeof(_b->'image_side') <> 'string' OR _b->>'image_side' NOT IN ('left', 'right')) THEN
      RETURN 'cms_block_invalid';
    END IF;
  ELSIF v_type = 'gallery' THEN
    -- 1-8 photos in a row, each with an optional caption.
    IF NOT public._cms_s(_b, 'heading_id', 0, 160) OR NOT public._cms_s(_b, 'heading_en', 0, 160) THEN RETURN 'cms_block_title_invalid'; END IF;
    IF jsonb_typeof(_b->'items') IS DISTINCT FROM 'array' THEN RETURN 'cms_block_items_invalid'; END IF;
    v_n := jsonb_array_length(_b->'items');
    IF v_n < 1 OR v_n > 8 THEN RETURN 'cms_block_items_invalid'; END IF;
    FOR v_item IN SELECT * FROM jsonb_array_elements(_b->'items') LOOP
      IF jsonb_typeof(v_item) IS DISTINCT FROM 'object' THEN RETURN 'cms_block_items_invalid'; END IF;
      IF COALESCE(btrim(v_item->>'image'), '') = '' THEN RETURN 'cms_block_image_required'; END IF;
      IF NOT public._cms_image_ok(v_item, 'image') THEN RETURN 'cms_block_image_invalid'; END IF;
      IF NOT public._cms_s(v_item, 'caption_id', 0, 160) OR NOT public._cms_s(v_item, 'caption_en', 0, 160) THEN RETURN 'cms_block_text_invalid'; END IF;
    END LOOP;
  ELSIF v_type = 'form' THEN
    IF NOT EXISTS (SELECT 1 FROM public.cms_forms f WHERE f.slug = btrim(COALESCE(_b->>'form_slug', ''))
                    AND f.domain = _domain AND f.status <> 'archived') THEN
      RETURN 'cms_block_form_unknown';
    END IF;
  ELSE
    RETURN 'cms_block_type_invalid';
  END IF;
  RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION public._cms_block_problem(jsonb, text) FROM PUBLIC, anon, authenticated;
