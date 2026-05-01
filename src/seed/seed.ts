import dotenv from 'dotenv';
dotenv.config();

import bcrypt from 'bcrypt';
import db, { initDatabase } from '../config/database';

async function seed(): Promise<void> {
  initDatabase();

  const username = process.env.SEED_ADMIN_USERNAME || 'admin';
  const password = process.env.SEED_ADMIN_PASSWORD || 'admin123';

  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (existing) {
    console.log(`Admin user "${username}" already exists. Skipping seed.`);
    return;
  }

  const hash = await bcrypt.hash(password, 12);
  db.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)').run(username, hash);

  console.log(`Admin user created:`);
  console.log(`  Username: ${username}`);
  console.log(`  Password: ${password}`);
  console.log(`\nChange the password after first login!`);
}

seed().catch(console.error);
