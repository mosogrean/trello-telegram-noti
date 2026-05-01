import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { initDatabase } from './config/database';
import authRoutes from './routes/auth';
import telegramRoutes, { resumePendingPolling } from './routes/telegram';
import boardRoutes from './routes/boards';
import webhookRoutes from './routes/webhook';
import configRoutes from './routes/config';

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);

initDatabase();
resumePendingPolling();

app.use(cors({
  origin: process.env.NODE_ENV === 'production' ? false : 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api/auth', authRoutes);
app.use('/api/bots', telegramRoutes);
app.use('/api/boards', boardRoutes);
app.use('/api/webhook', webhookRoutes);
app.use('/api/config', configRoutes);

// Serve React frontend in production
if (process.env.NODE_ENV === 'production') {
  const clientBuild = path.join(__dirname, '../../client/dist');
  app.use(express.static(clientBuild));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(clientBuild, 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

export default app;
