import { createClient, SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = "https://qexnthgfdvtvwoeykgun.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFleG50aGdmZHZ0dndvZXlrZ3VuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDYxMDM2MDcsImV4cCI6MjA2MTY3OTYwN30.c2HTWKLsjtVmLJlJhVUClTHd_AjlMYw3epVVVip1E0E";

export const supabase: SupabaseClient | null =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null;
