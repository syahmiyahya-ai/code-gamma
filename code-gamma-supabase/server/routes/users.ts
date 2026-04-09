import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { supabaseAdmin } from '../supabase.js';

export const usersRouter = Router();

usersRouter.get('/users/me', requireAuth, async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('users')
    .select('id,name,role,phone_number,email,avatar_url,created_at,updated_at')
    .eq('id', req.user!.id)
    .single();

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  return res.json(data);
});

usersRouter.patch('/users/me', requireAuth, async (req, res) => {
  const updates: Record<string, unknown> = {};

  if (req.body.phone_number !== undefined) updates.phone_number = req.body.phone_number;
  if (req.body.email !== undefined) updates.email = req.body.email;
  if (req.body.avatar_url !== undefined) updates.avatar_url = req.body.avatar_url;

  updates.updated_at = new Date().toISOString();

  const { error } = await supabaseAdmin.from('users').update(updates).eq('id', req.user!.id);
  if (error) {
    return res.status(500).json({ error: error.message });
  }

  return res.json({ success: true });
});
