CREATE OR REPLACE FUNCTION public.enforce_krf_published_immutable() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_status public.registry_status_v1; v_is_admin boolean;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    SELECT current_status INTO v_status FROM public.knowledge_resources WHERE id = NEW.resource_id;
    IF v_status = 'published' THEN
      IF NEW.file_url IS DISTINCT FROM OLD.file_url
         OR NEW.checksum IS DISTINCT FROM OLD.checksum
         OR NEW.mime_type IS DISTINCT FROM OLD.mime_type
         OR NEW.size_bytes IS DISTINCT FROM OLD.size_bytes THEN
        RAISE EXCEPTION 'file_immutable_after_publication';
      END IF;
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'INSERT' THEN
    SELECT current_status INTO v_status FROM public.knowledge_resources WHERE id = NEW.resource_id;
    IF v_status = 'published' THEN
      v_is_admin := public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'management');
      IF NOT v_is_admin THEN
        RAISE EXCEPTION 'file_add_forbidden_after_publication';
      END IF;
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    SELECT current_status INTO v_status FROM public.knowledge_resources WHERE id = OLD.resource_id;
    IF v_status = 'published' THEN
      v_is_admin := public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'management');
      IF NOT v_is_admin THEN
        RAISE EXCEPTION 'file_delete_forbidden_after_publication';
      END IF;
    END IF;
    RETURN OLD;
  END IF;
  RETURN NULL;
END $$;