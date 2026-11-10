import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { initializeDatabase, mongoose } from './db.js';
import { User } from './models.js';

try {
  await initializeDatabase();
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password || password.length < 12) throw new Error('Set ADMIN_EMAIL and ADMIN_PASSWORD (at least 12 characters) in backend/.env first.');
  const hash = await bcrypt.hash(password, 12);
  await User.findOneAndUpdate({ email }, { name: process.env.ADMIN_NAME || 'Mess Administrator', email, passwordHash: hash, role: 'admin' }, { upsert: true, new: true, runValidators: true });
  console.log(`Admin account ready: ${email}`);
} finally {
  await mongoose.disconnect();
}
