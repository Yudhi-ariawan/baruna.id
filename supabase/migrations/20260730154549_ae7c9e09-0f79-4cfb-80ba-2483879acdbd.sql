DROP TRIGGER IF EXISTS cer_immutable ON public.completion_evaluation_responses;
CREATE TRIGGER cer_immutable BEFORE INSERT OR UPDATE ON public.completion_evaluation_responses
  FOR EACH ROW EXECUTE FUNCTION public.enforce_completion_evaluation_immutable();