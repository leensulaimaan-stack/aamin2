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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      annual_goals: {
        Row: {
          baseline_value: number
          cancel_reason: string | null
          created_at: string
          description: string | null
          id: string
          measure_type: string
          owner_id: string
          status: string
          target_value: number
          team_id: string
          title: string
          unit: string | null
          weight: number
          year: number
        }
        Insert: {
          baseline_value?: number
          cancel_reason?: string | null
          created_at?: string
          description?: string | null
          id?: string
          measure_type: string
          owner_id: string
          status?: string
          target_value?: number
          team_id: string
          title: string
          unit?: string | null
          weight?: number
          year: number
        }
        Update: {
          baseline_value?: number
          cancel_reason?: string | null
          created_at?: string
          description?: string | null
          id?: string
          measure_type?: string
          owner_id?: string
          status?: string
          target_value?: number
          team_id?: string
          title?: string
          unit?: string | null
          weight?: number
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "annual_goals_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "annual_goals_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      app_settings: {
        Row: {
          id: number
          settings: Json
        }
        Insert: {
          id?: number
          settings: Json
        }
        Update: {
          id?: number
          settings?: Json
        }
        Relationships: []
      }
      audit_log: {
        Row: {
          changed_at: string
          changed_by: string | null
          entity_id: string
          entity_type: string
          field: string
          id: number
          new_value: string | null
          old_value: string | null
          team_id: string | null
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          entity_id: string
          entity_type: string
          field: string
          id?: never
          new_value?: string | null
          old_value?: string | null
          team_id?: string | null
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          entity_id?: string
          entity_type?: string
          field?: string
          id?: never
          new_value?: string | null
          old_value?: string | null
          team_id?: string | null
        }
        Relationships: []
      }
      badges: {
        Row: {
          code: string
          description: string
          icon: string
          id: string
          name: string
        }
        Insert: {
          code: string
          description: string
          icon: string
          id?: string
          name: string
        }
        Update: {
          code?: string
          description?: string
          icon?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      building_inspection_plans: {
        Row: {
          active: boolean
          assignee_id: string
          building_id: string
          id: string
          template_id: string
        }
        Insert: {
          active?: boolean
          assignee_id: string
          building_id: string
          id?: string
          template_id: string
        }
        Update: {
          active?: boolean
          assignee_id?: string
          building_id?: string
          id?: string
          template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "building_inspection_plans_assignee_id_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "building_inspection_plans_building_id_fkey"
            columns: ["building_id"]
            isOneToOne: false
            referencedRelation: "buildings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "building_inspection_plans_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "inspection_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      buildings: {
        Row: {
          address: string | null
          code: string
          floors_count: number | null
          has_aed: boolean
          has_chemical_storage: boolean
          has_contractor_works: boolean
          has_elevators: boolean
          has_fire_pump_room: boolean
          has_generator: boolean
          has_kitchen: boolean
          has_parking: boolean
          has_smoking_area: boolean
          id: string
          name: string
          responsible_user_id: string | null
          team_id: string | null
        }
        Insert: {
          address?: string | null
          code: string
          floors_count?: number | null
          has_aed?: boolean
          has_chemical_storage?: boolean
          has_contractor_works?: boolean
          has_elevators?: boolean
          has_fire_pump_room?: boolean
          has_generator?: boolean
          has_kitchen?: boolean
          has_parking?: boolean
          has_smoking_area?: boolean
          id?: string
          name: string
          responsible_user_id?: string | null
          team_id?: string | null
        }
        Update: {
          address?: string | null
          code?: string
          floors_count?: number | null
          has_aed?: boolean
          has_chemical_storage?: boolean
          has_contractor_works?: boolean
          has_elevators?: boolean
          has_fire_pump_room?: boolean
          has_generator?: boolean
          has_kitchen?: boolean
          has_parking?: boolean
          has_smoking_area?: boolean
          id?: string
          name?: string
          responsible_user_id?: string | null
          team_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "buildings_responsible_user_id_fkey"
            columns: ["responsible_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "buildings_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      challenges: {
        Row: {
          end_date: string
          id: string
          metric: string
          start_date: string
          target_percent: number
          team_id: string | null
          title: string
        }
        Insert: {
          end_date: string
          id?: string
          metric?: string
          start_date: string
          target_percent?: number
          team_id?: string | null
          title: string
        }
        Update: {
          end_date?: string
          id?: string
          metric?: string
          start_date?: string
          target_percent?: number
          team_id?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "challenges_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_items: {
        Row: {
          active: boolean
          applies_if: string | null
          code: string
          default_severity: string
          id: string
          order_no: number
          photo_required_on_issue: boolean
          section_id: string
          text: string
        }
        Insert: {
          active?: boolean
          applies_if?: string | null
          code: string
          default_severity: string
          id?: string
          order_no?: number
          photo_required_on_issue?: boolean
          section_id: string
          text: string
        }
        Update: {
          active?: boolean
          applies_if?: string | null
          code?: string
          default_severity?: string
          id?: string
          order_no?: number
          photo_required_on_issue?: boolean
          section_id?: string
          text?: string
        }
        Relationships: [
          {
            foreignKeyName: "checklist_items_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "checklist_sections"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_sections: {
        Row: {
          code: string
          id: string
          name: string
          order_no: number
        }
        Insert: {
          code: string
          id?: string
          name: string
          order_no: number
        }
        Update: {
          code?: string
          id?: string
          name?: string
          order_no?: number
        }
        Relationships: []
      }
      decisions: {
        Row: {
          decided_at: string
          decided_by: string
          decision: string
          id: string
          meeting_date: string
          new_due_date: string | null
          new_owner_id: string | null
          reason: string | null
          task_id: string
        }
        Insert: {
          decided_at?: string
          decided_by?: string
          decision: string
          id?: string
          meeting_date?: string
          new_due_date?: string | null
          new_owner_id?: string | null
          reason?: string | null
          task_id: string
        }
        Update: {
          decided_at?: string
          decided_by?: string
          decision?: string
          id?: string
          meeting_date?: string
          new_due_date?: string | null
          new_owner_id?: string | null
          reason?: string | null
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "decisions_new_owner_id_fkey"
            columns: ["new_owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "decisions_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      external_dependencies: {
        Row: {
          created_at: string
          expected_by: string | null
          follow_up_owner_id: string | null
          id: string
          party_name: string
          party_type: string
          received_on: string | null
          requested_on: string
          status: string
          task_id: string
          what_is_needed: string
        }
        Insert: {
          created_at?: string
          expected_by?: string | null
          follow_up_owner_id?: string | null
          id?: string
          party_name: string
          party_type: string
          received_on?: string | null
          requested_on?: string
          status?: string
          task_id: string
          what_is_needed: string
        }
        Update: {
          created_at?: string
          expected_by?: string | null
          follow_up_owner_id?: string | null
          id?: string
          party_name?: string
          party_type?: string
          received_on?: string | null
          requested_on?: string
          status?: string
          task_id?: string
          what_is_needed?: string
        }
        Relationships: [
          {
            foreignKeyName: "external_dependencies_follow_up_owner_id_fkey"
            columns: ["follow_up_owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "external_dependencies_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      finding_reports: {
        Row: {
          building_id: string
          created_at: string
          description: string
          dismiss_reason: string | null
          finding_id: string | null
          floor_or_area: string | null
          id: string
          photo_paths: string[]
          reporter_id: string
          severity: string
          status: string
        }
        Insert: {
          building_id: string
          created_at?: string
          description: string
          dismiss_reason?: string | null
          finding_id?: string | null
          floor_or_area?: string | null
          id?: string
          photo_paths?: string[]
          reporter_id?: string
          severity: string
          status?: string
        }
        Update: {
          building_id?: string
          created_at?: string
          description?: string
          dismiss_reason?: string | null
          finding_id?: string | null
          floor_or_area?: string | null
          id?: string
          photo_paths?: string[]
          reporter_id?: string
          severity?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "finding_reports_building_id_fkey"
            columns: ["building_id"]
            isOneToOne: false
            referencedRelation: "buildings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finding_reports_finding_id_fkey"
            columns: ["finding_id"]
            isOneToOne: false
            referencedRelation: "findings"
            referencedColumns: ["id"]
          },
        ]
      }
      findings: {
        Row: {
          building_id: string
          closed_at: string | null
          closure_note: string | null
          closure_photo_paths: string[]
          closure_submitted_at: string | null
          corrective_task_id: string | null
          created_at: string
          description: string | null
          floor_or_area: string | null
          id: string
          inspection_id: string | null
          inspector_id: string | null
          item_id: string | null
          photo_paths: string[]
          report_id: string | null
          severity: string
          status: string
          verified_by: string | null
          verify_rejection: string | null
        }
        Insert: {
          building_id: string
          closed_at?: string | null
          closure_note?: string | null
          closure_photo_paths?: string[]
          closure_submitted_at?: string | null
          corrective_task_id?: string | null
          created_at?: string
          description?: string | null
          floor_or_area?: string | null
          id?: string
          inspection_id?: string | null
          inspector_id?: string | null
          item_id?: string | null
          photo_paths?: string[]
          report_id?: string | null
          severity: string
          status?: string
          verified_by?: string | null
          verify_rejection?: string | null
        }
        Update: {
          building_id?: string
          closed_at?: string | null
          closure_note?: string | null
          closure_photo_paths?: string[]
          closure_submitted_at?: string | null
          corrective_task_id?: string | null
          created_at?: string
          description?: string | null
          floor_or_area?: string | null
          id?: string
          inspection_id?: string | null
          inspector_id?: string | null
          item_id?: string | null
          photo_paths?: string[]
          report_id?: string | null
          severity?: string
          status?: string
          verified_by?: string | null
          verify_rejection?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "findings_building_id_fkey"
            columns: ["building_id"]
            isOneToOne: false
            referencedRelation: "buildings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "findings_corrective_task_id_fkey"
            columns: ["corrective_task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "findings_inspection_id_fkey"
            columns: ["inspection_id"]
            isOneToOne: false
            referencedRelation: "inspections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "findings_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "checklist_items"
            referencedColumns: ["id"]
          },
        ]
      }
      goal_checkins: {
        Row: {
          comment: string | null
          created_at: string
          created_by: string
          current_value: number
          goal_id: string
          id: string
          quarter: number
          rag: string
        }
        Insert: {
          comment?: string | null
          created_at?: string
          created_by?: string
          current_value: number
          goal_id: string
          id?: string
          quarter: number
          rag: string
        }
        Update: {
          comment?: string | null
          created_at?: string
          created_by?: string
          current_value?: number
          goal_id?: string
          id?: string
          quarter?: number
          rag?: string
        }
        Relationships: [
          {
            foreignKeyName: "goal_checkins_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "annual_goals"
            referencedColumns: ["id"]
          },
        ]
      }
      goal_milestones: {
        Row: {
          achieved_value: number | null
          due_date: string | null
          goal_id: string
          id: string
          quarter: number
          status: string
          target_value: number | null
          title: string
        }
        Insert: {
          achieved_value?: number | null
          due_date?: string | null
          goal_id: string
          id?: string
          quarter: number
          status?: string
          target_value?: number | null
          title: string
        }
        Update: {
          achieved_value?: number | null
          due_date?: string | null
          goal_id?: string
          id?: string
          quarter?: number
          status?: string
          target_value?: number | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "goal_milestones_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "annual_goals"
            referencedColumns: ["id"]
          },
        ]
      }
      inspection_answers: {
        Row: {
          floor_or_area: string | null
          id: string
          inspection_id: string
          item_id: string
          note: string | null
          photo_paths: string[]
          result: string
          severity: string | null
        }
        Insert: {
          floor_or_area?: string | null
          id?: string
          inspection_id: string
          item_id: string
          note?: string | null
          photo_paths?: string[]
          result: string
          severity?: string | null
        }
        Update: {
          floor_or_area?: string | null
          id?: string
          inspection_id?: string
          item_id?: string
          note?: string | null
          photo_paths?: string[]
          result?: string
          severity?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inspection_answers_inspection_id_fkey"
            columns: ["inspection_id"]
            isOneToOne: false
            referencedRelation: "inspections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inspection_answers_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "checklist_items"
            referencedColumns: ["id"]
          },
        ]
      }
      inspection_templates: {
        Row: {
          active: boolean
          due_day: number
          id: string
          item_codes: string[] | null
          name: string
          recurrence: string
          section_codes: string[]
          team_id: string | null
        }
        Insert: {
          active?: boolean
          due_day?: number
          id?: string
          item_codes?: string[] | null
          name: string
          recurrence?: string
          section_codes: string[]
          team_id?: string | null
        }
        Update: {
          active?: boolean
          due_day?: number
          id?: string
          item_codes?: string[] | null
          name?: string
          recurrence?: string
          section_codes?: string[]
          team_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inspection_templates_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      inspections: {
        Row: {
          assignee_id: string | null
          building_id: string
          compliance_percent: number | null
          created_at: string
          due_date: string
          id: string
          plan_id: string | null
          rejection_reason: string | null
          rejections: number
          report_same_day: boolean
          reviewed_at: string | null
          reviewed_by: string | null
          started_at: string | null
          status: string
          submitted_at: string | null
          task_id: string | null
          template_id: string
        }
        Insert: {
          assignee_id?: string | null
          building_id: string
          compliance_percent?: number | null
          created_at?: string
          due_date: string
          id?: string
          plan_id?: string | null
          rejection_reason?: string | null
          rejections?: number
          report_same_day?: boolean
          reviewed_at?: string | null
          reviewed_by?: string | null
          started_at?: string | null
          status?: string
          submitted_at?: string | null
          task_id?: string | null
          template_id: string
        }
        Update: {
          assignee_id?: string | null
          building_id?: string
          compliance_percent?: number | null
          created_at?: string
          due_date?: string
          id?: string
          plan_id?: string | null
          rejection_reason?: string | null
          rejections?: number
          report_same_day?: boolean
          reviewed_at?: string | null
          reviewed_by?: string | null
          started_at?: string | null
          status?: string
          submitted_at?: string | null
          task_id?: string | null
          template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inspections_assignee_id_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inspections_building_id_fkey"
            columns: ["building_id"]
            isOneToOne: false
            referencedRelation: "buildings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inspections_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "building_inspection_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inspections_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inspections_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "inspection_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          email_enabled: boolean
          user_id: string
        }
        Insert: {
          email_enabled?: boolean
          user_id?: string
        }
        Update: {
          email_enabled?: boolean
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          dedupe_key: string
          email_sent_at: string | null
          entity_id: string | null
          entity_type: string | null
          id: string
          link: string | null
          read_at: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          dedupe_key: string
          email_sent_at?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          link?: string | null
          read_at?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          dedupe_key?: string
          email_sent_at?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          link?: string | null
          read_at?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      phase_templates: {
        Row: {
          id: string
          name: string
          phases: Json
        }
        Insert: {
          id?: string
          name: string
          phases: Json
        }
        Update: {
          id?: string
          name?: string
          phases?: Json
        }
        Relationships: []
      }
      points_ledger: {
        Row: {
          created_at: string
          id: string
          points: number
          reason: string
          source_id: string | null
          source_type: string | null
          task_instance_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          points: number
          reason: string
          source_id?: string | null
          source_type?: string | null
          task_instance_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          points?: number
          reason?: string
          source_id?: string | null
          source_type?: string | null
          task_instance_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "points_ledger_task_instance_id_fkey"
            columns: ["task_instance_id"]
            isOneToOne: false
            referencedRelation: "task_instances"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string
          id: string
          is_active: boolean
          team_id: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string
          id: string
          is_active?: boolean
          team_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          is_active?: boolean
          team_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      project_phases: {
        Row: {
          completed_at: string | null
          deliverable: string
          depends_on_phase_id: string | null
          due_date: string
          id: string
          order_no: number
          owner_id: string
          project_id: string
          start_date: string | null
          status: string
          task_id: string | null
          title: string
        }
        Insert: {
          completed_at?: string | null
          deliverable: string
          depends_on_phase_id?: string | null
          due_date: string
          id?: string
          order_no: number
          owner_id: string
          project_id: string
          start_date?: string | null
          status?: string
          task_id?: string | null
          title: string
        }
        Update: {
          completed_at?: string | null
          deliverable?: string
          depends_on_phase_id?: string | null
          due_date?: string
          id?: string
          order_no?: number
          owner_id?: string
          project_id?: string
          start_date?: string | null
          status?: string
          task_id?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_phases_depends_on_phase_id_fkey"
            columns: ["depends_on_phase_id"]
            isOneToOne: false
            referencedRelation: "project_phases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_phases_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_phases_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_phases_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          cancel_reason: string | null
          created_at: string
          created_by: string | null
          description: string | null
          due_date: string
          goal_id: string | null
          id: string
          owner_id: string
          source_task_id: string | null
          start_date: string | null
          status: string
          team_id: string
          title: string
        }
        Insert: {
          cancel_reason?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date: string
          goal_id?: string | null
          id?: string
          owner_id: string
          source_task_id?: string | null
          start_date?: string | null
          status?: string
          team_id: string
          title: string
        }
        Update: {
          cancel_reason?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string
          goal_id?: string | null
          id?: string
          owner_id?: string
          source_task_id?: string | null
          start_date?: string | null
          status?: string
          team_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "annual_goals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_source_task_id_fkey"
            columns: ["source_task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      submissions: {
        Row: {
          checklist_results: Json
          created_at: string
          findings_count: number
          id: string
          notes: string | null
          photos: string[]
          task_instance_id: string
        }
        Insert: {
          checklist_results?: Json
          created_at?: string
          findings_count?: number
          id?: string
          notes?: string | null
          photos?: string[]
          task_instance_id: string
        }
        Update: {
          checklist_results?: Json
          created_at?: string
          findings_count?: number
          id?: string
          notes?: string | null
          photos?: string[]
          task_instance_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "submissions_task_instance_id_fkey"
            columns: ["task_instance_id"]
            isOneToOne: false
            referencedRelation: "task_instances"
            referencedColumns: ["id"]
          },
        ]
      }
      task_attachments: {
        Row: {
          created_at: string
          id: string
          name: string
          path: string
          task_id: string
          uploaded_by: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          path: string
          task_id: string
          uploaded_by?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          path?: string
          task_id?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_attachments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_comments: {
        Row: {
          author_id: string
          body: string
          created_at: string
          id: string
          task_id: string
        }
        Insert: {
          author_id?: string
          body: string
          created_at?: string
          id?: string
          task_id: string
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          id?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_comments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_contributors: {
        Row: {
          task_id: string
          user_id: string
        }
        Insert: {
          task_id: string
          user_id: string
        }
        Update: {
          task_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_contributors_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_contributors_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      task_instances: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          assignee_id: string | null
          building_id: string
          created_at: string
          due_date: string
          id: string
          rejection_reason: string | null
          report_submitted_same_day: boolean
          status: string
          submitted_at: string | null
          template_id: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          assignee_id?: string | null
          building_id: string
          created_at?: string
          due_date: string
          id?: string
          rejection_reason?: string | null
          report_submitted_same_day?: boolean
          status?: string
          submitted_at?: string | null
          template_id: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          assignee_id?: string | null
          building_id?: string
          created_at?: string
          due_date?: string
          id?: string
          rejection_reason?: string | null
          report_submitted_same_day?: boolean
          status?: string
          submitted_at?: string | null
          template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_instances_assignee_id_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_instances_building_id_fkey"
            columns: ["building_id"]
            isOneToOne: false
            referencedRelation: "buildings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_instances_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "task_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      task_steps: {
        Row: {
          done_at: string | null
          id: string
          is_done: boolean
          order_no: number
          task_id: string
          title: string
        }
        Insert: {
          done_at?: string | null
          id?: string
          is_done?: boolean
          order_no?: number
          task_id: string
          title: string
        }
        Update: {
          done_at?: string | null
          id?: string
          is_done?: boolean
          order_no?: number
          task_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_steps_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_templates: {
        Row: {
          active: boolean
          building_id: string
          checklist_items: Json
          created_at: string
          default_assignee_id: string | null
          due_day: number
          id: string
          recurrence: string
          requires_photo: boolean
          title: string
          type: string
        }
        Insert: {
          active?: boolean
          building_id: string
          checklist_items?: Json
          created_at?: string
          default_assignee_id?: string | null
          due_day?: number
          id?: string
          recurrence?: string
          requires_photo?: boolean
          title: string
          type?: string
        }
        Update: {
          active?: boolean
          building_id?: string
          checklist_items?: Json
          created_at?: string
          default_assignee_id?: string | null
          due_day?: number
          id?: string
          recurrence?: string
          requires_photo?: boolean
          title?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_templates_building_id_fkey"
            columns: ["building_id"]
            isOneToOne: false
            referencedRelation: "buildings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_templates_default_assignee_id_fkey"
            columns: ["default_assignee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          cancel_reason: string | null
          class_overridden_at: string | null
          class_overridden_by: string | null
          completed_at: string | null
          created_at: string
          created_by: string | null
          delay_note: string | null
          delay_reason: string | null
          description: string | null
          due_date: string
          final_class: string | null
          finding_id: string | null
          goal_id: string | null
          id: string
          inspection_id: string | null
          logged_after_due: boolean
          owner_id: string
          phase_id: string | null
          priority: string
          project_id: string | null
          start_date: string | null
          started_at: string | null
          status: string
          suggested_class: string | null
          team_id: string
          title: string
          updated_at: string
        }
        Insert: {
          cancel_reason?: string | null
          class_overridden_at?: string | null
          class_overridden_by?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          delay_note?: string | null
          delay_reason?: string | null
          description?: string | null
          due_date: string
          final_class?: string | null
          finding_id?: string | null
          goal_id?: string | null
          id?: string
          inspection_id?: string | null
          logged_after_due?: boolean
          owner_id: string
          phase_id?: string | null
          priority?: string
          project_id?: string | null
          start_date?: string | null
          started_at?: string | null
          status?: string
          suggested_class?: string | null
          team_id: string
          title: string
          updated_at?: string
        }
        Update: {
          cancel_reason?: string | null
          class_overridden_at?: string | null
          class_overridden_by?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          delay_note?: string | null
          delay_reason?: string | null
          description?: string | null
          due_date?: string
          final_class?: string | null
          finding_id?: string | null
          goal_id?: string | null
          id?: string
          inspection_id?: string | null
          logged_after_due?: boolean
          owner_id?: string
          phase_id?: string | null
          priority?: string
          project_id?: string | null
          start_date?: string | null
          started_at?: string | null
          status?: string
          suggested_class?: string | null
          team_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_finding_id_fkey"
            columns: ["finding_id"]
            isOneToOne: false
            referencedRelation: "findings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "annual_goals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_inspection_id_fkey"
            columns: ["inspection_id"]
            isOneToOne: false
            referencedRelation: "inspections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_phase_id_fkey"
            columns: ["phase_id"]
            isOneToOne: false
            referencedRelation: "project_phases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          id: string
          name: string
        }
        Insert: {
          id?: string
          name: string
        }
        Update: {
          id?: string
          name?: string
        }
        Relationships: []
      }
      user_badges: {
        Row: {
          awarded_at: string
          badge_id: string
          user_id: string
        }
        Insert: {
          awarded_at?: string
          badge_id: string
          user_id: string
        }
        Update: {
          awarded_at?: string
          badge_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_badges_badge_id_fkey"
            columns: ["badge_id"]
            isOneToOne: false
            referencedRelation: "badges"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      _approve_inspection: {
        Args: { p_at: string; p_by: string; p_id: string }
        Returns: number
      }
      _audit: {
        Args: {
          _field: string
          _id: string
          _new: string
          _old: string
          _team: string
          _type: string
        }
        Returns: undefined
      }
      _award_badges: { Args: { p_instance: string }; Returns: undefined }
      _award_points: { Args: { p_instance: string }; Returns: number }
      _create_finding: {
        Args: {
          p_area: string
          p_building: string
          p_desc: string
          p_from: string
          p_inspection: string
          p_inspector: string
          p_item: string
          p_photos: string[]
          p_report: string
          p_sev: string
        }
        Returns: string
      }
      _daily_job: { Args: never; Returns: number }
      _generate_inspections: { Args: { p_month: string }; Returns: number }
      _generate_tasks: { Args: { p_month: string }; Returns: number }
      _give_badge: {
        Args: { p_code: string; p_user: string }
        Returns: undefined
      }
      _give_points: {
        Args: {
          _at: string
          _pts: number
          _reason: string
          _sid: string
          _stype: string
          _user: string
        }
        Returns: undefined
      }
      _inspection_badges: { Args: { p_id: string }; Returns: undefined }
      _is_photo_path_ok: {
        Args: { _paths: string[]; _user: string }
        Returns: boolean
      }
      _notify: {
        Args: {
          _body: string
          _eid: string
          _etype: string
          _key: string
          _link: string
          _title: string
          _type: string
          _user: string
        }
        Returns: number
      }
      _on_time: {
        Args: { t: Database["public"]["Tables"]["task_instances"]["Row"] }
        Returns: boolean
      }
      _recognition: {
        Args: { p_month: string; p_team: string }
        Returns: {
          actions_closed: number
          documented: number
          eligible: boolean
          full_name: string
          points: number
          rank: number
          rejections: number
          rounds_on_time: number
          rounds_total: number
          same_day: number
          team_id: string
          user_id: string
        }[]
      }
      _recognition_notify: { Args: { p_day: string }; Returns: number }
      _run_notifications: { Args: { p_day?: string }; Returns: number }
      _severity_due: { Args: { _from: string; _sev: string }; Returns: string }
      _submit_inspection: {
        Args: {
          p_answers: Json
          p_at: string
          p_check_photos: boolean
          p_id: string
          p_same_day: boolean
          p_user: string
        }
        Returns: number
      }
      _team_managers: { Args: { _team: string }; Returns: string[] }
      _verify_finding: {
        Args: {
          p_accept: boolean
          p_at: string
          p_by: string
          p_id: string
          p_reason: string
        }
        Returns: undefined
      }
      add_workdays: { Args: { d: string; n: number }; Returns: string }
      apply_decision: {
        Args: {
          p_decision: string
          p_meeting?: string
          p_new_due: string
          p_new_owner: string
          p_reason: string
          p_task: string
        }
        Returns: undefined
      }
      approve_inspection: { Args: { p_id: string }; Returns: number }
      approve_submission: { Args: { p_instance: string }; Returns: number }
      building_board: {
        Args: { p_month: string }
        Returns: {
          approved: number
          assigned: number
          building_id: string
          code: string
          compliance: number
          name: string
          on_time: number
          on_time_rate: number
          open_critical: number
          open_high: number
          open_total: number
        }[]
      }
      building_compliance_trend: {
        Args: { p_months?: number }
        Returns: {
          building_code: string
          compliance: number
          month: string
        }[]
      }
      building_leaderboard: {
        Args: { p_month: string }
        Returns: {
          assigned: number
          building_id: string
          code: string
          completed: number
          findings: number
          name: string
          on_time: number
          on_time_rate: number
        }[]
      }
      building_team: { Args: { _b: string }; Returns: string }
      can_see_finding: { Args: { _f: string }; Returns: boolean }
      can_see_inspection: { Args: { _i: string }; Returns: boolean }
      can_see_project: { Args: { _p: string }; Returns: boolean }
      can_see_task: { Args: { _task: string }; Returns: boolean }
      can_see_task_text: { Args: { _t: string }; Returns: boolean }
      challenge_progress: {
        Args: { p_challenge: string }
        Returns: {
          assigned: number
          on_time: number
          rate: number
        }[]
      }
      challenge_progress2: {
        Args: { p_challenge: string }
        Returns: {
          assigned: number
          on_time: number
          rate: number
        }[]
      }
      classify_task: {
        Args: {
          _created: string
          _due: string
          _id: string
          _inspection: string
          _start: string
          _started: string
          _status: string
        }
        Returns: string
      }
      close_finding: {
        Args: {
          p_delay_note?: string
          p_delay_reason?: string
          p_id: string
          p_note: string
          p_photos: string[]
        }
        Returns: undefined
      }
      convert_report: { Args: { p_id: string; p_sev: string }; Returns: string }
      create_project: {
        Args: {
          p_description: string
          p_due: string
          p_goal: string
          p_owner: string
          p_phases: Json
          p_source_task: string
          p_start: string
          p_team: string
          p_title: string
        }
        Returns: string
      }
      dismiss_report: {
        Args: { p_id: string; p_reason: string }
        Returns: undefined
      }
      generate_inspections: { Args: { p_month?: string }; Returns: number }
      generate_month_tasks: { Args: { p_month?: string }; Returns: number }
      goal_access: { Args: { _g: string; _write: boolean }; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      inspection_items: {
        Args: { _inspection: string }
        Returns: {
          code: string
          default_severity: string
          item_id: string
          item_order: number
          photo_required_on_issue: boolean
          section_code: string
          section_name: string
          section_order: number
          text: string
        }[]
      }
      is_admin: { Args: never; Returns: boolean }
      is_contributor: { Args: { _task: string }; Returns: boolean }
      is_manager_of: { Args: { _team: string }; Returns: boolean }
      is_member: { Args: never; Returns: boolean }
      is_staff: { Args: never; Returns: boolean }
      is_workday: { Args: { d: string }; Returns: boolean }
      my_team: { Args: never; Returns: string }
      photo_visible: { Args: { _name: string }; Returns: boolean }
      recognition_candidates: {
        Args: { p_month?: string; p_team?: string }
        Returns: {
          actions_closed: number
          documented: number
          eligible: boolean
          full_name: string
          points: number
          rank: number
          rejections: number
          rounds_on_time: number
          rounds_total: number
          same_day: number
          team_id: string
          user_id: string
        }[]
      }
      reject_inspection: {
        Args: { p_id: string; p_reason: string }
        Returns: undefined
      }
      reject_submission: {
        Args: { p_instance: string; p_reason: string }
        Returns: undefined
      }
      riyadh_today: { Args: never; Returns: string }
      run_notifications_now: { Args: never; Returns: number }
      setting: { Args: { _k: string }; Returns: Json }
      start_inspection: { Args: { p_id: string }; Returns: undefined }
      start_task: { Args: { p_instance: string }; Returns: undefined }
      submit_inspection: {
        Args: { p_answers: Json; p_id: string; p_same_day: boolean }
        Returns: number
      }
      submit_report: {
        Args: {
          p_area: string
          p_building: string
          p_desc: string
          p_photos: string[]
          p_sev: string
        }
        Returns: string
      }
      submit_task: {
        Args: {
          p_instance: string
          p_notes: string
          p_photos: string[]
          p_results: Json
          p_same_day: boolean
        }
        Returns: string
      }
      user_team: { Args: { _u: string }; Returns: string }
      verify_finding: {
        Args: { p_accept: boolean; p_id: string; p_reason?: string }
        Returns: undefined
      }
      workdays_between: { Args: { a: string; b: string }; Returns: number }
    }
    Enums: {
      app_role: "employee" | "manager" | "admin"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: ["employee", "manager", "admin"],
    },
  },
} as const
