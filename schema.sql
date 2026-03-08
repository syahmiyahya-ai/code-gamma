-- PART 1: Supabase SQL Schema & Triggers

-- 1. Tasks Table
CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  due_date TIMESTAMPTZ,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  is_edited BOOLEAN DEFAULT FALSE,
  is_deleted BOOLEAN DEFAULT FALSE
);

-- 2. Task Assignments Table
CREATE TYPE task_status AS ENUM ('PENDING', 'COMPLETED');

CREATE TABLE task_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  status task_status DEFAULT 'PENDING',
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Notifications Table (Assumed existing, but here is the structure)
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL, -- 'TASK_ALERT', 'SYSTEM', etc.
  related_entity_id UUID,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Trigger Function for New Assignments
CREATE OR REPLACE FUNCTION notify_new_task_assignment()
RETURNS TRIGGER AS $$
DECLARE
  task_title TEXT;
  task_description TEXT;
  task_due_date TIMESTAMPTZ;
  desc_snippet TEXT;
  final_message TEXT;
BEGIN
  -- Get task details
  SELECT title, description, due_date INTO task_title, task_description, task_due_date 
  FROM tasks WHERE id = NEW.task_id;

  -- Create description snippet
  IF task_description IS NOT NULL THEN
    IF length(task_description) > 60 THEN
      desc_snippet := left(task_description, 57) || '...';
    ELSE
      desc_snippet := task_description;
    END IF;
  ELSE
    desc_snippet := 'No description provided.';
  END IF;

  -- Construct final message
  final_message := 'You have been assigned a new task: "' || task_title || '"' || chr(10) || chr(10) ||
                   'Description: ' || desc_snippet;
  
  IF task_due_date IS NOT NULL THEN
    final_message := final_message || chr(10) || 'Due Date: ' || task_due_date::text;
  END IF;

  final_message := final_message || chr(10) || 'View your tasks in the dashboard.';

  -- Insert notification
  INSERT INTO notifications (user_id, title, message, type, related_entity_id)
  VALUES (
    NEW.user_id,
    'New Task Assigned',
    final_message,
    'TASK_ALERT',
    NEW.task_id
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5. Trigger for task_assignments
CREATE TRIGGER on_task_assignment_created
AFTER INSERT ON task_assignments
FOR EACH ROW
EXECUTE FUNCTION notify_new_task_assignment();
