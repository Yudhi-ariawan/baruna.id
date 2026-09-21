export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      admin_audit_log: {
        Row: {
          actor_id: string | null
          after_data: Json | null
          before_data: Json | null
          created_at: string
          entity_id: string | null
          entity_type: string
          event_type: string
          id: string
          metadata: Json
          target_user_id: string | null
        }
        Insert: {
          actor_id?: string | null
          after_data?: Json | null
          before_data?: Json | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          event_type: string
          id?: string
          metadata?: Json
          target_user_id?: string | null
        }
        Update: {
          actor_id?: string | null
          after_data?: Json | null
          before_data?: Json | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          event_type?: string
          id?: string
          metadata?: Json
          target_user_id?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          id: string
          is_active: boolean
          job_title: string | null
          organization: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id: string
          is_active?: boolean
          job_title?: string | null
          organization?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          is_active?: boolean
          job_title?: string | null
          organization?: string | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      rbac_role_change_requests: {
        Row: {
          action: string
          applied_at: string | null
          created_at: string
          decision_note: string | null
          id: string
          reason: string
          requested_by: string
          requested_valid_from: string
          requested_valid_until: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          role_id: string
          scope: Json
          status: string
          target_user_id: string
          updated_at: string
        }
        Insert: {
          action: string
          applied_at?: string | null
          created_at?: string
          decision_note?: string | null
          id?: string
          reason: string
          requested_by: string
          requested_valid_from?: string
          requested_valid_until?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          role_id: string
          scope?: Json
          status?: string
          target_user_id: string
          updated_at?: string
        }
        Update: {
          action?: string
          applied_at?: string | null
          created_at?: string
          decision_note?: string | null
          id?: string
          reason?: string
          requested_by?: string
          requested_valid_from?: string
          requested_valid_until?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          role_id?: string
          scope?: Json
          status?: string
          target_user_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rbac_role_change_requests_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "rbac_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      rbac_user_roles: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          granted_by: string | null
          id: string
          is_primary: boolean
          reason: string | null
          revoked_at: string | null
          revoked_by: string | null
          role_id: string
          scope: Json
          status: string
          user_id: string
          valid_from: string
          valid_until: string | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          granted_by?: string | null
          id?: string
          is_primary?: boolean
          reason?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          role_id: string
          scope?: Json
          status?: string
          user_id: string
          valid_from?: string
          valid_until?: string | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          granted_by?: string | null
          id?: string
          is_primary?: boolean
          reason?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          role_id?: string
          scope?: Json
          status?: string
          user_id?: string
          valid_from?: string
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rbac_user_roles_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "rbac_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      rbac_roles: {
        Row: {
          code: string
          created_at: string
          description: string | null
          id: string
          is_system: boolean
          name: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          id?: string
          is_system?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          is_system?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      certificates: {
        Row: {
          certificate_number: string
          certificate_status: string
          certificate_type: string
          course_offering_id: string
          created_at: string
          enrolment_id: string
          id: string
          issue_date: string
          learner_id: string
          legacy_certificate_id: string | null
          source_system: string | null
          verification_reference: string
        }
        Insert: {
          certificate_number: string
          certificate_status?: string
          certificate_type: string
          course_offering_id: string
          created_at?: string
          enrolment_id: string
          id?: string
          issue_date?: string
          learner_id: string
          legacy_certificate_id?: string | null
          source_system?: string | null
          verification_reference: string
        }
        Update: {
          certificate_number?: string
          certificate_status?: string
          certificate_type?: string
          course_offering_id?: string
          created_at?: string
          enrolment_id?: string
          id?: string
          issue_date?: string
          learner_id?: string
          legacy_certificate_id?: string | null
          source_system?: string | null
          verification_reference?: string
        }
        Relationships: [
          {
            foreignKeyName: "certificates_course_offering_id_fkey"
            columns: ["course_offering_id"]
            isOneToOne: false
            referencedRelation: "course_offering_classification_public_v"
            referencedColumns: ["course_offering_id"]
          },
          {
            foreignKeyName: "certificates_course_offering_id_fkey"
            columns: ["course_offering_id"]
            isOneToOne: false
            referencedRelation: "course_offering_classification_review_v"
            referencedColumns: ["course_offering_id"]
          },
          {
            foreignKeyName: "certificates_course_offering_id_fkey"
            columns: ["course_offering_id"]
            isOneToOne: false
            referencedRelation: "course_offering_financial_internal_v"
            referencedColumns: ["course_offering_id"]
          },
          {
            foreignKeyName: "certificates_course_offering_id_fkey"
            columns: ["course_offering_id"]
            isOneToOne: false
            referencedRelation: "course_offerings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "certificates_enrolment_id_fkey"
            columns: ["enrolment_id"]
            isOneToOne: false
            referencedRelation: "enrolments"
            referencedColumns: ["id"]
          },
        ]
      }
      completion_evaluation_questions: {
        Row: {
          active: boolean
          category: string | null
          choices: Json
          created_at: string
          display_order: number
          help_text: string | null
          id: string
          is_required: boolean
          question_text: string
          question_type: string
          rating_max: number | null
          rating_min: number | null
          template_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          category?: string | null
          choices?: Json
          created_at?: string
          display_order?: number
          help_text?: string | null
          id?: string
          is_required?: boolean
          question_text: string
          question_type: string
          rating_max?: number | null
          rating_min?: number | null
          template_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          category?: string | null
          choices?: Json
          created_at?: string
          display_order?: number
          help_text?: string | null
          id?: string
          is_required?: boolean
          question_text?: string
          question_type?: string
          rating_max?: number | null
          rating_min?: number | null
          template_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "completion_evaluation_questions_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "completion_evaluation_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      completion_evaluation_responses: {
        Row: {
          created_at: string
          id: string
          question_id: string
          submission_id: string
          updated_at: string
          value_bool: boolean | null
          value_choices: string[] | null
          value_number: number | null
          value_text: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          question_id: string
          submission_id: string
          updated_at?: string
          value_bool?: boolean | null
          value_choices?: string[] | null
          value_number?: number | null
          value_text?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          question_id?: string
          submission_id?: string
          updated_at?: string
          value_bool?: boolean | null
          value_choices?: string[] | null
          value_number?: number | null
          value_text?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "completion_evaluation_responses_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "completion_evaluation_questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "completion_evaluation_responses_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "completion_evaluation_submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      completion_evaluation_submissions: {
        Row: {
          context: string
          course_offering_id: string
          created_at: string
          draft_version: number
          enrolment_id: string
          id: string
          started_at: string
          status: string
          submitted_at: string | null
          template_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          context: string
          course_offering_id: string
          created_at?: string
          draft_version?: number
          enrolment_id: string
          id?: string
          started_at?: string
          status?: string
          submitted_at?: string | null
          template_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          context?: string
          course_offering_id?: string
          created_at?: string
          draft_version?: number
          enrolment_id?: string
          id?: string
          started_at?: string
          status?: string
          submitted_at?: string | null
          template_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "completion_evaluation_submissions_course_offering_id_fkey"
            columns: ["course_offering_id"]
            isOneToOne: false
            referencedRelation: "course_offering_classification_public_v"
            referencedColumns: ["course_offering_id"]
          },
          {
            foreignKeyName: "completion_evaluation_submissions_course_offering_id_fkey"
            columns: ["course_offering_id"]
            isOneToOne: false
            referencedRelation: "course_offering_classification_review_v"
            referencedColumns: ["course_offering_id"]
          },
          {
            foreignKeyName: "completion_evaluation_submissions_course_offering_id_fkey"
            columns: ["course_offering_id"]
            isOneToOne: false
            referencedRelation: "course_offering_financial_internal_v"
            referencedColumns: ["course_offering_id"]
          },
          {
            foreignKeyName: "completion_evaluation_submissions_course_offering_id_fkey"
            columns: ["course_offering_id"]
            isOneToOne: false
            referencedRelation: "course_offerings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "completion_evaluation_submissions_enrolment_id_fkey"
            columns: ["enrolment_id"]
            isOneToOne: false
            referencedRelation: "enrolments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "completion_evaluation_submissions_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "completion_evaluation_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      completion_evaluation_templates: {
        Row: {
          active_version_id: string | null
          context: string
          created_at: string
          created_by: string | null
          id: string
          internal_name: string
          intro_text: string | null
          status: string
          title: string
          updated_at: string
          updated_by: string | null
          version_series: number
        }
        Insert: {
          active_version_id?: string | null
          context: string
          created_at?: string
          created_by?: string | null
          id?: string
          internal_name: string
          intro_text?: string | null
          status?: string
          title: string
          updated_at?: string
          updated_by?: string | null
          version_series?: number
        }
        Update: {
          active_version_id?: string | null
          context?: string
          created_at?: string
          created_by?: string | null
          id?: string
          internal_name?: string
          intro_text?: string | null
          status?: string
          title?: string
          updated_at?: string
          updated_by?: string | null
          version_series?: number
        }
        Relationships: []
      }
      course_offerings: {
        Row: {
          access_mode: string | null
          batch_number: number | null
          classification_source: string
          classification_updated_at: string | null
          classification_updated_by: string | null
          classification_version: number
          closing_date: string | null
          cohort_financial_model: string | null
          cohort_financial_model_source: string
          cohort_financial_model_updated_at: string | null
          cohort_financial_model_updated_by: string | null
          cohort_financial_model_version: number
          cohort_name: string | null
          cohort_payment_responsibility: string | null
          cohort_payment_responsibility_source: string
          cohort_payment_responsibility_updated_at: string | null
          cohort_payment_responsibility_updated_by: string | null
          cohort_payment_responsibility_version: number
          completion_evaluation_context: string | null
          completion_evaluation_required: boolean
          completion_evaluation_source: string
          completion_evaluation_template_id: string | null
          completion_evaluation_updated_at: string | null
          completion_evaluation_updated_by: string | null
          completion_evaluation_version: number
          created_at: string
          delivery_format: string | null
          delivery_mode_id: string | null
          enrolment_access_rule: string | null
          enrolment_end_date: string | null
          enrolment_start_date: string | null
          id: string
          learning_engine_version: string
          learning_model: string | null
          legacy_learn_path: string | null
          master_course_id: string
          offering_code: string
          offering_title: string
          opening_date: string | null
          self_paced_access_model:
            | Database["public"]["Enums"]["self_paced_access_model_v1"]
            | null
          self_paced_access_model_source: string
          self_paced_access_model_updated_at: string | null
          self_paced_access_model_updated_by: string | null
          self_paced_access_model_version: number
          shared_learn_path: string | null
          status: string | null
          updated_at: string
          year: number | null
        }
        Insert: {
          access_mode?: string | null
          batch_number?: number | null
          classification_source?: string
          classification_updated_at?: string | null
          classification_updated_by?: string | null
          classification_version?: number
          closing_date?: string | null
          cohort_financial_model?: string | null
          cohort_financial_model_source?: string
          cohort_financial_model_updated_at?: string | null
          cohort_financial_model_updated_by?: string | null
          cohort_financial_model_version?: number
          cohort_name?: string | null
          cohort_payment_responsibility?: string | null
          cohort_payment_responsibility_source?: string
          cohort_payment_responsibility_updated_at?: string | null
          cohort_payment_responsibility_updated_by?: string | null
          cohort_payment_responsibility_version?: number
          completion_evaluation_context?: string | null
          completion_evaluation_required?: boolean
          completion_evaluation_source?: string
          completion_evaluation_template_id?: string | null
          completion_evaluation_updated_at?: string | null
          completion_evaluation_updated_by?: string | null
          completion_evaluation_version?: number
          created_at?: string
          delivery_format?: string | null
          delivery_mode_id?: string | null
          enrolment_access_rule?: string | null
          enrolment_end_date?: string | null
          enrolment_start_date?: string | null
          id?: string
          learning_engine_version?: string
          learning_model?: string | null
          legacy_learn_path?: string | null
          master_course_id: string
          offering_code: string
          offering_title: string
          opening_date?: string | null
          self_paced_access_model?:
            | Database["public"]["Enums"]["self_paced_access_model_v1"]
            | null
          self_paced_access_model_source?: string
          self_paced_access_model_updated_at?: string | null
          self_paced_access_model_updated_by?: string | null
          self_paced_access_model_version?: number
          shared_learn_path?: string | null
          status?: string | null
          updated_at?: string
          year?: number | null
        }
        Update: {
          access_mode?: string | null
          batch_number?: number | null
          classification_source?: string
          classification_updated_at?: string | null
          classification_updated_by?: string | null
          classification_version?: number
          closing_date?: string | null
          cohort_financial_model?: string | null
          cohort_financial_model_source?: string
          cohort_financial_model_updated_at?: string | null
          cohort_financial_model_updated_by?: string | null
          cohort_financial_model_version?: number
          cohort_name?: string | null
          cohort_payment_responsibility?: string | null
          cohort_payment_responsibility_source?: string
          cohort_payment_responsibility_updated_at?: string | null
          cohort_payment_responsibility_updated_by?: string | null
          cohort_payment_responsibility_version?: number
          completion_evaluation_context?: string | null
          completion_evaluation_required?: boolean
          completion_evaluation_source?: string
          completion_evaluation_template_id?: string | null
          completion_evaluation_updated_at?: string | null
          completion_evaluation_updated_by?: string | null
          completion_evaluation_version?: number
          created_at?: string
          delivery_format?: string | null
          delivery_mode_id?: string | null
          enrolment_access_rule?: string | null
          enrolment_end_date?: string | null
          enrolment_start_date?: string | null
          id?: string
          learning_engine_version?: string
          learning_model?: string | null
          legacy_learn_path?: string | null
          master_course_id?: string
          offering_code?: string
          offering_title?: string
          opening_date?: string | null
          self_paced_access_model?:
            | Database["public"]["Enums"]["self_paced_access_model_v1"]
            | null
          self_paced_access_model_source?: string
          self_paced_access_model_updated_at?: string | null
          self_paced_access_model_updated_by?: string | null
          self_paced_access_model_version?: number
          shared_learn_path?: string | null
          status?: string | null
          updated_at?: string
          year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "course_offerings_completion_evaluation_template_id_fkey"
            columns: ["completion_evaluation_template_id"]
            isOneToOne: false
            referencedRelation: "completion_evaluation_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_offerings_delivery_mode_id_fkey"
            columns: ["delivery_mode_id"]
            isOneToOne: false
            referencedRelation: "delivery_modes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_offerings_master_course_id_fkey"
            columns: ["master_course_id"]
            isOneToOne: false
            referencedRelation: "master_courses"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_modes: {
        Row: {
          active: boolean
          code: string
          created_at: string
          description: string | null
          feature_flags: Json
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          description?: string | null
          feature_flags?: Json
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          description?: string | null
          feature_flags?: Json
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      enrolments: {
        Row: {
          access_end: string | null
          access_start: string | null
          completion_date: string | null
          completion_status: string
          course_offering_id: string
          created_at: string
          enrolment_date: string
          enrolment_status: string
          id: string
          legacy_enrolment_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          access_end?: string | null
          access_start?: string | null
          completion_date?: string | null
          completion_status?: string
          course_offering_id: string
          created_at?: string
          enrolment_date?: string
          enrolment_status?: string
          id?: string
          legacy_enrolment_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          access_end?: string | null
          access_start?: string | null
          completion_date?: string | null
          completion_status?: string
          course_offering_id?: string
          created_at?: string
          enrolment_date?: string
          enrolment_status?: string
          id?: string
          legacy_enrolment_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "enrolments_course_offering_id_fkey"
            columns: ["course_offering_id"]
            isOneToOne: false
            referencedRelation: "course_offering_classification_public_v"
            referencedColumns: ["course_offering_id"]
          },
          {
            foreignKeyName: "enrolments_course_offering_id_fkey"
            columns: ["course_offering_id"]
            isOneToOne: false
            referencedRelation: "course_offering_classification_review_v"
            referencedColumns: ["course_offering_id"]
          },
          {
            foreignKeyName: "enrolments_course_offering_id_fkey"
            columns: ["course_offering_id"]
            isOneToOne: false
            referencedRelation: "course_offering_financial_internal_v"
            referencedColumns: ["course_offering_id"]
          },
          {
            foreignKeyName: "enrolments_course_offering_id_fkey"
            columns: ["course_offering_id"]
            isOneToOne: false
            referencedRelation: "course_offerings"
            referencedColumns: ["id"]
          },
        ]
      }
      evaluations: {
        Row: {
          completion_status: string
          created_at: string
          enrolment_id: string
          evaluation_type: string
          id: string
          response_data: Json
          submitted_at: string
        }
        Insert: {
          completion_status?: string
          created_at?: string
          enrolment_id: string
          evaluation_type: string
          id?: string
          response_data?: Json
          submitted_at?: string
        }
        Update: {
          completion_status?: string
          created_at?: string
          enrolment_id?: string
          evaluation_type?: string
          id?: string
          response_data?: Json
          submitted_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "evaluations_enrolment_id_fkey"
            columns: ["enrolment_id"]
            isOneToOne: false
            referencedRelation: "enrolments"
            referencedColumns: ["id"]
          },
        ]
      }
      expert_availability: {
        Row: {
          availability_status: Database["public"]["Enums"]["availability_status_v1"]
          available_modes: string[]
          available_until: string | null
          created_at: string
          expert_id: string
          hours_per_month: number | null
          next_available_from: string | null
          notes: string | null
          updated_at: string
          visibility: Database["public"]["Enums"]["registry_visibility_v1"]
        }
        Insert: {
          availability_status?: Database["public"]["Enums"]["availability_status_v1"]
          available_modes?: string[]
          available_until?: string | null
          created_at?: string
          expert_id: string
          hours_per_month?: number | null
          next_available_from?: string | null
          notes?: string | null
          updated_at?: string
          visibility?: Database["public"]["Enums"]["registry_visibility_v1"]
        }
        Update: {
          availability_status?: Database["public"]["Enums"]["availability_status_v1"]
          available_modes?: string[]
          available_until?: string | null
          created_at?: string
          expert_id?: string
          hours_per_month?: number | null
          next_available_from?: string | null
          notes?: string | null
          updated_at?: string
          visibility?: Database["public"]["Enums"]["registry_visibility_v1"]
        }
        Relationships: [
          {
            foreignKeyName: "expert_availability_expert_id_fkey"
            columns: ["expert_id"]
            isOneToOne: true
            referencedRelation: "experts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expert_availability_expert_id_fkey"
            columns: ["expert_id"]
            isOneToOne: true
            referencedRelation: "experts_public_v"
            referencedColumns: ["id"]
          },
        ]
      }
      expert_certifications: {
        Row: {
          created_at: string
          expert_id: string
          id: string
          issuer: string | null
          name: string
          reference: string | null
          updated_at: string
          visibility: Database["public"]["Enums"]["registry_visibility_v1"]
          year: number | null
        }
        Insert: {
          created_at?: string
          expert_id: string
          id?: string
          issuer?: string | null
          name: string
          reference?: string | null
          updated_at?: string
          visibility?: Database["public"]["Enums"]["registry_visibility_v1"]
          year?: number | null
        }
        Update: {
          created_at?: string
          expert_id?: string
          id?: string
          issuer?: string | null
          name?: string
          reference?: string | null
          updated_at?: string
          visibility?: Database["public"]["Enums"]["registry_visibility_v1"]
          year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "expert_certifications_expert_id_fkey"
            columns: ["expert_id"]
            isOneToOne: false
            referencedRelation: "experts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expert_certifications_expert_id_fkey"
            columns: ["expert_id"]
            isOneToOne: false
            referencedRelation: "experts_public_v"
            referencedColumns: ["id"]
          },
        ]
      }
      expert_contact_private: {
        Row: {
          address: string | null
          created_at: string
          email: string | null
          expert_id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          email?: string | null
          expert_id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          email?: string | null
          expert_id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "expert_contact_private_expert_id_fkey"
            columns: ["expert_id"]
            isOneToOne: true
            referencedRelation: "experts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expert_contact_private_expert_id_fkey"
            columns: ["expert_id"]
            isOneToOne: true
            referencedRelation: "experts_public_v"
            referencedColumns: ["id"]
          },
        ]
      }
      expert_education: {
        Row: {
          created_at: string
          degree: string
          expert_id: string
          field: string | null
          id: string
          institution: string
          updated_at: string
          visibility: Database["public"]["Enums"]["registry_visibility_v1"]
          year: number | null
        }
        Insert: {
          created_at?: string
          degree: string
          expert_id: string
          field?: string | null
          id?: string
          institution: string
          updated_at?: string
          visibility?: Database["public"]["Enums"]["registry_visibility_v1"]
          year?: number | null
        }
        Update: {
          created_at?: string
          degree?: string
          expert_id?: string
          field?: string | null
          id?: string
          institution?: string
          updated_at?: string
          visibility?: Database["public"]["Enums"]["registry_visibility_v1"]
          year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "expert_education_expert_id_fkey"
            columns: ["expert_id"]
            isOneToOne: false
            referencedRelation: "experts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expert_education_expert_id_fkey"
            columns: ["expert_id"]
            isOneToOne: false
            referencedRelation: "experts_public_v"
            referencedColumns: ["id"]
          },
        ]
      }
      expert_employment: {
        Row: {
          created_at: string
          end_year: number | null
          expert_id: string
          id: string
          is_current: boolean
          organization: string
          role: string
          start_year: number | null
          updated_at: string
          visibility: Database["public"]["Enums"]["registry_visibility_v1"]
        }
        Insert: {
          created_at?: string
          end_year?: number | null
          expert_id: string
          id?: string
          is_current?: boolean
          organization: string
          role: string
          start_year?: number | null
          updated_at?: string
          visibility?: Database["public"]["Enums"]["registry_visibility_v1"]
        }
        Update: {
          created_at?: string
          end_year?: number | null
          expert_id?: string
          id?: string
          is_current?: boolean
          organization?: string
          role?: string
          start_year?: number | null
          updated_at?: string
          visibility?: Database["public"]["Enums"]["registry_visibility_v1"]
        }
        Relationships: [
          {
            foreignKeyName: "expert_employment_expert_id_fkey"
            columns: ["expert_id"]
            isOneToOne: false
            referencedRelation: "experts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expert_employment_expert_id_fkey"
            columns: ["expert_id"]
            isOneToOne: false
            referencedRelation: "experts_public_v"
            referencedColumns: ["id"]
          },
        ]
      }
      expert_expertise: {
        Row: {
          created_at: string
          evidence_ref: string | null
          expert_id: string
          expertise_taxonomy_id: string
          id: string
          primary_expertise: boolean
          proficiency: Database["public"]["Enums"]["expertise_proficiency_v1"]
          updated_at: string
          visibility: Database["public"]["Enums"]["registry_visibility_v1"]
          years_experience: number | null
        }
        Insert: {
          created_at?: string
          evidence_ref?: string | null
          expert_id: string
          expertise_taxonomy_id: string
          id?: string
          primary_expertise?: boolean
          proficiency?: Database["public"]["Enums"]["expertise_proficiency_v1"]
          updated_at?: string
          visibility?: Database["public"]["Enums"]["registry_visibility_v1"]
          years_experience?: number | null
        }
        Update: {
          created_at?: string
          evidence_ref?: string | null
          expert_id?: string
          expertise_taxonomy_id?: string
          id?: string
          primary_expertise?: boolean
          proficiency?: Database["public"]["Enums"]["expertise_proficiency_v1"]
          updated_at?: string
          visibility?: Database["public"]["Enums"]["registry_visibility_v1"]
          years_experience?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "expert_expertise_expert_id_fkey"
            columns: ["expert_id"]
            isOneToOne: false
            referencedRelation: "experts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expert_expertise_expert_id_fkey"
            columns: ["expert_id"]
            isOneToOne: false
            referencedRelation: "experts_public_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expert_expertise_expertise_taxonomy_id_fkey"
            columns: ["expertise_taxonomy_id"]
            isOneToOne: false
            referencedRelation: "expertise_taxonomy"
            referencedColumns: ["id"]
          },
        ]
      }
      expert_geographic_experience: {
        Row: {
          country_code: string
          country_name: string
          created_at: string
          end_year: number | null
          expert_id: string
          expertise_context: string | null
          id: string
          region: string | null
          start_year: number | null
          updated_at: string
          visibility: Database["public"]["Enums"]["registry_visibility_v1"]
          years_experience: number | null
        }
        Insert: {
          country_code: string
          country_name: string
          created_at?: string
          end_year?: number | null
          expert_id: string
          expertise_context?: string | null
          id?: string
          region?: string | null
          start_year?: number | null
          updated_at?: string
          visibility?: Database["public"]["Enums"]["registry_visibility_v1"]
          years_experience?: number | null
        }
        Update: {
          country_code?: string
          country_name?: string
          created_at?: string
          end_year?: number | null
          expert_id?: string
          expertise_context?: string | null
          id?: string
          region?: string | null
          start_year?: number | null
          updated_at?: string
          visibility?: Database["public"]["Enums"]["registry_visibility_v1"]
          years_experience?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "expert_geographic_experience_expert_id_fkey"
            columns: ["expert_id"]
            isOneToOne: false
            referencedRelation: "experts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expert_geographic_experience_expert_id_fkey"
            columns: ["expert_id"]
            isOneToOne: false
            referencedRelation: "experts_public_v"
            referencedColumns: ["id"]
          },
        ]
      }
      expert_languages: {
        Row: {
          created_at: string
          expert_id: string
          id: string
          language_code: string
          language_name: string
          proficiency_level: Database["public"]["Enums"]["language_proficiency_v1"]
          updated_at: string
          visibility: Database["public"]["Enums"]["registry_visibility_v1"]
        }
        Insert: {
          created_at?: string
          expert_id: string
          id?: string
          language_code: string
          language_name: string
          proficiency_level: Database["public"]["Enums"]["language_proficiency_v1"]
          updated_at?: string
          visibility?: Database["public"]["Enums"]["registry_visibility_v1"]
        }
        Update: {
          created_at?: string
          expert_id?: string
          id?: string
          language_code?: string
          language_name?: string
          proficiency_level?: Database["public"]["Enums"]["language_proficiency_v1"]
          updated_at?: string
          visibility?: Database["public"]["Enums"]["registry_visibility_v1"]
        }
        Relationships: [
          {
            foreignKeyName: "expert_languages_expert_id_fkey"
            columns: ["expert_id"]
            isOneToOne: false
            referencedRelation: "experts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expert_languages_expert_id_fkey"
            columns: ["expert_id"]
            isOneToOne: false
            referencedRelation: "experts_public_v"
            referencedColumns: ["id"]
          },
        ]
      }
      expert_portfolio_items: {
        Row: {
          asset_ref_or_url: string | null
          created_at: string
          description: string | null
          display_order: number
          expert_id: string
          id: string
          item_type: string
          related_entity_id: string | null
          related_entity_type: string | null
          title: string
          updated_at: string
          visibility: Database["public"]["Enums"]["registry_visibility_v1"]
        }
        Insert: {
          asset_ref_or_url?: string | null
          created_at?: string
          description?: string | null
          display_order?: number
          expert_id: string
          id?: string
          item_type: string
          related_entity_id?: string | null
          related_entity_type?: string | null
          title: string
          updated_at?: string
          visibility?: Database["public"]["Enums"]["registry_visibility_v1"]
        }
        Update: {
          asset_ref_or_url?: string | null
          created_at?: string
          description?: string | null
          display_order?: number
          expert_id?: string
          id?: string
          item_type?: string
          related_entity_id?: string | null
          related_entity_type?: string | null
          title?: string
          updated_at?: string
          visibility?: Database["public"]["Enums"]["registry_visibility_v1"]
        }
        Relationships: [
          {
            foreignKeyName: "expert_portfolio_items_expert_id_fkey"
            columns: ["expert_id"]
            isOneToOne: false
            referencedRelation: "experts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expert_portfolio_items_expert_id_fkey"
            columns: ["expert_id"]
            isOneToOne: false
            referencedRelation: "experts_public_v"
            referencedColumns: ["id"]
          },
        ]
      }
      expert_projects: {
        Row: {
          created_at: string
          description: string | null
          end_date: string | null
          evidence_ref: string | null
          expert_id: string
          id: string
          institution_or_funder: string | null
          project_name: string
          role: string | null
          start_date: string | null
          updated_at: string
          visibility: Database["public"]["Enums"]["registry_visibility_v1"]
        }
        Insert: {
          created_at?: string
          description?: string | null
          end_date?: string | null
          evidence_ref?: string | null
          expert_id: string
          id?: string
          institution_or_funder?: string | null
          project_name: string
          role?: string | null
          start_date?: string | null
          updated_at?: string
          visibility?: Database["public"]["Enums"]["registry_visibility_v1"]
        }
        Update: {
          created_at?: string
          description?: string | null
          end_date?: string | null
          evidence_ref?: string | null
          expert_id?: string
          id?: string
          institution_or_funder?: string | null
          project_name?: string
          role?: string | null
          start_date?: string | null
          updated_at?: string
          visibility?: Database["public"]["Enums"]["registry_visibility_v1"]
        }
        Relationships: [
          {
            foreignKeyName: "expert_projects_expert_id_fkey"
            columns: ["expert_id"]
            isOneToOne: false
            referencedRelation: "experts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expert_projects_expert_id_fkey"
            columns: ["expert_id"]
            isOneToOne: false
            referencedRelation: "experts_public_v"
            referencedColumns: ["id"]
          },
        ]
      }
      expert_publications: {
        Row: {
          created_at: string
          expert_id: string
          id: string
          title: string
          updated_at: string
          url: string | null
          venue: string | null
          visibility: Database["public"]["Enums"]["registry_visibility_v1"]
          year: number | null
        }
        Insert: {
          created_at?: string
          expert_id: string
          id?: string
          title: string
          updated_at?: string
          url?: string | null
          venue?: string | null
          visibility?: Database["public"]["Enums"]["registry_visibility_v1"]
          year?: number | null
        }
        Update: {
          created_at?: string
          expert_id?: string
          id?: string
          title?: string
          updated_at?: string
          url?: string | null
          venue?: string | null
          visibility?: Database["public"]["Enums"]["registry_visibility_v1"]
          year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "expert_publications_expert_id_fkey"
            columns: ["expert_id"]
            isOneToOne: false
            referencedRelation: "experts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expert_publications_expert_id_fkey"
            columns: ["expert_id"]
            isOneToOne: false
            referencedRelation: "experts_public_v"
            referencedColumns: ["id"]
          },
        ]
      }
      expert_trainer_status: {
        Row: {
          created_at: string
          effective_from: string
          evidence_ref: string | null
          expert_id: string
          expires_at: string | null
          granted_at: string
          granted_by: string | null
          id: string
          rationale: string | null
          trainer_level: Database["public"]["Enums"]["trainer_level_v1"]
          trainer_status: Database["public"]["Enums"]["trainer_status_v1"]
          unique_graduated_participants: number
          version: number
        }
        Insert: {
          created_at?: string
          effective_from?: string
          evidence_ref?: string | null
          expert_id: string
          expires_at?: string | null
          granted_at?: string
          granted_by?: string | null
          id?: string
          rationale?: string | null
          trainer_level?: Database["public"]["Enums"]["trainer_level_v1"]
          trainer_status?: Database["public"]["Enums"]["trainer_status_v1"]
          unique_graduated_participants?: number
          version?: number
        }
        Update: {
          created_at?: string
          effective_from?: string
          evidence_ref?: string | null
          expert_id?: string
          expires_at?: string | null
          granted_at?: string
          granted_by?: string | null
          id?: string
          rationale?: string | null
          trainer_level?: Database["public"]["Enums"]["trainer_level_v1"]
          trainer_status?: Database["public"]["Enums"]["trainer_status_v1"]
          unique_graduated_participants?: number
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "expert_trainer_status_expert_id_fkey"
            columns: ["expert_id"]
            isOneToOne: false
            referencedRelation: "experts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expert_trainer_status_expert_id_fkey"
            columns: ["expert_id"]
            isOneToOne: false
            referencedRelation: "experts_public_v"
            referencedColumns: ["id"]
          },
        ]
      }
      expert_training_facilitation_history: {
        Row: {
          activity_title: string
          country: string | null
          course_offering_id: string | null
          created_at: string
          end_date: string | null
          evidence_ref: string | null
          expert_id: string
          id: string
          organizer: string | null
          participant_count: number | null
          role: string | null
          start_date: string | null
          updated_at: string
          visibility: Database["public"]["Enums"]["registry_visibility_v1"]
        }
        Insert: {
          activity_title: string
          country?: string | null
          course_offering_id?: string | null
          created_at?: string
          end_date?: string | null
          evidence_ref?: string | null
          expert_id: string
          id?: string
          organizer?: string | null
          participant_count?: number | null
          role?: string | null
          start_date?: string | null
          updated_at?: string
          visibility?: Database["public"]["Enums"]["registry_visibility_v1"]
        }
        Update: {
          activity_title?: string
          country?: string | null
          course_offering_id?: string | null
          created_at?: string
          end_date?: string | null
          evidence_ref?: string | null
          expert_id?: string
          id?: string
          organizer?: string | null
          participant_count?: number | null
          role?: string | null
          start_date?: string | null
          updated_at?: string
          visibility?: Database["public"]["Enums"]["registry_visibility_v1"]
        }
        Relationships: [
          {
            foreignKeyName: "expert_training_facilitation_history_expert_id_fkey"
            columns: ["expert_id"]
            isOneToOne: false
            referencedRelation: "experts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expert_training_facilitation_history_expert_id_fkey"
            columns: ["expert_id"]
            isOneToOne: false
            referencedRelation: "experts_public_v"
            referencedColumns: ["id"]
          },
        ]
      }
      expert_verification_history: {
        Row: {
          changed_at: string
          changed_by: string | null
          evidence_ref: string | null
          expert_id: string
          id: string
          new_status: Database["public"]["Enums"]["verification_status_v1"]
          previous_status:
            | Database["public"]["Enums"]["verification_status_v1"]
            | null
          rationale: string | null
          verification_method: string | null
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          evidence_ref?: string | null
          expert_id: string
          id?: string
          new_status: Database["public"]["Enums"]["verification_status_v1"]
          previous_status?:
            | Database["public"]["Enums"]["verification_status_v1"]
            | null
          rationale?: string | null
          verification_method?: string | null
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          evidence_ref?: string | null
          expert_id?: string
          id?: string
          new_status?: Database["public"]["Enums"]["verification_status_v1"]
          previous_status?:
            | Database["public"]["Enums"]["verification_status_v1"]
            | null
          rationale?: string | null
          verification_method?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expert_verification_history_expert_id_fkey"
            columns: ["expert_id"]
            isOneToOne: false
            referencedRelation: "experts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expert_verification_history_expert_id_fkey"
            columns: ["expert_id"]
            isOneToOne: false
            referencedRelation: "experts_public_v"
            referencedColumns: ["id"]
          },
        ]
      }
      expert_versions: {
        Row: {
          created_at: string
          created_by: string | null
          expert_id: string
          id: string
          previous_version_id: string | null
          publication_or_approval_ref: string | null
          snapshot: Json
          version: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          expert_id: string
          id?: string
          previous_version_id?: string | null
          publication_or_approval_ref?: string | null
          snapshot: Json
          version: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          expert_id?: string
          id?: string
          previous_version_id?: string | null
          publication_or_approval_ref?: string | null
          snapshot?: Json
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "expert_versions_expert_id_fkey"
            columns: ["expert_id"]
            isOneToOne: false
            referencedRelation: "experts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expert_versions_expert_id_fkey"
            columns: ["expert_id"]
            isOneToOne: false
            referencedRelation: "experts_public_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expert_versions_previous_version_id_fkey"
            columns: ["previous_version_id"]
            isOneToOne: false
            referencedRelation: "expert_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      expertise_taxonomy: {
        Row: {
          active: boolean
          code: string
          created_at: string
          description: string | null
          display_order: number
          domain: string | null
          id: string
          name: string
          parent_id: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          description?: string | null
          display_order?: number
          domain?: string | null
          id?: string
          name: string
          parent_id?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          description?: string | null
          display_order?: number
          domain?: string | null
          id?: string
          name?: string
          parent_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "expertise_taxonomy_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "expertise_taxonomy"
            referencedColumns: ["id"]
          },
        ]
      }
      experts: {
        Row: {
          approval_date: string | null
          approved_by: string | null
          audit_ref: string | null
          avatar_url: string | null
          bio: string | null
          city: string | null
          country: string | null
          created_at: string
          created_by: string
          current_status: Database["public"]["Enums"]["registry_status_v1"]
          display_name: string
          expertise_areas: string[]
          headline: string | null
          id: string
          languages: string[]
          orcid: string | null
          original_contributor_id: string | null
          personal_url: string | null
          previous_version_id: string | null
          publication_date: string | null
          published_by: string | null
          source_institution_id: string | null
          source_submission_id: string | null
          source_type: string
          slug: string
          updated_at: string
          verification_status: Database["public"]["Enums"]["verification_status_v1"]
          version: number
          visibility: Database["public"]["Enums"]["registry_visibility_v1"]
        }
        Insert: {
          approval_date?: string | null
          approved_by?: string | null
          audit_ref?: string | null
          avatar_url?: string | null
          bio?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          created_by: string
          current_status?: Database["public"]["Enums"]["registry_status_v1"]
          display_name: string
          expertise_areas?: string[]
          headline?: string | null
          id?: string
          languages?: string[]
          orcid?: string | null
          original_contributor_id?: string | null
          personal_url?: string | null
          previous_version_id?: string | null
          publication_date?: string | null
          published_by?: string | null
          source_institution_id?: string | null
          source_submission_id?: string | null
          source_type: string
          slug: string
          updated_at?: string
          verification_status?: Database["public"]["Enums"]["verification_status_v1"]
          version?: number
          visibility?: Database["public"]["Enums"]["registry_visibility_v1"]
        }
        Update: {
          approval_date?: string | null
          approved_by?: string | null
          audit_ref?: string | null
          avatar_url?: string | null
          bio?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          created_by?: string
          current_status?: Database["public"]["Enums"]["registry_status_v1"]
          display_name?: string
          expertise_areas?: string[]
          headline?: string | null
          id?: string
          languages?: string[]
          orcid?: string | null
          original_contributor_id?: string | null
          personal_url?: string | null
          previous_version_id?: string | null
          publication_date?: string | null
          published_by?: string | null
          source_institution_id?: string | null
          source_submission_id?: string | null
          source_type?: string
          slug?: string
          updated_at?: string
          verification_status?: Database["public"]["Enums"]["verification_status_v1"]
          version?: number
          visibility?: Database["public"]["Enums"]["registry_visibility_v1"]
        }
        Relationships: [
          {
            foreignKeyName: "experts_previous_version_id_fkey"
            columns: ["previous_version_id"]
            isOneToOne: false
            referencedRelation: "experts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "experts_previous_version_id_fkey"
            columns: ["previous_version_id"]
            isOneToOne: false
            referencedRelation: "experts_public_v"
            referencedColumns: ["id"]
          },
        ]
      }
      governance_audit_log: {
        Row: {
          actor_id: string | null
          after: Json | null
          before: Json | null
          created_at: string
          entity_id: string | null
          entity_type: string | null
          event_type: string
          id: string
          subject_id: string | null
        }
        Insert: {
          actor_id?: string | null
          after?: Json | null
          before?: Json | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          event_type: string
          id?: string
          subject_id?: string | null
        }
        Update: {
          actor_id?: string | null
          after?: Json | null
          before?: Json | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          event_type?: string
          id?: string
          subject_id?: string | null
        }
        Relationships: []
      }
      knowledge_resource_authors: {
        Row: {
          affiliation: string | null
          created_at: string
          display_name: string
          display_order: number
          expert_id: string | null
          id: string
          is_corresponding: boolean
          resource_id: string
          role: string | null
          updated_at: string
        }
        Insert: {
          affiliation?: string | null
          created_at?: string
          display_name: string
          display_order?: number
          expert_id?: string | null
          id?: string
          is_corresponding?: boolean
          resource_id: string
          role?: string | null
          updated_at?: string
        }
        Update: {
          affiliation?: string | null
          created_at?: string
          display_name?: string
          display_order?: number
          expert_id?: string | null
          id?: string
          is_corresponding?: boolean
          resource_id?: string
          role?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_resource_authors_expert_id_fkey"
            columns: ["expert_id"]
            isOneToOne: false
            referencedRelation: "experts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "knowledge_resource_authors_expert_id_fkey"
            columns: ["expert_id"]
            isOneToOne: false
            referencedRelation: "experts_public_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "knowledge_resource_authors_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "knowledge_resources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "knowledge_resource_authors_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "knowledge_resources_public_v"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_resource_files: {
        Row: {
          checksum: string | null
          created_at: string
          display_order: number
          file_url: string
          id: string
          is_primary: boolean
          label: string | null
          mime_type: string | null
          resource_id: string
          size_bytes: number | null
          updated_at: string
          visibility: Database["public"]["Enums"]["registry_visibility_v1"]
        }
        Insert: {
          checksum?: string | null
          created_at?: string
          display_order?: number
          file_url: string
          id?: string
          is_primary?: boolean
          label?: string | null
          mime_type?: string | null
          resource_id: string
          size_bytes?: number | null
          updated_at?: string
          visibility?: Database["public"]["Enums"]["registry_visibility_v1"]
        }
        Update: {
          checksum?: string | null
          created_at?: string
          display_order?: number
          file_url?: string
          id?: string
          is_primary?: boolean
          label?: string | null
          mime_type?: string | null
          resource_id?: string
          size_bytes?: number | null
          updated_at?: string
          visibility?: Database["public"]["Enums"]["registry_visibility_v1"]
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_resource_files_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "knowledge_resources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "knowledge_resource_files_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "knowledge_resources_public_v"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_resource_related: {
        Row: {
          created_at: string
          id: string
          related_resource_id: string
          relation_kind: string
          resource_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          related_resource_id: string
          relation_kind?: string
          resource_id: string
        }
        Update: {
          created_at?: string
          id?: string
          related_resource_id?: string
          relation_kind?: string
          resource_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_resource_related_related_resource_id_fkey"
            columns: ["related_resource_id"]
            isOneToOne: false
            referencedRelation: "knowledge_resources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "knowledge_resource_related_related_resource_id_fkey"
            columns: ["related_resource_id"]
            isOneToOne: false
            referencedRelation: "knowledge_resources_public_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "knowledge_resource_related_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "knowledge_resources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "knowledge_resource_related_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "knowledge_resources_public_v"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_resource_versions: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          previous_version_id: string | null
          publication_or_approval_ref: string | null
          resource_id: string
          snapshot: Json
          version: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          previous_version_id?: string | null
          publication_or_approval_ref?: string | null
          resource_id: string
          snapshot: Json
          version: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          previous_version_id?: string | null
          publication_or_approval_ref?: string | null
          resource_id?: string
          snapshot?: Json
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_resource_versions_previous_version_id_fkey"
            columns: ["previous_version_id"]
            isOneToOne: false
            referencedRelation: "knowledge_resource_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "knowledge_resource_versions_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "knowledge_resources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "knowledge_resource_versions_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "knowledge_resources_public_v"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_resources: {
        Row: {
          abstract: string | null
          approval_date: string | null
          approved_by: string | null
          audit_ref: string | null
          citation_key: string | null
          citation_text: string | null
          created_at: string
          created_by: string
          current_status: Database["public"]["Enums"]["registry_status_v1"]
          doi: string | null
          external_url: string | null
          geographic_focus: string[]
          id: string
          isbn: string | null
          keywords: string[]
          language: string | null
          license: Database["public"]["Enums"]["resource_license_v1"] | null
          metadata: Json
          original_contributor_id: string | null
          previous_version_id: string | null
          publication_date: string | null
          publication_year: number | null
          published_by: string | null
          publisher: string | null
          related_expert_ids: string[]
          related_module_refs: string[]
          resource_type: Database["public"]["Enums"]["resource_type_v1"]
          source_institution_id: string | null
          source_submission_id: string | null
          source_type: string
          subtitle: string | null
          summary: string | null
          thumbnail_url: string | null
          title: string
          topics: string[]
          updated_at: string
          venue: string | null
          verification_status: Database["public"]["Enums"]["verification_status_v1"]
          version: number
          visibility: Database["public"]["Enums"]["registry_visibility_v1"]
        }
        Insert: {
          abstract?: string | null
          approval_date?: string | null
          approved_by?: string | null
          audit_ref?: string | null
          citation_key?: string | null
          citation_text?: string | null
          created_at?: string
          created_by: string
          current_status?: Database["public"]["Enums"]["registry_status_v1"]
          doi?: string | null
          external_url?: string | null
          geographic_focus?: string[]
          id?: string
          isbn?: string | null
          keywords?: string[]
          language?: string | null
          license?: Database["public"]["Enums"]["resource_license_v1"] | null
          metadata?: Json
          original_contributor_id?: string | null
          previous_version_id?: string | null
          publication_date?: string | null
          publication_year?: number | null
          published_by?: string | null
          publisher?: string | null
          related_expert_ids?: string[]
          related_module_refs?: string[]
          resource_type: Database["public"]["Enums"]["resource_type_v1"]
          source_institution_id?: string | null
          source_submission_id?: string | null
          source_type: string
          subtitle?: string | null
          summary?: string | null
          thumbnail_url?: string | null
          title: string
          topics?: string[]
          updated_at?: string
          venue?: string | null
          verification_status?: Database["public"]["Enums"]["verification_status_v1"]
          version?: number
          visibility?: Database["public"]["Enums"]["registry_visibility_v1"]
        }
        Update: {
          abstract?: string | null
          approval_date?: string | null
          approved_by?: string | null
          audit_ref?: string | null
          citation_key?: string | null
          citation_text?: string | null
          created_at?: string
          created_by?: string
          current_status?: Database["public"]["Enums"]["registry_status_v1"]
          doi?: string | null
          external_url?: string | null
          geographic_focus?: string[]
          id?: string
          isbn?: string | null
          keywords?: string[]
          language?: string | null
          license?: Database["public"]["Enums"]["resource_license_v1"] | null
          metadata?: Json
          original_contributor_id?: string | null
          previous_version_id?: string | null
          publication_date?: string | null
          publication_year?: number | null
          published_by?: string | null
          publisher?: string | null
          related_expert_ids?: string[]
          related_module_refs?: string[]
          resource_type?: Database["public"]["Enums"]["resource_type_v1"]
          source_institution_id?: string | null
          source_submission_id?: string | null
          source_type?: string
          subtitle?: string | null
          summary?: string | null
          thumbnail_url?: string | null
          title?: string
          topics?: string[]
          updated_at?: string
          venue?: string | null
          verification_status?: Database["public"]["Enums"]["verification_status_v1"]
          version?: number
          visibility?: Database["public"]["Enums"]["registry_visibility_v1"]
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_resources_previous_version_id_fkey"
            columns: ["previous_version_id"]
            isOneToOne: false
            referencedRelation: "knowledge_resources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "knowledge_resources_previous_version_id_fkey"
            columns: ["previous_version_id"]
            isOneToOne: false
            referencedRelation: "knowledge_resources_public_v"
            referencedColumns: ["id"]
          },
        ]
      }
      learning_audit_log: {
        Row: {
          actor_id: string | null
          created_at: string
          details: Json | null
          entity_id: string | null
          entity_type: string | null
          event_type: string
          id: string
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type?: string | null
          event_type: string
          id?: string
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type?: string | null
          event_type?: string
          id?: string
        }
        Relationships: []
      }
      learning_feature_flags: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          course_offering_id: string
          created_at: string
          enabled: boolean
          engine_version: string
          id: string
          rollback_available: boolean
          shadow_mode: boolean
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          course_offering_id: string
          created_at?: string
          enabled?: boolean
          engine_version?: string
          id?: string
          rollback_available?: boolean
          shadow_mode?: boolean
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          course_offering_id?: string
          created_at?: string
          enabled?: boolean
          engine_version?: string
          id?: string
          rollback_available?: boolean
          shadow_mode?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "learning_feature_flags_course_offering_id_fkey"
            columns: ["course_offering_id"]
            isOneToOne: true
            referencedRelation: "course_offering_classification_public_v"
            referencedColumns: ["course_offering_id"]
          },
          {
            foreignKeyName: "learning_feature_flags_course_offering_id_fkey"
            columns: ["course_offering_id"]
            isOneToOne: true
            referencedRelation: "course_offering_classification_review_v"
            referencedColumns: ["course_offering_id"]
          },
          {
            foreignKeyName: "learning_feature_flags_course_offering_id_fkey"
            columns: ["course_offering_id"]
            isOneToOne: true
            referencedRelation: "course_offering_financial_internal_v"
            referencedColumns: ["course_offering_id"]
          },
          {
            foreignKeyName: "learning_feature_flags_course_offering_id_fkey"
            columns: ["course_offering_id"]
            isOneToOne: true
            referencedRelation: "course_offerings"
            referencedColumns: ["id"]
          },
        ]
      }
      learning_templates: {
        Row: {
          active: boolean
          code: string
          created_at: string
          default_human_intervention_level: string | null
          default_learning_flow: Json
          default_menu: Json
          description: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          default_human_intervention_level?: string | null
          default_learning_flow?: Json
          default_menu?: Json
          description?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          default_human_intervention_level?: string | null
          default_learning_flow?: Json
          default_menu?: Json
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      master_courses: {
        Row: {
          course_code: string
          created_at: string
          description: string | null
          id: string
          language: string | null
          learning_template_id: string | null
          legacy_course_id: string | null
          status: string | null
          title: string
          updated_at: string
          version: number | null
        }
        Insert: {
          course_code: string
          created_at?: string
          description?: string | null
          id?: string
          language?: string | null
          learning_template_id?: string | null
          legacy_course_id?: string | null
          status?: string | null
          title: string
          updated_at?: string
          version?: number | null
        }
        Update: {
          course_code?: string
          created_at?: string
          description?: string | null
          id?: string
          language?: string | null
          learning_template_id?: string | null
          legacy_course_id?: string | null
          status?: string | null
          title?: string
          updated_at?: string
          version?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "master_courses_learning_template_id_fkey"
            columns: ["learning_template_id"]
            isOneToOne: false
            referencedRelation: "learning_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      master_modules: {
        Row: {
          content_reference: string | null
          created_at: string
          id: string
          learning_hours: number | null
          legacy_module_id: string | null
          master_course_id: string
          module_code: string
          sequence: number
          status: string | null
          title: string
          updated_at: string
          version: number | null
        }
        Insert: {
          content_reference?: string | null
          created_at?: string
          id?: string
          learning_hours?: number | null
          legacy_module_id?: string | null
          master_course_id: string
          module_code: string
          sequence?: number
          status?: string | null
          title: string
          updated_at?: string
          version?: number | null
        }
        Update: {
          content_reference?: string | null
          created_at?: string
          id?: string
          learning_hours?: number | null
          legacy_module_id?: string | null
          master_course_id?: string
          module_code?: string
          sequence?: number
          status?: string | null
          title?: string
          updated_at?: string
          version?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "master_modules_master_course_id_fkey"
            columns: ["master_course_id"]
            isOneToOne: false
            referencedRelation: "master_courses"
            referencedColumns: ["id"]
          },
        ]
      }
      migration_mappings: {
        Row: {
          created_at: string
          entity_type: string
          id: string
          legacy_entity_id: string
          migrated_at: string | null
          migration_status: string
          mismatch_reason: string | null
          shared_entity_id: string
          updated_at: string
          validated_at: string | null
          validation_status: string
        }
        Insert: {
          created_at?: string
          entity_type: string
          id?: string
          legacy_entity_id: string
          migrated_at?: string | null
          migration_status?: string
          mismatch_reason?: string | null
          shared_entity_id: string
          updated_at?: string
          validated_at?: string | null
          validation_status?: string
        }
        Update: {
          created_at?: string
          entity_type?: string
          id?: string
          legacy_entity_id?: string
          migrated_at?: string | null
          migration_status?: string
          mismatch_reason?: string | null
          shared_entity_id?: string
          updated_at?: string
          validated_at?: string | null
          validation_status?: string
        }
        Relationships: []
      }
      module_registry: {
        Row: {
          approval_date: string | null
          approved_by: string | null
          assessment_approach: Json
          audit_ref: string | null
          author_expert_id: string | null
          competency_refs: string[]
          content_outline: Json
          created_at: string
          created_by: string
          current_status: Database["public"]["Enums"]["registry_status_v1"]
          delivery_suitability: string[]
          estimated_learning_hours: number | null
          id: string
          institution_id: string | null
          language: string | null
          learning_activities: Json
          learning_objectives: string[]
          legacy_master_module_ref: string | null
          metadata: Json
          module_type: Database["public"]["Enums"]["module_type_v1"]
          original_contributor_id: string | null
          prerequisites: string[]
          previous_version_id: string | null
          publication_date: string | null
          published_by: string | null
          related_resource_ids: string[]
          source_institution_id: string | null
          source_submission_id: string | null
          source_type: string
          summary: string | null
          target_participants: string | null
          title: string
          updated_at: string
          verification_status: Database["public"]["Enums"]["verification_status_v1"]
          version: number
          visibility: Database["public"]["Enums"]["registry_visibility_v1"]
        }
        Insert: {
          approval_date?: string | null
          approved_by?: string | null
          assessment_approach?: Json
          audit_ref?: string | null
          author_expert_id?: string | null
          competency_refs?: string[]
          content_outline?: Json
          created_at?: string
          created_by: string
          current_status?: Database["public"]["Enums"]["registry_status_v1"]
          delivery_suitability?: string[]
          estimated_learning_hours?: number | null
          id?: string
          institution_id?: string | null
          language?: string | null
          learning_activities?: Json
          learning_objectives?: string[]
          legacy_master_module_ref?: string | null
          metadata?: Json
          module_type?: Database["public"]["Enums"]["module_type_v1"]
          original_contributor_id?: string | null
          prerequisites?: string[]
          previous_version_id?: string | null
          publication_date?: string | null
          published_by?: string | null
          related_resource_ids?: string[]
          source_institution_id?: string | null
          source_submission_id?: string | null
          source_type?: string
          summary?: string | null
          target_participants?: string | null
          title: string
          updated_at?: string
          verification_status?: Database["public"]["Enums"]["verification_status_v1"]
          version?: number
          visibility?: Database["public"]["Enums"]["registry_visibility_v1"]
        }
        Update: {
          approval_date?: string | null
          approved_by?: string | null
          assessment_approach?: Json
          audit_ref?: string | null
          author_expert_id?: string | null
          competency_refs?: string[]
          content_outline?: Json
          created_at?: string
          created_by?: string
          current_status?: Database["public"]["Enums"]["registry_status_v1"]
          delivery_suitability?: string[]
          estimated_learning_hours?: number | null
          id?: string
          institution_id?: string | null
          language?: string | null
          learning_activities?: Json
          learning_objectives?: string[]
          legacy_master_module_ref?: string | null
          metadata?: Json
          module_type?: Database["public"]["Enums"]["module_type_v1"]
          original_contributor_id?: string | null
          prerequisites?: string[]
          previous_version_id?: string | null
          publication_date?: string | null
          published_by?: string | null
          related_resource_ids?: string[]
          source_institution_id?: string | null
          source_submission_id?: string | null
          source_type?: string
          summary?: string | null
          target_participants?: string | null
          title?: string
          updated_at?: string
          verification_status?: Database["public"]["Enums"]["verification_status_v1"]
          version?: number
          visibility?: Database["public"]["Enums"]["registry_visibility_v1"]
        }
        Relationships: []
      }
      module_registry_versions: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          module_id: string
          previous_version_id: string | null
          publication_or_approval_ref: string | null
          snapshot: Json
          version: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          module_id: string
          previous_version_id?: string | null
          publication_or_approval_ref?: string | null
          snapshot: Json
          version: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          module_id?: string
          previous_version_id?: string | null
          publication_or_approval_ref?: string | null
          snapshot?: Json
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "module_registry_versions_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "module_registry"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "module_registry_versions_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "module_registry_public_v"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_events: {
        Row: {
          actor_id: string | null
          created_at: string
          domain: string | null
          entity_id: string | null
          entity_type: string | null
          event_type: string
          id: string
          offering_id: string | null
          payload: Json
          registry_id: string | null
          source_type: string | null
          subject_id: string | null
          submission_id: string | null
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          domain?: string | null
          entity_id?: string | null
          entity_type?: string | null
          event_type: string
          id?: string
          offering_id?: string | null
          payload?: Json
          registry_id?: string | null
          source_type?: string | null
          subject_id?: string | null
          submission_id?: string | null
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          domain?: string | null
          entity_id?: string | null
          entity_type?: string | null
          event_type?: string
          id?: string
          offering_id?: string | null
          payload?: Json
          registry_id?: string | null
          source_type?: string | null
          subject_id?: string | null
          submission_id?: string | null
        }
        Relationships: []
      }
      progress_records: {
        Row: {
          completed_at: string | null
          created_at: string
          enrolment_id: string
          id: string
          learning_activity_id: string
          progress_value: number | null
          source_system: string | null
          status: string
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          enrolment_id: string
          id?: string
          learning_activity_id: string
          progress_value?: number | null
          source_system?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          enrolment_id?: string
          id?: string
          learning_activity_id?: string
          progress_value?: number | null
          source_system?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "progress_records_enrolment_id_fkey"
            columns: ["enrolment_id"]
            isOneToOne: false
            referencedRelation: "enrolments"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_attempts: {
        Row: {
          assessment_id: string
          attempt_number: number
          created_at: string
          enrolment_id: string
          id: string
          passed: boolean | null
          score: number | null
          source_system: string | null
          started_at: string | null
          submitted_at: string
        }
        Insert: {
          assessment_id: string
          attempt_number?: number
          created_at?: string
          enrolment_id: string
          id?: string
          passed?: boolean | null
          score?: number | null
          source_system?: string | null
          started_at?: string | null
          submitted_at?: string
        }
        Update: {
          assessment_id?: string
          attempt_number?: number
          created_at?: string
          enrolment_id?: string
          id?: string
          passed?: boolean | null
          score?: number | null
          source_system?: string | null
          started_at?: string | null
          submitted_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "quiz_attempts_enrolment_id_fkey"
            columns: ["enrolment_id"]
            isOneToOne: false
            referencedRelation: "enrolments"
            referencedColumns: ["id"]
          },
        ]
      }
      review_assignments: {
        Row: {
          assigned_at: string
          assigned_by: string
          conflict_declared_at: string | null
          conflict_of_interest_declared: boolean
          conflict_of_interest_reason: string | null
          created_at: string
          due_at: string | null
          id: string
          reviewer_id: string
          status: string
          subject_id: string
          template_version_id: string | null
          updated_at: string
        }
        Insert: {
          assigned_at?: string
          assigned_by: string
          conflict_declared_at?: string | null
          conflict_of_interest_declared?: boolean
          conflict_of_interest_reason?: string | null
          created_at?: string
          due_at?: string | null
          id?: string
          reviewer_id: string
          status?: string
          subject_id: string
          template_version_id?: string | null
          updated_at?: string
        }
        Update: {
          assigned_at?: string
          assigned_by?: string
          conflict_declared_at?: string | null
          conflict_of_interest_declared?: boolean
          conflict_of_interest_reason?: string | null
          created_at?: string
          due_at?: string | null
          id?: string
          reviewer_id?: string
          status?: string
          subject_id?: string
          template_version_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "review_assignments_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "review_subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_assignments_template_version_id_fkey"
            columns: ["template_version_id"]
            isOneToOne: false
            referencedRelation: "review_template_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      review_decisions: {
        Row: {
          created_at: string
          decided_at: string
          decided_by: string
          decision: string
          id: string
          rationale: string | null
          subject_id: string
          supersedes_decision_id: string | null
        }
        Insert: {
          created_at?: string
          decided_at?: string
          decided_by: string
          decision: string
          id?: string
          rationale?: string | null
          subject_id: string
          supersedes_decision_id?: string | null
        }
        Update: {
          created_at?: string
          decided_at?: string
          decided_by?: string
          decision?: string
          id?: string
          rationale?: string | null
          subject_id?: string
          supersedes_decision_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "review_decisions_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "review_subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_decisions_supersedes_decision_id_fkey"
            columns: ["supersedes_decision_id"]
            isOneToOne: false
            referencedRelation: "review_decisions"
            referencedColumns: ["id"]
          },
        ]
      }
      review_drafts: {
        Row: {
          content_hash: string | null
          created_at: string
          description: string | null
          external_ref: string | null
          id: string
          linked_subject_id: string | null
          payload: Json
          status: string
          subject_kind: string
          submitter_id: string
          title: string
          updated_at: string
        }
        Insert: {
          content_hash?: string | null
          created_at?: string
          description?: string | null
          external_ref?: string | null
          id?: string
          linked_subject_id?: string | null
          payload?: Json
          status?: string
          subject_kind: string
          submitter_id: string
          title: string
          updated_at?: string
        }
        Update: {
          content_hash?: string | null
          created_at?: string
          description?: string | null
          external_ref?: string | null
          id?: string
          linked_subject_id?: string | null
          payload?: Json
          status?: string
          subject_kind?: string
          submitter_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "review_drafts_linked_subject_id_fkey"
            columns: ["linked_subject_id"]
            isOneToOne: false
            referencedRelation: "review_subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      review_records: {
        Row: {
          assignment_id: string
          created_at: string
          criteria: Json
          id: string
          rationale: string | null
          recommendation: string
          reviewer_id: string
          status: string
          subject_id: string
          submitted_at: string | null
          supersedes_review_record_id: string | null
          updated_at: string
        }
        Insert: {
          assignment_id: string
          created_at?: string
          criteria?: Json
          id?: string
          rationale?: string | null
          recommendation: string
          reviewer_id: string
          status?: string
          subject_id: string
          submitted_at?: string | null
          supersedes_review_record_id?: string | null
          updated_at?: string
        }
        Update: {
          assignment_id?: string
          created_at?: string
          criteria?: Json
          id?: string
          rationale?: string | null
          recommendation?: string
          reviewer_id?: string
          status?: string
          subject_id?: string
          submitted_at?: string | null
          supersedes_review_record_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "review_records_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "review_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_records_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "review_subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_records_supersedes_review_record_id_fkey"
            columns: ["supersedes_review_record_id"]
            isOneToOne: false
            referencedRelation: "review_records"
            referencedColumns: ["id"]
          },
        ]
      }
      review_subject_revisions: {
        Row: {
          content_hash: string
          draft_id: string
          id: string
          revision: number
          snapshot: Json
          subject_id: string
          submitted_at: string
        }
        Insert: {
          content_hash: string
          draft_id: string
          id?: string
          revision: number
          snapshot: Json
          subject_id: string
          submitted_at?: string
        }
        Update: {
          content_hash?: string
          draft_id?: string
          id?: string
          revision?: number
          snapshot?: Json
          subject_id?: string
          submitted_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "review_subject_revisions_draft_id_fkey"
            columns: ["draft_id"]
            isOneToOne: false
            referencedRelation: "review_drafts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_subject_revisions_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "review_subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      review_subjects: {
        Row: {
          created_at: string
          current_status: string
          description: string | null
          external_ref: string | null
          id: string
          kind: string
          metadata: Json
          required_recommendations: number
          submitted_by: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          current_status?: string
          description?: string | null
          external_ref?: string | null
          id?: string
          kind: string
          metadata?: Json
          required_recommendations?: number
          submitted_by: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          current_status?: string
          description?: string | null
          external_ref?: string | null
          id?: string
          kind?: string
          metadata?: Json
          required_recommendations?: number
          submitted_by?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      review_template_versions: {
        Row: {
          created_at: string
          criteria_schema: Json
          id: string
          published_at: string | null
          published_by: string | null
          template_id: string
          version: number
        }
        Insert: {
          created_at?: string
          criteria_schema: Json
          id?: string
          published_at?: string | null
          published_by?: string | null
          template_id: string
          version: number
        }
        Update: {
          created_at?: string
          criteria_schema?: Json
          id?: string
          published_at?: string | null
          published_by?: string | null
          template_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "review_template_versions_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "review_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      review_templates: {
        Row: {
          active_version_id: string | null
          created_at: string
          created_by: string
          deprecated_at: string | null
          id: string
          name: string
          subject_kind: string
          updated_at: string
        }
        Insert: {
          active_version_id?: string | null
          created_at?: string
          created_by: string
          deprecated_at?: string | null
          id?: string
          name: string
          subject_kind: string
          updated_at?: string
        }
        Update: {
          active_version_id?: string | null
          created_at?: string
          created_by?: string
          deprecated_at?: string | null
          id?: string
          name?: string
          subject_kind?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "review_templates_active_version_fk"
            columns: ["active_version_id"]
            isOneToOne: false
            referencedRelation: "review_template_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      trainer_level_rules: {
        Row: {
          created_at: string
          created_by: string | null
          effective_from: string
          effective_until: string | null
          evidence_requirements: string | null
          id: string
          min_unique_graduated_participants: number
          trainer_level: Database["public"]["Enums"]["trainer_level_v1"]
          version: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          effective_from?: string
          effective_until?: string | null
          evidence_requirements?: string | null
          id?: string
          min_unique_graduated_participants: number
          trainer_level: Database["public"]["Enums"]["trainer_level_v1"]
          version: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          effective_from?: string
          effective_until?: string | null
          evidence_requirements?: string | null
          id?: string
          min_unique_graduated_participants?: number
          trainer_level?: Database["public"]["Enums"]["trainer_level_v1"]
          version?: number
        }
        Relationships: []
      }
      training_needs: {
        Row: {
          accommodation_required: boolean
          approval_date: string | null
          approved_by: string | null
          audit_ref: string | null
          competency_gap: string | null
          conversion_destination: string | null
          conversion_target_ref: string | null
          converted_at: string | null
          converted_by: string | null
          created_at: string
          created_by: string
          current_status: Database["public"]["Enums"]["registry_status_v1"]
          delivery_preference: string | null
          equipment_required: boolean
          funding_preference: string | null
          geographic_focus: string[]
          id: string
          indicative_budget: number | null
          indicative_budget_currency: string
          logistics_requirements: Json
          meals_required: boolean
          metadata: Json
          original_contributor_id: string | null
          participant_charge_preference: string | null
          preferred_duration_days: number | null
          preferred_start_date: string | null
          previous_version_id: string | null
          proposed_payer: string | null
          proposed_topics: string[]
          publication_date: string | null
          published_by: string | null
          recommended_self_paced_course_id: string | null
          recommended_self_paced_offering_id: string | null
          requester_selected_learning_path: string
          self_paced_alternative_found: boolean
          source_institution_id: string | null
          source_submission_id: string | null
          source_type: string
          summary: string | null
          target_participant_count: number | null
          target_participants: string | null
          title: string
          travel_support_required: boolean
          updated_at: string
          verification_status: Database["public"]["Enums"]["verification_status_v1"]
          version: number
          visibility: Database["public"]["Enums"]["registry_visibility_v1"]
        }
        Insert: {
          accommodation_required?: boolean
          approval_date?: string | null
          approved_by?: string | null
          audit_ref?: string | null
          competency_gap?: string | null
          conversion_destination?: string | null
          conversion_target_ref?: string | null
          converted_at?: string | null
          converted_by?: string | null
          created_at?: string
          created_by: string
          current_status: Database["public"]["Enums"]["registry_status_v1"]
          delivery_preference?: string | null
          equipment_required?: boolean
          funding_preference?: string | null
          geographic_focus?: string[]
          id?: string
          indicative_budget?: number | null
          indicative_budget_currency?: string
          logistics_requirements?: Json
          meals_required?: boolean
          metadata?: Json
          original_contributor_id?: string | null
          participant_charge_preference?: string | null
          preferred_duration_days?: number | null
          preferred_start_date?: string | null
          previous_version_id?: string | null
          proposed_payer?: string | null
          proposed_topics?: string[]
          publication_date?: string | null
          published_by?: string | null
          recommended_self_paced_course_id?: string | null
          recommended_self_paced_offering_id?: string | null
          requester_selected_learning_path?: string
          self_paced_alternative_found?: boolean
          source_institution_id?: string | null
          source_submission_id?: string | null
          source_type: string
          summary?: string | null
          target_participant_count?: number | null
          target_participants?: string | null
          title: string
          travel_support_required?: boolean
          updated_at?: string
          verification_status?: Database["public"]["Enums"]["verification_status_v1"]
          version?: number
          visibility?: Database["public"]["Enums"]["registry_visibility_v1"]
        }
        Update: {
          accommodation_required?: boolean
          approval_date?: string | null
          approved_by?: string | null
          audit_ref?: string | null
          competency_gap?: string | null
          conversion_destination?: string | null
          conversion_target_ref?: string | null
          converted_at?: string | null
          converted_by?: string | null
          created_at?: string
          created_by?: string
          current_status?: Database["public"]["Enums"]["registry_status_v1"]
          delivery_preference?: string | null
          equipment_required?: boolean
          funding_preference?: string | null
          geographic_focus?: string[]
          id?: string
          indicative_budget?: number | null
          indicative_budget_currency?: string
          logistics_requirements?: Json
          meals_required?: boolean
          metadata?: Json
          original_contributor_id?: string | null
          participant_charge_preference?: string | null
          preferred_duration_days?: number | null
          preferred_start_date?: string | null
          previous_version_id?: string | null
          proposed_payer?: string | null
          proposed_topics?: string[]
          publication_date?: string | null
          published_by?: string | null
          recommended_self_paced_course_id?: string | null
          recommended_self_paced_offering_id?: string | null
          requester_selected_learning_path?: string
          self_paced_alternative_found?: boolean
          source_institution_id?: string | null
          source_submission_id?: string | null
          source_type?: string
          summary?: string | null
          target_participant_count?: number | null
          target_participants?: string | null
          title?: string
          travel_support_required?: boolean
          updated_at?: string
          verification_status?: Database["public"]["Enums"]["verification_status_v1"]
          version?: number
          visibility?: Database["public"]["Enums"]["registry_visibility_v1"]
        }
        Relationships: [
          {
            foreignKeyName: "training_needs_recommended_self_paced_offering_id_fkey"
            columns: ["recommended_self_paced_offering_id"]
            isOneToOne: false
            referencedRelation: "course_offering_classification_public_v"
            referencedColumns: ["course_offering_id"]
          },
          {
            foreignKeyName: "training_needs_recommended_self_paced_offering_id_fkey"
            columns: ["recommended_self_paced_offering_id"]
            isOneToOne: false
            referencedRelation: "course_offering_classification_review_v"
            referencedColumns: ["course_offering_id"]
          },
          {
            foreignKeyName: "training_needs_recommended_self_paced_offering_id_fkey"
            columns: ["recommended_self_paced_offering_id"]
            isOneToOne: false
            referencedRelation: "course_offering_financial_internal_v"
            referencedColumns: ["course_offering_id"]
          },
          {
            foreignKeyName: "training_needs_recommended_self_paced_offering_id_fkey"
            columns: ["recommended_self_paced_offering_id"]
            isOneToOne: false
            referencedRelation: "course_offerings"
            referencedColumns: ["id"]
          },
        ]
      }
      training_needs_versions: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          previous_version_id: string | null
          publication_or_approval_ref: string | null
          snapshot: Json
          training_need_id: string
          version: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          previous_version_id?: string | null
          publication_or_approval_ref?: string | null
          snapshot: Json
          training_need_id: string
          version: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          previous_version_id?: string | null
          publication_or_approval_ref?: string | null
          snapshot?: Json
          training_need_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "training_needs_versions_training_need_id_fkey"
            columns: ["training_need_id"]
            isOneToOne: false
            referencedRelation: "training_needs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_needs_versions_training_need_id_fkey"
            columns: ["training_need_id"]
            isOneToOne: false
            referencedRelation: "training_needs_public_v"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          granted_by: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          granted_by?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          granted_by?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      course_offering_classification_public_v: {
        Row: {
          classification_version: number | null
          completion_evaluation_context: string | null
          completion_evaluation_label: string | null
          completion_evaluation_required: boolean | null
          course_offering_id: string | null
          delivery_format: string | null
          enrolment_access_rule: string | null
          learning_model: string | null
          offering_code: string | null
          offering_title: string | null
          payment_responsibility_label: string | null
          self_paced_access_model:
            | Database["public"]["Enums"]["self_paced_access_model_v1"]
            | null
          self_paced_access_model_version: number | null
          venue_rule: Json | null
        }
        Insert: {
          classification_version?: number | null
          completion_evaluation_context?: string | null
          completion_evaluation_label?: never
          completion_evaluation_required?: boolean | null
          course_offering_id?: string | null
          delivery_format?: string | null
          enrolment_access_rule?: string | null
          learning_model?: string | null
          offering_code?: string | null
          offering_title?: string | null
          payment_responsibility_label?: never
          self_paced_access_model?:
            | Database["public"]["Enums"]["self_paced_access_model_v1"]
            | null
          self_paced_access_model_version?: number | null
          venue_rule?: never
        }
        Update: {
          classification_version?: number | null
          completion_evaluation_context?: string | null
          completion_evaluation_label?: never
          completion_evaluation_required?: boolean | null
          course_offering_id?: string | null
          delivery_format?: string | null
          enrolment_access_rule?: string | null
          learning_model?: string | null
          offering_code?: string | null
          offering_title?: string | null
          payment_responsibility_label?: never
          self_paced_access_model?:
            | Database["public"]["Enums"]["self_paced_access_model_v1"]
            | null
          self_paced_access_model_version?: number | null
          venue_rule?: never
        }
        Relationships: []
      }
      course_offering_classification_review_v: {
        Row: {
          access_mode: string | null
          course_offering_id: string | null
          delivery_mode_code: string | null
          learning_engine_version: string | null
          offering_code: string | null
          offering_title: string | null
          status: string | null
        }
        Relationships: []
      }
      course_offering_financial_internal_v: {
        Row: {
          cohort_financial_model: string | null
          cohort_financial_model_source: string | null
          cohort_financial_model_updated_at: string | null
          cohort_financial_model_version: number | null
          cohort_payment_responsibility: string | null
          cohort_payment_responsibility_source: string | null
          cohort_payment_responsibility_updated_at: string | null
          cohort_payment_responsibility_version: number | null
          course_offering_id: string | null
          delivery_format: string | null
          learning_model: string | null
          offering_code: string | null
          offering_title: string | null
        }
        Insert: {
          cohort_financial_model?: string | null
          cohort_financial_model_source?: string | null
          cohort_financial_model_updated_at?: string | null
          cohort_financial_model_version?: number | null
          cohort_payment_responsibility?: string | null
          cohort_payment_responsibility_source?: string | null
          cohort_payment_responsibility_updated_at?: string | null
          cohort_payment_responsibility_version?: number | null
          course_offering_id?: string | null
          delivery_format?: string | null
          learning_model?: string | null
          offering_code?: string | null
          offering_title?: string | null
        }
        Update: {
          cohort_financial_model?: string | null
          cohort_financial_model_source?: string | null
          cohort_financial_model_updated_at?: string | null
          cohort_financial_model_version?: number | null
          cohort_payment_responsibility?: string | null
          cohort_payment_responsibility_source?: string | null
          cohort_payment_responsibility_updated_at?: string | null
          cohort_payment_responsibility_version?: number | null
          course_offering_id?: string | null
          delivery_format?: string | null
          learning_model?: string | null
          offering_code?: string | null
          offering_title?: string | null
        }
        Relationships: []
      }
      experts_directory_v: {
        Row: {
          availability_status:
            | Database["public"]["Enums"]["availability_status_v1"]
            | null
          available_modes: string[] | null
          avatar_url: string | null
          bio: string | null
          city: string | null
          country: string | null
          display_name: string
          expertise_areas: string[]
          headline: string | null
          id: string
          institution: string | null
          institution_role: string | null
          languages: string[]
          next_available_from: string | null
          publication_date: string | null
          recognition_min_participants: number | null
          slug: string
          trainer_effective_from: string | null
          trainer_expires_at: string | null
          trainer_level: Database["public"]["Enums"]["trainer_level_v1"]
          trainer_status: Database["public"]["Enums"]["trainer_status_v1"]
          unique_graduated_participants: number | null
          updated_at: string
          verification_status: Database["public"]["Enums"]["verification_status_v1"]
        }
        Relationships: []
      }
      experts_public_v: {
        Row: {
          avatar_url: string | null
          bio: string | null
          city: string | null
          country: string | null
          created_at: string | null
          display_name: string | null
          expertise_areas: string[] | null
          headline: string | null
          id: string | null
          languages: string[] | null
          orcid: string | null
          personal_url: string | null
          publication_date: string | null
          updated_at: string | null
          verification_status:
            | Database["public"]["Enums"]["verification_status_v1"]
            | null
          version: number | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          city?: string | null
          country?: string | null
          created_at?: string | null
          display_name?: string | null
          expertise_areas?: string[] | null
          headline?: string | null
          id?: string | null
          languages?: string[] | null
          orcid?: string | null
          personal_url?: string | null
          publication_date?: string | null
          updated_at?: string | null
          verification_status?:
            | Database["public"]["Enums"]["verification_status_v1"]
            | null
          version?: number | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          city?: string | null
          country?: string | null
          created_at?: string | null
          display_name?: string | null
          expertise_areas?: string[] | null
          headline?: string | null
          id?: string | null
          languages?: string[] | null
          orcid?: string | null
          personal_url?: string | null
          publication_date?: string | null
          updated_at?: string | null
          verification_status?:
            | Database["public"]["Enums"]["verification_status_v1"]
            | null
          version?: number | null
        }
        Relationships: []
      }
      knowledge_resources_public_v: {
        Row: {
          abstract: string | null
          created_at: string | null
          doi: string | null
          external_url: string | null
          geographic_focus: string[] | null
          id: string | null
          isbn: string | null
          keywords: string[] | null
          language: string | null
          license: Database["public"]["Enums"]["resource_license_v1"] | null
          publication_date: string | null
          publication_year: number | null
          publisher: string | null
          related_expert_ids: string[] | null
          resource_type: Database["public"]["Enums"]["resource_type_v1"] | null
          subtitle: string | null
          summary: string | null
          thumbnail_url: string | null
          title: string | null
          topics: string[] | null
          updated_at: string | null
          venue: string | null
          verification_status:
            | Database["public"]["Enums"]["verification_status_v1"]
            | null
          version: number | null
        }
        Insert: {
          abstract?: string | null
          created_at?: string | null
          doi?: string | null
          external_url?: string | null
          geographic_focus?: string[] | null
          id?: string | null
          isbn?: string | null
          keywords?: string[] | null
          language?: string | null
          license?: Database["public"]["Enums"]["resource_license_v1"] | null
          publication_date?: string | null
          publication_year?: number | null
          publisher?: string | null
          related_expert_ids?: string[] | null
          resource_type?: Database["public"]["Enums"]["resource_type_v1"] | null
          subtitle?: string | null
          summary?: string | null
          thumbnail_url?: string | null
          title?: string | null
          topics?: string[] | null
          updated_at?: string | null
          venue?: string | null
          verification_status?:
            | Database["public"]["Enums"]["verification_status_v1"]
            | null
          version?: number | null
        }
        Update: {
          abstract?: string | null
          created_at?: string | null
          doi?: string | null
          external_url?: string | null
          geographic_focus?: string[] | null
          id?: string | null
          isbn?: string | null
          keywords?: string[] | null
          language?: string | null
          license?: Database["public"]["Enums"]["resource_license_v1"] | null
          publication_date?: string | null
          publication_year?: number | null
          publisher?: string | null
          related_expert_ids?: string[] | null
          resource_type?: Database["public"]["Enums"]["resource_type_v1"] | null
          subtitle?: string | null
          summary?: string | null
          thumbnail_url?: string | null
          title?: string | null
          topics?: string[] | null
          updated_at?: string | null
          venue?: string | null
          verification_status?:
            | Database["public"]["Enums"]["verification_status_v1"]
            | null
          version?: number | null
        }
        Relationships: []
      }
      module_registry_public_v: {
        Row: {
          assessment_approach: Json | null
          author_expert_id: string | null
          competency_refs: string[] | null
          content_outline: Json | null
          current_status:
            | Database["public"]["Enums"]["registry_status_v1"]
            | null
          delivery_suitability: string[] | null
          estimated_learning_hours: number | null
          id: string | null
          institution_id: string | null
          language: string | null
          learning_activities: Json | null
          learning_objectives: string[] | null
          module_type: Database["public"]["Enums"]["module_type_v1"] | null
          prerequisites: string[] | null
          publication_date: string | null
          related_resource_ids: string[] | null
          summary: string | null
          target_participants: string | null
          title: string | null
          verification_status:
            | Database["public"]["Enums"]["verification_status_v1"]
            | null
          version: number | null
          visibility:
            | Database["public"]["Enums"]["registry_visibility_v1"]
            | null
        }
        Insert: {
          assessment_approach?: Json | null
          author_expert_id?: string | null
          competency_refs?: string[] | null
          content_outline?: Json | null
          current_status?:
            | Database["public"]["Enums"]["registry_status_v1"]
            | null
          delivery_suitability?: string[] | null
          estimated_learning_hours?: number | null
          id?: string | null
          institution_id?: string | null
          language?: string | null
          learning_activities?: Json | null
          learning_objectives?: string[] | null
          module_type?: Database["public"]["Enums"]["module_type_v1"] | null
          prerequisites?: string[] | null
          publication_date?: string | null
          related_resource_ids?: string[] | null
          summary?: string | null
          target_participants?: string | null
          title?: string | null
          verification_status?:
            | Database["public"]["Enums"]["verification_status_v1"]
            | null
          version?: number | null
          visibility?:
            | Database["public"]["Enums"]["registry_visibility_v1"]
            | null
        }
        Update: {
          assessment_approach?: Json | null
          author_expert_id?: string | null
          competency_refs?: string[] | null
          content_outline?: Json | null
          current_status?:
            | Database["public"]["Enums"]["registry_status_v1"]
            | null
          delivery_suitability?: string[] | null
          estimated_learning_hours?: number | null
          id?: string | null
          institution_id?: string | null
          language?: string | null
          learning_activities?: Json | null
          learning_objectives?: string[] | null
          module_type?: Database["public"]["Enums"]["module_type_v1"] | null
          prerequisites?: string[] | null
          publication_date?: string | null
          related_resource_ids?: string[] | null
          summary?: string | null
          target_participants?: string | null
          title?: string | null
          verification_status?:
            | Database["public"]["Enums"]["verification_status_v1"]
            | null
          version?: number | null
          visibility?:
            | Database["public"]["Enums"]["registry_visibility_v1"]
            | null
        }
        Relationships: []
      }
      training_needs_public_v: {
        Row: {
          competency_gap: string | null
          conversion_destination: string | null
          converted_at: string | null
          created_at: string | null
          current_status:
            | Database["public"]["Enums"]["registry_status_v1"]
            | null
          delivery_preference: string | null
          funding_preference: string | null
          geographic_focus: string[] | null
          id: string | null
          participant_charge_preference: string | null
          preferred_duration_days: number | null
          preferred_start_date: string | null
          proposed_topics: string[] | null
          publication_date: string | null
          recommended_self_paced_offering_id: string | null
          requester_selected_learning_path: string | null
          self_paced_alternative_found: boolean | null
          summary: string | null
          target_participant_count: number | null
          target_participants: string | null
          title: string | null
          updated_at: string | null
          verification_status:
            | Database["public"]["Enums"]["verification_status_v1"]
            | null
          version: number | null
          visibility:
            | Database["public"]["Enums"]["registry_visibility_v1"]
            | null
        }
        Insert: {
          competency_gap?: string | null
          conversion_destination?: string | null
          converted_at?: string | null
          created_at?: string | null
          current_status?:
            | Database["public"]["Enums"]["registry_status_v1"]
            | null
          delivery_preference?: string | null
          funding_preference?: string | null
          geographic_focus?: string[] | null
          id?: string | null
          participant_charge_preference?: string | null
          preferred_duration_days?: number | null
          preferred_start_date?: string | null
          proposed_topics?: string[] | null
          publication_date?: string | null
          recommended_self_paced_offering_id?: string | null
          requester_selected_learning_path?: string | null
          self_paced_alternative_found?: boolean | null
          summary?: string | null
          target_participant_count?: number | null
          target_participants?: string | null
          title?: string | null
          updated_at?: string | null
          verification_status?:
            | Database["public"]["Enums"]["verification_status_v1"]
            | null
          version?: number | null
          visibility?:
            | Database["public"]["Enums"]["registry_visibility_v1"]
            | null
        }
        Update: {
          competency_gap?: string | null
          conversion_destination?: string | null
          converted_at?: string | null
          created_at?: string | null
          current_status?:
            | Database["public"]["Enums"]["registry_status_v1"]
            | null
          delivery_preference?: string | null
          funding_preference?: string | null
          geographic_focus?: string[] | null
          id?: string | null
          participant_charge_preference?: string | null
          preferred_duration_days?: number | null
          preferred_start_date?: string | null
          proposed_topics?: string[] | null
          publication_date?: string | null
          recommended_self_paced_offering_id?: string | null
          requester_selected_learning_path?: string | null
          self_paced_alternative_found?: boolean | null
          summary?: string | null
          target_participant_count?: number | null
          target_participants?: string | null
          title?: string | null
          updated_at?: string | null
          verification_status?:
            | Database["public"]["Enums"]["verification_status_v1"]
            | null
          version?: number | null
          visibility?:
            | Database["public"]["Enums"]["registry_visibility_v1"]
            | null
        }
        Relationships: [
          {
            foreignKeyName: "training_needs_recommended_self_paced_offering_id_fkey"
            columns: ["recommended_self_paced_offering_id"]
            isOneToOne: false
            referencedRelation: "course_offering_classification_public_v"
            referencedColumns: ["course_offering_id"]
          },
          {
            foreignKeyName: "training_needs_recommended_self_paced_offering_id_fkey"
            columns: ["recommended_self_paced_offering_id"]
            isOneToOne: false
            referencedRelation: "course_offering_classification_review_v"
            referencedColumns: ["course_offering_id"]
          },
          {
            foreignKeyName: "training_needs_recommended_self_paced_offering_id_fkey"
            columns: ["recommended_self_paced_offering_id"]
            isOneToOne: false
            referencedRelation: "course_offering_financial_internal_v"
            referencedColumns: ["course_offering_id"]
          },
          {
            foreignKeyName: "training_needs_recommended_self_paced_offering_id_fkey"
            columns: ["recommended_self_paced_offering_id"]
            isOneToOne: false
            referencedRelation: "course_offerings"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      current_user_has_any_permission: {
        Args: { _permissions: string[] }
        Returns: boolean
      }
      current_user_has_permission: {
        Args: { _permission: string }
        Returns: boolean
      }
      decide_rbac_role_change: {
        Args: {
          _decision: string
          _decision_note?: string
          _request_id: string
        }
        Returns: string
      }
      has_permission: {
        Args: { _permission: string; _user_id: string }
        Returns: boolean
      }
      has_rbac_role: {
        Args: { _role: string; _user_id: string }
        Returns: boolean
      }
      request_rbac_role_change: {
        Args: {
          _action: string
          _reason: string
          _role_code: string
          _scope?: Json
          _target_user_id: string
          _valid_from?: string
          _valid_until?: string
        }
        Returns: string
      }
      _expert_child_read: { Args: { _expert_id: string }; Returns: boolean }
      _expert_child_write: { Args: { _expert_id: string }; Returns: boolean }
      _expert_is_owner: { Args: { _expert_id: string }; Returns: boolean }
      _is_self_paced_delivery_mode: {
        Args: { _mode_id: string }
        Returns: boolean
      }
      _normalize_url: { Args: { _u: string }; Returns: string }
      _require_admin_or_mgmt: { Args: never; Returns: undefined }
      _safe_http_url: { Args: { _u: string }; Returns: boolean }
      _validate_completion_evaluation_answer: {
        Args: {
          _ans: Json
          _q: Database["public"]["Tables"]["completion_evaluation_questions"]["Row"]
        }
        Returns: undefined
      }
      add_completion_evaluation_question: {
        Args: {
          _category: string
          _choices?: Json
          _display_order: number
          _help_text?: string
          _is_required: boolean
          _question_text: string
          _question_type: unknown
          _rating_max?: number
          _rating_min?: number
          _template_id: string
        }
        Returns: string
      }
      add_template_version: {
        Args: { _criteria_schema: Json; _template_id: string }
        Returns: string
      }
      assign_completion_evaluation_template: {
        Args: { _offering_id: string; _reason: string; _template_id: string }
        Returns: Json
      }
      assign_reviewer: {
        Args: {
          _due_at: string
          _reviewer_id: string
          _subject_id: string
          _template_version_id: string
        }
        Returns: string
      }
      can_read_review_subject: {
        Args: { _subject_id: string }
        Returns: boolean
      }
      can_review_registry_subject: {
        Args: { _subject_id: string }
        Returns: boolean
      }
      cancel_assignment: {
        Args: { _assignment_id: string }
        Returns: undefined
      }
      check_certificate_eligibility: {
        Args: { _enrolment_id: string }
        Returns: Json
      }
      cohort_payment_responsibility_public_label: {
        Args: { _learning_model: string; _responsibility: string }
        Returns: string
      }
      configure_completion_evaluation_requirement: {
        Args: {
          _context: unknown
          _expected_version: number
          _offering_id: string
          _reason: string
          _required: boolean
          _source: string
        }
        Returns: Json
      }
      convert_training_need: {
        Args: { _destination: string; _need_id: string; _target_ref?: string }
        Returns: undefined
      }
      create_completion_evaluation_template: {
        Args: {
          _context: unknown
          _internal_name: string
          _intro_text?: string
          _title: string
        }
        Returns: string
      }
      create_template: {
        Args: { _name: string; _subject_kind: string }
        Returns: string
      }
      deprecate_template: { Args: { _template_id: string }; Returns: undefined }
      emit_platform_event: {
        Args: {
          _actor_id?: string
          _domain?: string
          _entity_id?: string
          _entity_type?: string
          _event_type: unknown
          _offering_id?: string
          _payload?: Json
          _registry_id?: string
          _source_type?: unknown
          _subject_id?: string
          _submission_id?: string
        }
        Returns: string
      }
      expert_archive: {
        Args: { _expert_id: string; _rationale?: string }
        Returns: undefined
      }
      expert_draft_create: {
        Args: { _display_name: string; _source_type?: unknown }
        Returns: string
      }
      expert_service_request_create: {
        Args: {
          _payload: Json
          _request_type: string
          _status?: string
          _target_expert_slug?: string | null
        }
        Returns: Json
      }
      expert_service_request_delete_draft: {
        Args: { _request_id: string }
        Returns: undefined
      }
      expert_service_requests_my: { Args: never; Returns: Json }
      trainer_portal_bootstrap: { Args: never; Returns: Json }
      trainer_service_request_respond: {
        Args: { _action: string; _request_id: string }
        Returns: Json
      }
      trainer_service_requests: { Args: never; Returns: Json }
      expert_draft_submit: { Args: { _draft_id: string }; Returns: string }
      expert_draft_update: {
        Args: { _draft_id: string; _patch: Json }
        Returns: undefined
      }
      expert_publish_direct: {
        Args: {
          _payload: Json
          _rationale?: string
          _verification?: Database["public"]["Enums"]["verification_status_v1"]
          _visibility?: Database["public"]["Enums"]["registry_visibility_v1"]
        }
        Returns: string
      }
      expert_publish_from_decision: {
        Args: {
          _decision_id: string
          _subject_id: string
          _verification?: Database["public"]["Enums"]["verification_status_v1"]
          _visibility?: Database["public"]["Enums"]["registry_visibility_v1"]
        }
        Returns: string
      }
      export_governance_audit_csv: {
        Args: {
          _event_type?: string
          _from?: string
          _limit?: number
          _subject_id?: string
          _to?: string
        }
        Returns: string
      }
      finalize_decision: {
        Args: { _decision: string; _rationale: string; _subject_id: string }
        Returns: string
      }
      find_expert_duplicate_candidates: {
        Args: {
          _country?: string
          _display_name?: string
          _email?: string
          _orcid?: string
        }
        Returns: {
          country: string
          display_name: string
          expert_id: string
          match_kind: string
          match_score: number
        }[]
      }
      find_kr_duplicate_candidates: {
        Args: {
          _author_name?: string
          _doi?: string
          _external_url?: string
          _file_hash?: string
          _institution_id?: string
          _isbn?: string
          _title?: string
        }
        Returns: {
          match_kind: string
          match_score: number
          resource_id: string
          resource_type: Database["public"]["Enums"]["resource_type_v1"]
          title: string
        }[]
      }
      has_any_governance_role: { Args: { _user_id: string }; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      kr_archive: {
        Args: { _rationale?: string; _resource_id: string }
        Returns: undefined
      }
      kr_draft_create: {
        Args: {
          _resource_type: Database["public"]["Enums"]["resource_type_v1"]
          _source_type?: unknown
          _title: string
        }
        Returns: string
      }
      kr_draft_submit: { Args: { _draft_id: string }; Returns: string }
      kr_draft_update: {
        Args: { _draft_id: string; _patch: Json }
        Returns: undefined
      }
      kr_publish_direct: {
        Args: {
          _payload: Json
          _rationale?: string
          _verification?: Database["public"]["Enums"]["verification_status_v1"]
          _visibility?: Database["public"]["Enums"]["registry_visibility_v1"]
        }
        Returns: string
      }
      kr_publish_from_decision: {
        Args: {
          _decision_id: string
          _subject_id: string
          _verification?: Database["public"]["Enums"]["verification_status_v1"]
          _visibility?: Database["public"]["Enums"]["registry_visibility_v1"]
        }
        Returns: string
      }
      log_governance_event: {
        Args: {
          _actor_id: string
          _after: Json
          _before: Json
          _entity_id: string
          _entity_type: string
          _event_type: string
          _subject_id: string
        }
        Returns: string
      }
      module_archive: {
        Args: { _module_id: string; _rationale?: string }
        Returns: undefined
      }
      module_draft_create: {
        Args: {
          _module_type?: Database["public"]["Enums"]["module_type_v1"]
          _source_type?: string
          _title: string
        }
        Returns: string
      }
      module_draft_submit: { Args: { _draft_id: string }; Returns: string }
      module_draft_update: {
        Args: { _draft_id: string; _patch: Json }
        Returns: undefined
      }
      module_publish_direct: {
        Args: {
          _payload: Json
          _rationale?: string
          _verification?: Database["public"]["Enums"]["verification_status_v1"]
          _visibility?: Database["public"]["Enums"]["registry_visibility_v1"]
        }
        Returns: string
      }
      module_publish_from_decision: {
        Args: {
          _decision_id: string
          _subject_id: string
          _verification?: Database["public"]["Enums"]["verification_status_v1"]
          _visibility?: Database["public"]["Enums"]["registry_visibility_v1"]
        }
        Returns: string
      }
      offering_venue_rule: {
        Args: { _delivery_format: unknown; _learning_model: unknown }
        Returns: Json
      }
      publish_template_version: {
        Args: { _version_id: string }
        Returns: undefined
      }
      reassign_reviewer: {
        Args: {
          _assignment_id: string
          _due_at: string
          _new_reviewer_id: string
          _template_version_id: string
        }
        Returns: string
      }
      record_expert_verification: {
        Args: {
          _evidence_ref?: string
          _expert_id: string
          _new_status: Database["public"]["Enums"]["verification_status_v1"]
          _rationale?: string
          _verification_method: string
        }
        Returns: undefined
      }
      resolve_completion_evaluation_state: {
        Args: { _enrolment_id: string }
        Returns: Json
      }
      return_for_revision: {
        Args: { _rationale: string; _subject_id: string }
        Returns: string
      }
      save_completion_evaluation_draft: {
        Args: {
          _answers: Json
          _expected_version: number
          _submission_id: string
        }
        Returns: Json
      }
      set_active_template_version: {
        Args: { _template_id: string; _version_id: string }
        Returns: undefined
      }
      set_cohort_financial_model: {
        Args: {
          _expected_version?: number
          _financial_model: unknown
          _offering_id: string
          _reason?: string
          _source?: string
        }
        Returns: Json
      }
      set_cohort_payment_responsibility: {
        Args: {
          _expected_version?: number
          _offering_id: string
          _reason?: string
          _responsibility: unknown
          _source?: string
        }
        Returns: Json
      }
      set_completion_evaluation_template_status: {
        Args: { _reason: string; _status: unknown; _template_id: string }
        Returns: Json
      }
      set_offering_classification: {
        Args: {
          _delivery_format: unknown
          _enrolment_access_rule: unknown
          _expected_version?: number
          _learning_model: unknown
          _offering_id: string
          _reason?: string
        }
        Returns: Json
      }
      set_required_recommendations: {
        Args: { _n: number; _subject_id: string }
        Returns: undefined
      }
      set_self_paced_access_model: {
        Args: {
          _access_model: Database["public"]["Enums"]["self_paced_access_model_v1"]
          _expected_version?: number
          _offering_id: string
          _reason?: string
        }
        Returns: Json
      }
      start_completion_evaluation: {
        Args: { _enrolment_id: string }
        Returns: Json
      }
      submit_completion_evaluation: {
        Args: { _expected_version?: number; _submission_id: string }
        Returns: Json
      }
      submit_draft_for_review: { Args: { _draft_id: string }; Returns: string }
      submit_review_recommendation: {
        Args: { _record_id: string }
        Returns: undefined
      }
      training_need_accept_self_paced: {
        Args: { _offering_id: string }
        Returns: string
      }
      training_need_archive: {
        Args: { _need_id: string; _rationale: string }
        Returns: undefined
      }
      training_need_draft_create: {
        Args: { _source_type?: unknown; _title: string }
        Returns: string
      }
      training_need_draft_submit: {
        Args: { _draft_id: string }
        Returns: string
      }
      training_need_draft_update: {
        Args: { _draft_id: string; _patch: Json }
        Returns: undefined
      }
      training_need_present_self_paced: {
        Args: { _offering_id: string }
        Returns: Json
      }
      training_need_publish_direct: {
        Args: {
          _payload: Json
          _rationale?: string
          _verification?: Database["public"]["Enums"]["verification_status_v1"]
          _visibility?: Database["public"]["Enums"]["registry_visibility_v1"]
        }
        Returns: string
      }
      training_need_publish_from_decision: {
        Args: {
          _decision_id: string
          _subject_id: string
          _verification?: Database["public"]["Enums"]["verification_status_v1"]
          _visibility?: Database["public"]["Enums"]["registry_visibility_v1"]
        }
        Returns: string
      }
      upsert_expert_trainer_status: {
        Args: {
          _effective_from?: string
          _evidence_ref?: string
          _expert_id: string
          _expires_at?: string
          _rationale?: string
          _trainer_level: Database["public"]["Enums"]["trainer_level_v1"]
          _trainer_status: Database["public"]["Enums"]["trainer_status_v1"]
          _unique_graduated_participants?: number
        }
        Returns: string
      }
      validate_review_criteria: {
        Args: { _criteria: Json; _schema: Json }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "management" | "qa_reviewer"
      availability_status_v1: "available" | "limited" | "unavailable"
      expertise_proficiency_v1:
        | "novice"
        | "intermediate"
        | "proficient"
        | "expert"
        | "authority"
      language_proficiency_v1:
        | "A1"
        | "A2"
        | "B1"
        | "B2"
        | "C1"
        | "C2"
        | "native"
      module_type_v1:
        | "foundational"
        | "technical"
        | "applied"
        | "policy"
        | "managerial"
        | "safety"
        | "compliance"
        | "soft_skills"
        | "field_practicum"
        | "other"
      registry_status_v1:
        | "draft"
        | "submitted"
        | "under_review"
        | "changes_requested"
        | "approved"
        | "published"
        | "rejected"
        | "withdrawn"
        | "archived"
        | "deprecated"
        | "revoked"
      registry_visibility_v1: "public" | "restricted" | "private"
      resource_license_v1:
        | "cc_by"
        | "cc_by_sa"
        | "cc_by_nc"
        | "cc_by_nc_sa"
        | "cc_by_nd"
        | "cc_by_nc_nd"
        | "cc0"
        | "all_rights_reserved"
        | "other"
      resource_type_v1:
        | "publication"
        | "journal_article"
        | "book"
        | "book_chapter"
        | "working_paper"
        | "technical_report"
        | "policy_brief"
        | "guideline"
        | "standard"
        | "dataset"
        | "database"
        | "model"
        | "tool"
        | "methodology"
        | "best_practice"
        | "case_study"
        | "infographic"
        | "poster"
        | "video"
        | "podcast"
        | "webinar_recording"
        | "training_material"
        | "module"
        | "toolkit"
      self_paced_access_model_v1: "free" | "paid" | "free_to_learn"
      trainer_level_v1:
        | "not_assigned"
        | "certified"
        | "advanced"
        | "senior"
        | "master"
      trainer_status_v1:
        | "candidate"
        | "active"
        | "inactive"
        | "suspended"
        | "retired"
      verification_status_v1:
        | "unverified"
        | "self_declared"
        | "institutionally_verified"
        | "governance_verified"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "management", "qa_reviewer"],
      availability_status_v1: ["available", "limited", "unavailable"],
      expertise_proficiency_v1: [
        "novice",
        "intermediate",
        "proficient",
        "expert",
        "authority",
      ],
      language_proficiency_v1: ["A1", "A2", "B1", "B2", "C1", "C2", "native"],
      module_type_v1: [
        "foundational",
        "technical",
        "applied",
        "policy",
        "managerial",
        "safety",
        "compliance",
        "soft_skills",
        "field_practicum",
        "other",
      ],
      registry_status_v1: [
        "draft",
        "submitted",
        "under_review",
        "changes_requested",
        "approved",
        "published",
        "rejected",
        "withdrawn",
        "archived",
        "deprecated",
        "revoked",
      ],
      registry_visibility_v1: ["public", "restricted", "private"],
      resource_license_v1: [
        "cc_by",
        "cc_by_sa",
        "cc_by_nc",
        "cc_by_nc_sa",
        "cc_by_nd",
        "cc_by_nc_nd",
        "cc0",
        "all_rights_reserved",
        "other",
      ],
      resource_type_v1: [
        "publication",
        "journal_article",
        "book",
        "book_chapter",
        "working_paper",
        "technical_report",
        "policy_brief",
        "guideline",
        "standard",
        "dataset",
        "database",
        "model",
        "tool",
        "methodology",
        "best_practice",
        "case_study",
        "infographic",
        "poster",
        "video",
        "podcast",
        "webinar_recording",
        "training_material",
        "module",
        "toolkit",
      ],
      self_paced_access_model_v1: ["free", "paid", "free_to_learn"],
      trainer_level_v1: [
        "not_assigned",
        "certified",
        "advanced",
        "senior",
        "master",
      ],
      trainer_status_v1: [
        "candidate",
        "active",
        "inactive",
        "suspended",
        "retired",
      ],
      verification_status_v1: [
        "unverified",
        "self_declared",
        "institutionally_verified",
        "governance_verified",
      ],
    },
  },
} as const
