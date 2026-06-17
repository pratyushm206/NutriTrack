const express = require('express');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const auth = require('../middleware/auth');
const prisma = require('../lib/prisma');
const { sendPasswordResetEmail } = require('../services/emailService');

const router = express.Router();

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function isEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function requireJwtSecret(res) {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'your_super_secret_jwt_key_here') {
    res.status(500).json({ error: 'JWT secret is not configured.' });
    return false;
  }
  return true;
}

function hashResetToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function getFrontendUrl() {
  const configuredUrl = (process.env.FRONTEND_URL || process.env.CORS_ORIGIN || '')
    .split(',')[0]
    .trim()
    .replace(/\/$/, '');

  if (configuredUrl) return configuredUrl;

  if (process.env.NODE_ENV === 'production') {
    throw new Error('FRONTEND_URL or CORS_ORIGIN must be configured in production.');
  }

  return 'http://localhost:5173';
}

router.post('/signup', async (req, res) => {
  try {
    if (!requireJwtSecret(res)) return;

    const name = String(req.body.name || '').trim();
    const email = normalizeEmail(req.body.email);
    const password = String(req.body.password || '');

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password are required.' });
    }

    if (!isEmail(email)) {
      return res.status(400).json({ error: 'A valid email is required.' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters.' });
    }
    
    // Check if user exists
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }

    const password_hash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { name, email, password_hash }
    });

    const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: user.id, name: user.name, email: user.email } });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/login', async (req, res) => {
  try {
    if (!requireJwtSecret(res)) return;

    const email = normalizeEmail(req.body.email);
    const password = String(req.body.password || '');

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    if (!isEmail(email)) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }
    
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(400).json({ error: 'Invalid credentials' });

    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) return res.status(400).json({ error: 'Invalid credentials' });

    const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: user.id, name: user.name, email: user.email } });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/forgot-password', (req, res) => {
  res.redirect(`${getFrontendUrl()}/forgot-password`);
});

router.post('/forgot-password', async (req, res) => {
  const genericMessage = 'If this email exists, a reset link has been sent.';

  try {
    const email = normalizeEmail(req.body.email);
    if (!email || !isEmail(email)) {
      return res.json({ message: genericMessage });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.json({ message: genericMessage });
    }

    const token = crypto.randomBytes(32).toString('hex');
    const resetLink = `${getFrontendUrl()}/reset-password/${encodeURIComponent(token)}`;

    await prisma.user.update({
      where: { id: user.id },
      data: {
        reset_password_token_hash: hashResetToken(token),
        reset_password_expires_at: new Date(Date.now() + 15 * 60 * 1000)
      }
    });

    await sendPasswordResetEmail({ to: user.email, resetLink, name: user.name });
    res.json({ message: genericMessage });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ error: 'Could not send password reset email.' });
  }
});

router.post('/reset-password/:token', async (req, res) => {
  try {
    const token = String(req.params.token || '');
    const newPassword = String(req.body.newPassword || '');
    const confirmPassword = String(req.body.confirmPassword || '');

    if (!token || !newPassword || !confirmPassword) {
      return res.status(400).json({ error: 'Token, new password, and confirmation are required.' });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({ error: 'New password and confirmation do not match.' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters.' });
    }

    const user = await prisma.user.findFirst({
      where: {
        reset_password_token_hash: hashResetToken(token),
        reset_password_expires_at: {
          gt: new Date()
        }
      }
    });

    if (!user) {
      return res.status(400).json({ error: 'Reset link is invalid or has expired.' });
    }

    const password_hash = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: user.id },
      data: {
        password_hash,
        reset_password_token_hash: null,
        reset_password_expires_at: null
      }
    });

    res.json({ message: 'Password reset successfully.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/change-password', auth, async (req, res) => {
  try {
    const oldPassword = String(req.body.oldPassword || '');
    const newPassword = String(req.body.newPassword || '');
    const confirmPassword = String(req.body.confirmPassword || '');

    if (!oldPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({ error: 'Old password, new password, and confirmation are required.' });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({ error: 'New password and confirmation do not match.' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters.' });
    }

    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user) return res.status(404).json({ error: 'User not found.' });

    const validPassword = await bcrypt.compare(oldPassword, user.password_hash);
    if (!validPassword) {
      return res.status(400).json({ error: 'Old password is incorrect.' });
    }

    const password_hash = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: req.user.id },
      data: { password_hash }
    });

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/me', auth, async (req, res) => {
  try {
    await prisma.$transaction([
      prisma.foodLog.deleteMany({ where: { user_id: req.user.id } }),
      prisma.exerciseLog.deleteMany({ where: { user_id: req.user.id } }),
      prisma.profile.deleteMany({ where: { user_id: req.user.id } }),
      prisma.user.delete({ where: { id: req.user.id } })
    ]);

    res.json({ success: true });
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'User not found.' });
    }
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
