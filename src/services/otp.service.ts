import crypto from 'crypto';
import { supabase } from '../config/supabase';

const OTP_LENGTH = 6;
const OTP_EXPIRY_MINUTES = 10;

// ── SEC-06 FIX: Track failed OTP attempts to prevent brute-force ──
const MAX_OTP_ATTEMPTS = 5;
const ATTEMPT_WINDOW_MS = OTP_EXPIRY_MINUTES * 60 * 1000; // Matches OTP expiry
const failedAttempts = new Map<string, { count: number; lastAttempt: number }>();

/**
 * Generate a cryptographically secure 6-digit OTP.
 */
export function generateOtp(): string {
  // Generate a random number between 100000 and 999999
  const buffer = crypto.randomBytes(4);
  const num = buffer.readUInt32BE(0);
  const otp = (num % 900000) + 100000;
  return otp.toString();
}

/**
 * Store an OTP in the email_otps table with a 10-minute expiry.
 * Deletes any previous unused OTPs for the same email first.
 */
export async function storeOtp(email: string, otp: string): Promise<void> {
  const normalizedEmail = email.toLowerCase().trim();

  // Delete any existing unused OTPs for this email to prevent accumulation
  await supabase
    .from('email_otps')
    .delete()
    .eq('email', normalizedEmail)
    .eq('used', false);

  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000).toISOString();

  // ── MED-2 FIX: Hash OTP before storage to protect against DB compromise ──
  const hashedOtp = crypto.createHash('sha256').update(otp).digest('hex');

  const { error } = await supabase
    .from('email_otps')
    .insert([{
      email: normalizedEmail,
      otp: hashedOtp,
      expires_at: expiresAt,
      used: false,
    }]);

  if (error) {
    console.error('Failed to store OTP:', error);
    throw new Error('Failed to store verification code');
  }
}

/**
 * Verify an OTP against the database.
 * Returns true if valid, false otherwise.
 * Marks the OTP as used on success.
 */
export async function verifyStoredOtp(email: string, otp: string): Promise<boolean> {
  const normalizedEmail = email.toLowerCase().trim();

  // ── SEC-06 FIX: Enforce OTP attempt limits to prevent brute-force ──
  const attempts = failedAttempts.get(normalizedEmail);
  if (attempts) {
    if (Date.now() - attempts.lastAttempt > ATTEMPT_WINDOW_MS) {
      // Window expired — reset counter
      failedAttempts.delete(normalizedEmail);
    } else if (attempts.count >= MAX_OTP_ATTEMPTS) {
      // Too many failed attempts — invalidate all OTPs for this email
      await supabase.from('email_otps').delete().eq('email', normalizedEmail).eq('used', false);
      failedAttempts.delete(normalizedEmail);
      return false;
    }
  }

  // ── MED-2 FIX: Hash the input OTP to compare against stored hash ──
  const hashedOtp = crypto.createHash('sha256').update(otp).digest('hex');

  // Find a matching, unused, non-expired OTP
  const { data, error } = await supabase
    .from('email_otps')
    .select('id, expires_at')
    .eq('email', normalizedEmail)
    .eq('otp', hashedOtp)
    .eq('used', false)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error || !data) {
    // Track failed attempt
    const current = failedAttempts.get(normalizedEmail) || { count: 0, lastAttempt: Date.now() };
    current.count++;
    current.lastAttempt = Date.now();
    failedAttempts.set(normalizedEmail, current);
    return false;
  }

  // Check expiry
  if (new Date(data.expires_at) < new Date()) {
    // OTP has expired — clean it up
    await supabase.from('email_otps').delete().eq('id', data.id);
    // Track as failed attempt
    const current = failedAttempts.get(normalizedEmail) || { count: 0, lastAttempt: Date.now() };
    current.count++;
    current.lastAttempt = Date.now();
    failedAttempts.set(normalizedEmail, current);
    return false;
  }

  // Mark as used
  await supabase
    .from('email_otps')
    .update({ used: true })
    .eq('id', data.id);

  // ── SEC-06: Clear failed attempts on successful verification ──
  failedAttempts.delete(normalizedEmail);

  return true;
}

/**
 * Clean up expired OTPs. Can be called periodically.
 */
export async function cleanupExpiredOtps(): Promise<void> {
  const now = new Date().toISOString();

  const { error } = await supabase
    .from('email_otps')
    .delete()
    .lt('expires_at', now);

  if (error) {
    console.error('Failed to cleanup expired OTPs:', error);
  }
}
