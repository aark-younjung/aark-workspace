import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://mekmvytdzxmwjvpnmike.supabase.co'
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1la212eXRkenhtd2p2cG5taWtlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM5MTQ1ODcsImV4cCI6MjA4OTQ5MDU4N30.aH8PfQ7LqCoICU2sLJ-Vm6cwG9Cf2F71bWZV4D7RHdA'

export const supabase = createClient(supabaseUrl, supabaseKey)
