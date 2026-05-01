import crypto from 'crypto';
import db from '../config/database';
import { sendOtp, sendStartNotiResponse } from './telegramService';

export function generateOtp(): string {
  return Math.floor(100000 + crypto.randomInt(900000)).toString();
}

export async function createAndSendOtp(botId: number, botToken: string, chatId: string): Promise<void> {
  db.prepare('UPDATE otp_verifications SET verified = -1 WHERE bot_id = ? AND verified = 0').run(botId);

  const otp = generateOtp();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

  db.prepare(
    'INSERT INTO otp_verifications (bot_id, otp_code, expires_at) VALUES (?, ?, ?)'
  ).run(botId, otp, expiresAt);

  await sendOtp(botToken, chatId, otp);
}

export async function createAndSendStartNotiOtp(
  botId: number,
  botToken: string,
  chatId: string
): Promise<void> {
  db.prepare('UPDATE otp_verifications SET verified = -1 WHERE bot_id = ? AND verified = 0').run(botId);

  const otp = generateOtp();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

  db.prepare(
    'INSERT INTO otp_verifications (bot_id, otp_code, expires_at) VALUES (?, ?, ?)'
  ).run(botId, otp, expiresAt);

  await sendStartNotiResponse(botToken, chatId, otp);
}

export function verifyOtp(botId: number, otpCode: string): boolean {
  const record = db.prepare(
    `SELECT * FROM otp_verifications
     WHERE bot_id = ? AND otp_code = ? AND verified = 0
     AND datetime(expires_at) > datetime('now')`
  ).get(botId, otpCode) as { id: number } | undefined;

  if (!record) return false;

  db.prepare('UPDATE otp_verifications SET verified = 1 WHERE id = ?').run(record.id);
  db.prepare('UPDATE telegram_bots SET verified = 1 WHERE id = ?').run(botId);

  return true;
}
