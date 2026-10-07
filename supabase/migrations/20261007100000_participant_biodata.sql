-- Migration: 20261007100000_participant_biodata.sql
-- Description: Official Participant Biodata and Registration (Puslat KP & PB-ACA-03)
-- Collects complete civil service / participant identity + formal photo for official course enrollments & certificates.

CREATE TABLE IF NOT EXISTS public.participant_biodata (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nama text NOT NULL,
  nip text NOT NULL,
  tempat_lahir text NOT NULL,
  tanggal_lahir date NOT NULL,
  jenis_kelamin text NOT NULL,
  agama text NOT NULL,
  jabatan text NOT NULL,
  pangkat_golongan text NOT NULL,
  pendidikan_terakhir text NOT NULL,
  no_hp text NOT NULL,
  unit_eselon_1 text NOT NULL,
  instansi_unit_kerja text NOT NULL,
  alamat_kantor text NOT NULL,
  provinsi text NOT NULL,
  kabupaten_kota text NOT NULL,
  foto_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT participant_biodata_user_id_unique UNIQUE (user_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_participant_biodata_user_id ON public.participant_biodata(user_id);
CREATE INDEX IF NOT EXISTS idx_participant_biodata_nip ON public.participant_biodata(nip);
CREATE INDEX IF NOT EXISTS idx_participant_biodata_unit_eselon ON public.participant_biodata(unit_eselon_1);

-- Enable RLS
ALTER TABLE public.participant_biodata ENABLE ROW LEVEL SECURITY;

-- Grants
GRANT SELECT, INSERT, UPDATE ON public.participant_biodata TO authenticated;
GRANT ALL ON public.participant_biodata TO service_role;

-- RLS Policies
-- 1. Users can view their own participant biodata
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'participant_biodata' AND policyname = 'participant_biodata_own_read'
  ) THEN
    CREATE POLICY "participant_biodata_own_read"
      ON public.participant_biodata
      FOR SELECT
      TO authenticated
      USING (auth.uid() = user_id);
  END IF;
END $$;

-- 2. Users can insert their own participant biodata
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'participant_biodata' AND policyname = 'participant_biodata_own_insert'
  ) THEN
    CREATE POLICY "participant_biodata_own_insert"
      ON public.participant_biodata
      FOR INSERT
      TO authenticated
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- 3. Users can update their own participant biodata
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'participant_biodata' AND policyname = 'participant_biodata_own_update'
  ) THEN
    CREATE POLICY "participant_biodata_own_update"
      ON public.participant_biodata
      FOR UPDATE
      TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- 4. Admins & Operators can view all participant biodata for enrollment & certificate verification
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'participant_biodata' AND policyname = 'participant_biodata_admin_read'
  ) THEN
    CREATE POLICY "participant_biodata_admin_read"
      ON public.participant_biodata
      FOR SELECT
      TO authenticated
      USING (
        public.has_rbac_role(auth.uid(), 'super_admin')
        OR public.has_rbac_role(auth.uid(), 'admin')
        OR public.has_rbac_role(auth.uid(), 'operator')
        OR public.has_rbac_role(auth.uid(), 'reviewer')
      );
  END IF;
END $$;
