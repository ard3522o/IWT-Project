import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { initializeDatabase, mongoose } from './db.js';
import { AppState, StudentPortalState, User } from './models.js';
import { createToken, requireAuth, requireRole } from './auth.js';

const app = express();
const port = Number(process.env.PORT || 4000);
const origins = (process.env.FRONTEND_ORIGIN || 'http://localhost:5173').split(',').map(x => x.trim());
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) throw new Error('JWT_SECRET must contain at least 32 characters');

app.disable('x-powered-by');
app.use(helmet());
app.use(cors({ origin: (origin, cb) => !origin || origins.includes(origin) ? cb(null, true) : cb(new Error('Origin not allowed by CORS')), methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'], allowedHeaders: ['Content-Type','Authorization'] }));
app.use(express.json({ limit: '1mb' }));
app.use('/api/auth', rateLimit({ windowMs: 15 * 60 * 1000, limit: 40, standardHeaders: 'draft-7', legacyHeaders: false }));

const registerSchema = z.object({ name: z.string().trim().min(2).max(100), email: z.string().trim().email().max(254), password: z.string().min(10).max(128) });
const loginSchema = z.object({ email: z.string().trim().email().max(254), password: z.string().min(1).max(128) });
const objectSchema = z.record(z.string(), z.unknown());

app.get('/api/health', async (_req, res) => {
  const connected = mongoose.connection.readyState === 1;
  res.status(connected ? 200 : 503).json({ status: connected ? 'ok' : 'error', database: connected ? 'connected' : 'unavailable' });
});

app.post('/api/auth/register', async (req, res, next) => {
  try {
    const input = registerSchema.parse(req.body);
    const passwordHash = await bcrypt.hash(input.password, 12);
    const user = await User.create({ name: input.name, email: input.email.toLowerCase(), passwordHash, role: 'student' });
    const safeUser = { id: String(user._id), name: user.name, email: user.email, role: user.role };
    res.status(201).json({ user: safeUser, token: createToken(safeUser) });
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ error: 'An account with this email already exists.' });
    next(err);
  }
});

app.post('/api/auth/login', async (req, res, next) => {
  try {
    const input = loginSchema.parse(req.body);
    const user = await User.findOne({ email: input.email.toLowerCase() }).select('+passwordHash');
    if (!user || !(await bcrypt.compare(input.password, user.passwordHash))) return res.status(401).json({ error: 'Email or password is incorrect.' });
    const safeUser = { id: String(user._id), name: user.name, email: user.email, role: user.role };
    res.json({ user: safeUser, token: createToken(safeUser) });
  } catch (err) { next(err); }
});

app.get('/api/auth/me', requireAuth, (req, res) => res.json({ user: req.user }));
app.post('/api/auth/logout', requireAuth, (_req, res) => res.json({ ok: true }));

app.get('/api/admin/data', requireAuth, requireRole('admin'), async (_req, res, next) => {
  try {
    const state = await AppState.findOne({ stateKey: 'main' }).lean();
    res.json({ data: state?.payload || {} });
  } catch (err) { next(err); }
});
app.put('/api/admin/data', requireAuth, requireRole('admin'), async (req, res, next) => {
  try {
    const data = objectSchema.parse(req.body.data);
    const allowed = ['students','menu','complaints','inventory','feedback','payments'];
    for (const key of allowed) if (data[key] !== undefined && !Array.isArray(data[key])) return res.status(400).json({ error: `${key} must be an array.` });
    const state = await AppState.findOneAndUpdate({ stateKey: 'main' }, { $set: { payload: data } }, { upsert: true, new: true, runValidators: true });
    res.json({ ok: true, updatedAt: state.updatedAt });
  } catch (err) { next(err); }
});

app.get('/api/student/portal', requireAuth, requireRole('student'), async (req, res, next) => {
  try {
    const state = await StudentPortalState.findOne({ userId: req.user.id }).lean();
    res.json({ data: state?.payload || { checkins: [], payments: [], complaints: [], feedback: [] } });
  } catch (err) { next(err); }
});
app.put('/api/student/portal', requireAuth, requireRole('student'), async (req, res, next) => {
  try {
    const data = objectSchema.parse(req.body.data);
    const allowed = ['checkins','payments','complaints','feedback'];
    for (const key of allowed) if (data[key] !== undefined && !Array.isArray(data[key])) return res.status(400).json({ error: `${key} must be an array.` });
    const previous = await StudentPortalState.findOne({ userId: req.user.id }).lean();
    const before = previous?.payload || { checkins: [], payments: [], complaints: [], feedback: [] };
    const merged = { ...before, ...data };
    await StudentPortalState.findOneAndUpdate({ userId: req.user.id }, { $set: { payload: merged } }, { upsert: true, new: true, runValidators: true });

    const adminState = await AppState.findOne({ stateKey: 'main' });
    if (adminState) {
      const adminData = adminState.payload.toObject ? adminState.payload.toObject() : { ...adminState.payload };
      for (const [studentKey, adminKey] of [['complaints','complaints'],['feedback','feedback']]) {
        const priorIds = new Set((before[studentKey] || []).map(x => x.id).filter(Boolean));
        const additions = (merged[studentKey] || []).filter(x => x.id && !priorIds.has(x.id));
        for (const item of additions) {
          const record = studentKey === 'complaints' ? { ...item, student: req.user.name } : { ...item, name: req.user.name };
          if (!(adminData[adminKey] || []).some(x => x.id && x.id === record.id)) adminData[adminKey] = [record, ...(adminData[adminKey] || [])];
        }
      }
      adminState.payload = adminData;
      await adminState.save();
    }
    res.json({ ok: true, data: merged });
  } catch (err) { next(err); }
});

app.use((err, _req, res, _next) => {
  if (err instanceof z.ZodError) return res.status(400).json({ error: err.issues[0]?.message || 'Invalid request.' });
  if (err.message === 'Origin not allowed by CORS') return res.status(403).json({ error: err.message });
  if (err.name === 'ValidationError') return res.status(400).json({ error: err.message });
  console.error(err);
  res.status(500).json({ error: 'Unexpected server error.' });
});

await initializeDatabase();
if (process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD) {
  if (process.env.ADMIN_PASSWORD.length < 12) throw new Error('ADMIN_PASSWORD must contain at least 12 characters');
  const existing = await User.findOne({ email: process.env.ADMIN_EMAIL.trim().toLowerCase() });
  if (!existing) await User.create({ name: process.env.ADMIN_NAME || 'Mess Administrator', email: process.env.ADMIN_EMAIL.trim().toLowerCase(), passwordHash: await bcrypt.hash(process.env.ADMIN_PASSWORD, 12), role: 'admin' });
}
app.listen(port, '0.0.0.0', () => console.log(`Smart Mess API listening on ${port}`));
