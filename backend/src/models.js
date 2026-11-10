import mongoose from 'mongoose';

const { Schema } = mongoose;

const userSchema = new Schema({
  name: { type: String, required: true, trim: true, maxlength: 100 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 254 },
  passwordHash: { type: String, required: true, select: false },
  role: { type: String, enum: ['admin', 'student'], required: true, default: 'student' },
}, { timestamps: true });

const stateSchema = new Schema({
  stateKey: { type: String, required: true, unique: true },
  payload: { type: Schema.Types.Mixed, default: () => ({}) },
}, { timestamps: true, minimize: false });

const studentStateSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, required: true, unique: true, ref: 'User' },
  payload: { type: Schema.Types.Mixed, default: () => ({ checkins: [], payments: [], complaints: [], feedback: [] }) },
}, { timestamps: true, minimize: false });

export const User = mongoose.models.User || mongoose.model('User', userSchema);
export const AppState = mongoose.models.AppState || mongoose.model('AppState', stateSchema);
export const StudentPortalState = mongoose.models.StudentPortalState || mongoose.model('StudentPortalState', studentStateSchema);
