UPDATE public.course_offerings
SET cohort_financial_model = 'fee_based'
WHERE learning_model = 'cohort_based' AND cohort_financial_model IS NULL;

ALTER TABLE public.course_offerings
  DROP CONSTRAINT IF EXISTS course_offerings_cohort_financial_model_chk;
ALTER TABLE public.course_offerings
  ADD CONSTRAINT course_offerings_cohort_financial_model_chk
  CHECK (
    CASE
      WHEN learning_model = 'cohort_based'
        THEN cohort_financial_model IS NOT DISTINCT FROM 'fee_based'::public.cohort_financial_model_v1
      ELSE cohort_financial_model IS NULL
    END
  );