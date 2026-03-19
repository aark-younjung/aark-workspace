import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://mfnatapmmmgytrjvwcxy.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1mbmF0YXBtbW1neXRyand3Y3h5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDA4NTMyMDAsImV4cCI6MjA1NjQyOTIwMH0.K4AXxMHVd0VqeFR9gUGMSyq-zVYHj4pH1vsH5KGT1GE'

export const supabase = createClient(supabaseUrl, supabaseKey)
