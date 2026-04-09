import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { usersRouter } from './routes/users.js';
import { shiftsRouter } from './routes/shifts.js';

const app = express();
const port = Number(process.env.PORT || 3001);

app.use(cors());
app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', service: 'code-gamma-supabase', ts: new Date().toISOString() });
});

app.use('/api', usersRouter);
app.use('/api', shiftsRouter);

app.listen(port, () => {
  console.log(`Code Gamma Supabase API running on :${port}`);
});
