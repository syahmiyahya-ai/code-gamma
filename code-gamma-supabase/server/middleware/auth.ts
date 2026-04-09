import type { NextFunction, Request, Response } from 'express';
import { supabaseAdmin } from '../supabase.js';

export type AppUser = {
  id: string;
  email?: string;
};

declare global {
  namespace Express {
    interface Request {
      user?: AppUser;
    }
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.header('authorization');
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;

  if (!token) {
    return res.status(401).json({ error: 'Missing bearer token' });
  }

  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user) {
    return res.status(401).json({ error: 'Invalid token' });
  }

  req.user = { id: data.user.id, email: data.user.email };
  next();
}
