import dotenv from 'dotenv';

dotenv.config();

/**
 * ═══════════════════════════════════════════════════════════════
 *  Environment Configuration & Validation
 *  Centralized point for all process.env variables.
 * ═══════════════════════════════════════════════════════════════
 */

// Helper to throw if a critical variable is missing
function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`FATAL: Missing critical environment variable: ${name}`);
  }
  return value;
}

export const env = {
  // ── App & Server ──
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT || '8000', 10),
  CLIENT_URL: process.env.CLIENT_URL || 'http://localhost:3000',
  ADMIN_EMAIL: process.env.ADMIN_EMAIL || 'admin@biharyaatra.com',

  // ── Database (Supabase) ──
  SUPABASE_URL: requireEnv('SUPABASE_URL'),
  SUPABASE_ANON_KEY: requireEnv('SUPABASE_ANON_KEY'),
  SUPABASE_SERVICE_ROLE_KEY: requireEnv('SUPABASE_SERVICE_ROLE_KEY'),

  // ── JWT Secrets ──
  JWT_ACCESS_SECRET: requireEnv('JWT_ACCESS_SECRET'),
  JWT_REFRESH_SECRET: requireEnv('JWT_REFRESH_SECRET'),

  // ── Google OAuth ──
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || '',

  // ── Email (Gmail API OAuth2) ──
  GMAIL_CLIENT_ID: process.env.GMAIL_CLIENT_ID,
  GMAIL_CLIENT_SECRET: process.env.GMAIL_CLIENT_SECRET,
  GMAIL_REFRESH_TOKEN: process.env.GMAIL_REFRESH_TOKEN,
  SMTP_USER: process.env.SMTP_USER || 'biharyaatraofficial@gmail.com',

  // ── Email (Gmail SMTP App Password — most reliable local option) ──
  SMTP_HOST: process.env.SMTP_HOST || 'smtp.gmail.com',
  SMTP_PORT: parseInt(process.env.SMTP_PORT || '465', 10),
  SMTP_PASS: process.env.SMTP_PASS || process.env.SMTP_PASSWORD,

  // ── Email (Resend Fallback) ──
  RESEND_API_KEY: process.env.RESEND_API_KEY,
  RESEND_FROM_EMAIL: process.env.RESEND_FROM_EMAIL || 'Bihar Yaatra <noreply@biharyaatra.com>',

  // ── Razorpay ──
  RAZORPAY_KEY_ID: requireEnv('RAZORPAY_KEY_ID'),
  RAZORPAY_KEY_SECRET: requireEnv('RAZORPAY_KEY_SECRET'),
  RAZORPAY_WEBHOOK_SECRET: requireEnv('RAZORPAY_WEBHOOK_SECRET'),

  // ── Gemini AI ──
  GEMINI_API_KEY: requireEnv('GEMINI_API_KEY'),

  // ── Cloudinary ──
  CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME,
  CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY,
  CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET,

  // ── Web Push ──
  VAPID_PUBLIC_KEY: process.env.VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY: process.env.VAPID_PRIVATE_KEY,
};

// ── Additional Validations ──

if (env.RAZORPAY_WEBHOOK_SECRET.includes('your_') || env.RAZORPAY_WEBHOOK_SECRET === 'dev_webhook_secret' || env.RAZORPAY_WEBHOOK_SECRET.length < 32) {
  throw new Error('FATAL: RAZORPAY_WEBHOOK_SECRET is still a placeholder or too weak (must be >= 32 chars).');
}
