import jwt from 'jsonwebtoken';
import { User } from './models.js';

export function createToken(user) {
  return jwt.sign({ sub: String(user.id || user._id), role: user.role, name: user.name, email: user.email }, process.env.JWT_SECRET, { expiresIn: '12h', issuer: 'smart-mess-api' });
}

export async function requireAuth(req, res, next) {
  try {
    const [scheme, token] = (req.headers.authorization || '').split(' ');
    if (scheme !== 'Bearer' || !token) return res.status(401).json({ error: 'Sign in to continue.' });
    const claims = jwt.verify(token, process.env.JWT_SECRET, { issuer: 'smart-mess-api' });
    const user = await User.findById(claims.sub).select('name email role').lean();
    if (!user) return res.status(401).json({ error: 'Account is no longer available.' });
    req.user = { id: String(user._id), name: user.name, email: user.email, role: user.role };
    next();
  } catch {
    return res.status(401).json({ error: 'Your session expired. Please sign in again.' });
  }
}

export function requireRole(role) {
  return (req, res, next) => req.user?.role === role ? next() : res.status(403).json({ error: 'You do not have permission to do that.' });
}
