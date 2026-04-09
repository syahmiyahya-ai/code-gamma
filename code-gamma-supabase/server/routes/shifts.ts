import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { supabaseAdmin } from '../supabase.js';

export const shiftsRouter = Router();

shiftsRouter.get('/shifts', requireAuth, async (req, res) => {
  const start = String(req.query.start_date || '');
  const end = String(req.query.end_date || '');

  if (!start || !end) {
    return res.status(400).json({ error: 'start_date and end_date are required' });
  }

  const { data, error } = await supabaseAdmin
    .from('shifts')
    .select('id,user_id,date,shift_code,is_code_blue')
    .gte('date', start)
    .lte('date', end)
    .order('date', { ascending: true });

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  return res.json(data);
});
