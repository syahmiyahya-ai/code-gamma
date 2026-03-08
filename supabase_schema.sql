-- SQL Schema for Supabase (PostgreSQL)
-- Timezone: Asia/Kuala_Lumpur (UTC+8)

-- 1. Create Shift Types table
CREATE TABLE shift_types (
    code TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    background_color TEXT NOT NULL,
    text_color TEXT NOT NULL
);

-- Insert initial shift types
INSERT INTO shift_types (code, name, background_color, text_color) VALUES
('AM', 'Morning Shift', '#dcfce7', '#166534'), -- Green
('PM', 'Afternoon Shift', '#fef9c3', '#854d0e'), -- Yellow
('NS', 'Night Shift', '#dbeafe', '#1e40af'), -- Blue
('FL', 'Floating', '#f3e8ff', '#6b21a8'), -- Purple
('WP', 'Ward Post', '#fee2e2', '#991b1b'), -- Red
('HK', 'Housekeeping/Admin', '#f1f5f9', '#334155'), -- Slate
('CR', 'Clinic/Round', '#ffedd5', '#9a3412'); -- Orange

-- 2. Create Users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT auth.uid(),
    name TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('Admin', 'Staff')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Create Shifts table
CREATE TABLE shifts (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    shift_code TEXT REFERENCES shift_types(code),
    is_code_blue BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Create Audit Logs table
CREATE TABLE shift_audit_logs (
    id BIGSERIAL PRIMARY KEY,
    shift_id BIGINT,
    action TEXT NOT NULL,
    changed_by UUID REFERENCES users(id),
    old_data JSONB,
    new_data JSONB,
    timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS (Row Level Security)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE shift_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE shift_audit_logs ENABLE ROW LEVEL SECURITY;

-- Policies (Simplified for initial setup)
CREATE POLICY "Public read access for shift_types" ON shift_types FOR SELECT USING (true);
CREATE POLICY "Public read access for users" ON users FOR SELECT USING (true);
CREATE POLICY "Public read access for shifts" ON shifts FOR SELECT USING (true);
CREATE POLICY "Admin can manage shifts" ON shifts FOR ALL USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'Admin')
);

-- 5. Create Announcements table
CREATE TABLE announcements (
    id BIGSERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    author_id UUID REFERENCES users(id) ON DELETE SET NULL,
    is_pinned BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Create Documents table
CREATE TABLE documents (
    id BIGSERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('SOP', 'Forms', 'Guidelines', 'Others')),
    file_url TEXT NOT NULL,
    uploaded_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS for new tables
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

-- Policies for Announcements
CREATE POLICY "Staff can read announcements" ON announcements FOR SELECT USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid())
);
CREATE POLICY "Admin can manage announcements" ON announcements FOR ALL USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'Admin')
);

-- Policies for Documents
CREATE POLICY "Staff can read documents" ON documents FOR SELECT USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid())
);
CREATE POLICY "Admin can manage documents" ON documents FOR ALL USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'Admin')
);

-- 7. Storage Bucket Setup (Instructions for Supabase Dashboard)
-- Bucket Name: intranet_files
-- Public: False (Recommended for internal documents)

-- Storage RLS Policies (Run in SQL Editor)
/*
-- Allow public read access to authenticated users
CREATE POLICY "Authenticated users can view intranet files"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'intranet_files');

-- Allow admins to upload/delete files
CREATE POLICY "Admins can manage intranet files"
ON storage.objects FOR ALL
TO authenticated
USING (
    bucket_id = 'intranet_files' AND 
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'Admin')
);
*/
