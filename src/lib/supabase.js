import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://mekmvytdzxmwjvpnmike.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFla3std29ya3NwYWNlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDA2MTc2ODAsImV4cCI6MjA1NjE5MzY4MH0.K4AXxMHVd0VqeFR9gUGMSyq-zVYHj4pH1vM0aZ8n5Q'

export const supabase = createClient(supabaseUrl, supabaseKey)
