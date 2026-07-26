
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import { env } from './config/env';
import rateLimit from 'express-rate-limit';
import authRoutes from './routes/auth.routes';
import adminRoutes from './routes/admin.routes';
import destinationRoutes from './routes/destination.routes';
import packageRoutes from './routes/package.routes';
import homestayRoutes from './routes/homestay.routes';
import guideRoutes from './routes/guide.routes';
import transportRoutes from './routes/transport.routes';
import bookingRoutes from './routes/booking.routes';
import paymentRoutes from './routes/payment.routes';
import aiRoutes from './routes/ai.routes';
import calendarRoutes from './routes/calendar.routes';
import earningsRoutes from './routes/earnings.routes';
import supportRoutes from './routes/support.routes';
import profileRoutes from './routes/profile.routes';
import reviewRoutes from './routes/review.routes';
import uploadRoutes from './routes/upload.routes';
import notificationRoutes from './routes/notification.routes';
import availabilityRoutes from './routes/availability.routes';
import financeRoutes from './routes/finance.routes';
import checkinRoutes from './routes/checkin.routes';
import contactRoutes from './routes/contact.routes';
import settingsRoutes from './routes/settings.routes';
import refundRoutes from './routes/refund.routes';
import policyRoutes from './routes/policy.routes';

const app = express();
// ── LOW-5 FIX: Only trust proxy in production behind a known reverse proxy ──
if (env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}
const PORT = env.PORT;

// ── Security Middleware ──
app.use(helmet());

// Prevent browser caching of API responses
app.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Surrogate-Control', 'no-store');
  next();
});
const allowedOrigins = [
  'http://localhost:3000',
  'https://www.biharyaatra.com',
  'https://biharyaatra.com',
  'https://biharyaatra-mvp.vercel.app',
  'http://localhost:51028',
  'http://[IP_ADDRESS]'
];
if (env.CLIENT_URL && !allowedOrigins.includes(env.CLIENT_URL)) {
  allowedOrigins.push(env.CLIENT_URL);
}

app.use(cors({
  origin: function (origin, callback) {
    // ── SEC-07: ACCEPTED RISK — Origin-less requests are allowed ──
    // Server-side calls (Next.js SSR → backend) and mobile apps don't send Origin headers.
    // Mitigated by: X-Requested-With CSRF header required on all state-changing requests (line 88).
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
}));
// ── LOW-3 FIX: Use 'combined' format in production to avoid logging sensitive dev info ──
app.use(morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// ── MED-5 FIX: Basic CSRF protection via custom header requirement ──
// Browsers enforce that custom headers cannot be set by cross-origin forms/links.
// By requiring a custom header on state-changing requests, we prevent CSRF attacks.
import { Request as ExpReq, Response as ExpRes, NextFunction } from 'express';
app.use((req: ExpReq, res: ExpRes, next: NextFunction) => {
  // Skip safe methods and webhook endpoints (called by external servers)
  const safeMethod = ['GET', 'HEAD', 'OPTIONS'].includes(req.method);
  const isWebhook = req.path.includes('/webhook');
  if (safeMethod || isWebhook) return next();

  // Require the custom header on all state-changing requests
  const csrfHeader = req.headers['x-requested-with'];
  if (csrfHeader !== 'BiharYaatraClient') {
    return res.status(403).json({ error: 'Invalid or missing X-Requested-With header (CSRF protection)' });
  }
  next();
});

// ── CRIT-1 FIX: Raw body parser for Razorpay webhook (MUST be before express.json) ──
// Razorpay signs the raw request body; express.json() destroys the original byte sequence
app.use('/api/v1/payments/webhook', express.raw({ type: 'application/json' }));

// ── HIGH-3 FIX: Explicit body size limit to prevent memory exhaustion DoS ──
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());

import dns from 'node:dns';
dns.setDefaultResultOrder('ipv4first'); // Force IPv4 to prevent ENETUNREACH in Node 18+

// ── HIGH-4 FIX: Rate limiting ──
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 15,                   // 15 attempts per window
  message: { error: 'Too many authentication attempts. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false }, // Bypass validation crash on Render
});

const aiLimiter = rateLimit({
  windowMs: 60 * 1000,      // 1 minute
  max: 10,                   // 10 AI requests per minute
  message: { error: 'Saarthi AI rate limit exceeded. Please wait a moment.' },
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false },
});

const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200,                  // 200 requests per window
  message: { error: 'Too many requests. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false },
});

const contactLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,                   // 5 requests per window
  message: { error: 'Too many contact requests. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false },
});

// ── SEC-03 FIX: Dedicated rate limiter for file uploads (resource-intensive) ──
const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,                   // 20 uploads per window
  message: { error: 'Too many uploads. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false },
});

// Apply rate limiters
app.use('/api/v1/upload', uploadLimiter);
app.use('/api/v1/contact', contactLimiter);
app.use('/api/v1/auth/login', authLimiter);
app.use('/api/v1/auth/register', authLimiter);
app.use('/api/v1/auth/send-email-otp', authLimiter);
app.use('/api/v1/auth/verify-email-otp', authLimiter);
app.use('/api/v1/auth/forgot-password', authLimiter);
app.use('/api/v1/auth/reset-password', authLimiter);
app.use('/api/v1/ai', aiLimiter);
app.use('/api/v1', generalLimiter);

// ── Routes ──
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/destinations', destinationRoutes);
app.use('/api/v1/packages', packageRoutes);
app.use('/api/v1/homestays', homestayRoutes);
app.use('/api/v1/guides', guideRoutes);
app.use('/api/v1/transports', transportRoutes);
app.use('/api/v1/bookings', bookingRoutes);
app.use('/api/v1/payments', paymentRoutes);
app.use('/api/v1/ai', aiRoutes);
app.use('/api/v1/provider/calendar', calendarRoutes);
app.use('/api/v1/provider/earnings', earningsRoutes);
app.use('/api/v1/support', supportRoutes);
app.use('/api/v1/user/profile', profileRoutes);
app.use('/api/v1/reviews', reviewRoutes);
app.use('/api/v1/upload', uploadRoutes);
app.use('/api/v1/notifications', notificationRoutes);
app.use('/api/v1/availability', availabilityRoutes);
app.use('/api/v1/finance', financeRoutes);
app.use('/api/v1/checkin', checkinRoutes);
app.use('/api/v1/contact', contactRoutes);
app.use('/api/v1/settings', settingsRoutes);
app.use('/api/v1/refunds', refundRoutes);
app.use('/api/v1/policies', policyRoutes);

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok! Your server is still live to serve the data', timestamp: new Date().toISOString() });
});

import { initCronJobs } from './services/cron.service';

// Start server
if (env.NODE_ENV !== 'test') {
  initCronJobs();
  const server = app.listen(PORT, '0.0.0.0');

  server.on('listening', () => {
    console.log(`Server is running on port ${PORT}`);
  });

  server.on('error', (error: NodeJS.ErrnoException) => {
    if (error.syscall !== 'listen') {
      throw error;
    }
    switch (error.code) {
      case 'EACCES':
        console.error(`❌ Port ${PORT} requires elevated privileges `);
        process.exit(1);
        break;
      case 'EADDRINUSE':
        console.error(`❌ Port ${PORT} is already in use. Please close any other running instances of the server.`);
        process.exit(1);
        break;
      default:
        throw error;
    }
  });
}

export default app;

// touch to restart
