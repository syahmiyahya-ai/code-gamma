import { Router } from "express";
import { taskService } from "../services/taskService";
import { db } from "../db/db";

const router = Router();

router.get("/tasks", (req, res) => {
  try {
    const tasks = taskService.getTasks();
    res.json(tasks);
  } catch (err) {
    console.error("Error fetching tasks:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/tasks/:id/assignments", (req, res) => {
  try {
    const assignments = taskService.getTaskAssignments(Number(req.params.id));
    res.json(assignments);
  } catch (err) {
    console.error("Error fetching task assignments:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/tasks", (req, res) => {
  try {
    const taskId = taskService.createTask(req.body);
    res.json({ success: true, id: taskId });
  } catch (err) {
    console.error("Error creating task:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/my-tasks", (req, res) => {
  try {
    const { user_id } = req.query;
    if (!user_id) return res.json([]);
    const tasks = taskService.getMyTasks(user_id as string);
    res.json(tasks);
  } catch (err) {
    console.error("Error fetching my tasks:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/task-assignments/:id", (req, res) => {
  try {
    const { status } = req.body;
    taskService.updateTaskAssignment(Number(req.params.id), status);
    res.json({ success: true });
  } catch (err) {
    console.error("Error updating task assignment:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/tasks/:id", (req, res) => {
  try {
    taskService.updateTask(Number(req.params.id), req.body);
    res.json({ success: true });
  } catch (err) {
    console.error("Error updating task:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/tasks/:id", (req, res) => {
  try {
    taskService.deleteTask(Number(req.params.id));
    res.json({ success: true });
  } catch (err) {
    console.error("Error deleting task:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/tasks/nudge", (req, res) => {
  try {
    const { user_id, task_title } = req.body;
    taskService.nudgeTask(user_id, task_title);
    res.json({ success: true });
  } catch (err) {
    console.error("Error nudging task:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/tasks/pending-count", (req, res) => {
  try {
    const { user_id } = req.query;
    if (!user_id) return res.status(400).json({ error: "user_id is required" });
    
    const count = db.prepare(`
      SELECT COUNT(*) as count 
      FROM task_assignments 
      WHERE user_id = ? AND status = 'PENDING'
    `).get(user_id) as { count: number };
    
    res.json({ count: count.count });
  } catch (err) {
    console.error("Error fetching pending task count:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
