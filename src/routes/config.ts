import { Router, Response } from 'express';
import { requireAuth, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(requireAuth);

router.get('/', (_req: AuthRequest, res: Response): void => {
  const appBaseUrl = process.env.APP_BASE_URL || 'http://localhost:3000';
  res.json({
    appBaseUrl,
    webhookUrl: `${appBaseUrl}/api/webhook/trello`,
    nodeEnv: process.env.NODE_ENV || 'development',
    port: process.env.PORT || '3000',
  });
});

router.get('/ping', async (_req: AuthRequest, res: Response): Promise<void> => {
  const appBaseUrl = process.env.APP_BASE_URL || 'http://localhost:3000';
  const webhookUrl = `${appBaseUrl}/api/webhook/trello`;
  const start = Date.now();
  try {
    const response = await fetch(webhookUrl, { method: 'HEAD' });
    res.json({
      ok: response.status === 200,
      status: response.status,
      latencyMs: Date.now() - start,
      url: webhookUrl,
    });
  } catch (err) {
    res.json({
      ok: false,
      error: err instanceof Error ? err.message : 'Connection failed',
      latencyMs: Date.now() - start,
      url: webhookUrl,
    });
  }
});

export default router;
