import 'dotenv/config';
import mongoose from 'mongoose';
import { AppState, StudentPortalState, User } from './models.js';

if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is required');

export { mongoose };

export async function initializeDatabase() {
  await mongoose.connect(process.env.MONGODB_URI, {
    serverSelectionTimeoutMS: 10_000,
    maxPoolSize: Number(process.env.DB_POOL_SIZE || 10),
  });
  await Promise.all([User.init(), AppState.init(), StudentPortalState.init()]);
  await AppState.updateOne({ stateKey: 'main' }, { $setOnInsert: { payload: {} } }, { upsert: true });
}
