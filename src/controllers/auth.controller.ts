import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { OAuth2Client } from 'google-auth-library';
import { supabase } from '../config/supabase';
import { parsePagination } from '../utils/pagination.util';
import { generateOtp, storeOtp, verifyStoredOtp } from '../services/otp.service';
import { sendOtpEmail, sendPasswordResetEmail, sendWelcomeEmail, sendProviderSubmissionEmail, sendProviderStatusEmail, sendAdminNewUserNotification, sendAdminCreatedUserEmail } from '../services/email.service';
import { generateCustomId } from '../utils/id.util';
import { createNotification } from '../services/notification.service';

// ── CRIT-3 FIX: Fail-fast if JWT secrets are missing or placeholder ──
import { env } from '../config/env';

const JWT_ACCESS_SECRET = env.JWT_ACCESS_SECRET;
const JWT_REFRESH_SECRET = env.JWT_REFRESH_SECRET;

if (!JWT_ACCESS_SECRET || JWT_ACCESS_SECRET.length < 32 || JWT_ACCESS_SECRET.includes('change_me')) {
  throw new Error(
    'FATAL: JWT_ACCESS_SECRET is missing, too short (< 32 chars), or still a placeholder. ' +
    'Generate a strong secret with: openssl rand -base64 64'
  );
}
if (!JWT_REFRESH_SECRET || JWT_REFRESH_SECRET.length < 32 || JWT_REFRESH_SECRET.includes('change_me')) {
  throw new Error(
    'FATAL: JWT_REFRESH_SECRET is missing, too short (< 32 chars), or still a placeholder. ' +
    'Generate a strong secret with: openssl rand -base64 64'
  );
}

// ── MED-6 HELPER: Hash a token before storing in DB ──
function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

// ── MED-7 HELPER: Limit active sessions per user ──
const MAX_SESSIONS_PER_USER = 5;
async function enforceSessionLimit(userId: string): Promise<void> {
  const { data: existingTokens } = await supabase
    .from('refresh_tokens')
    .select('id, custom_id, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });

  if (existingTokens && existingTokens.length >= MAX_SESSIONS_PER_USER) {
    const tokensToDelete = existingTokens.slice(0, existingTokens.length - MAX_SESSIONS_PER_USER + 1);
    const idsToDelete = tokensToDelete.map(t => t.id);
    await supabase.from('refresh_tokens').delete().in('id', idsToDelete);
  }
}
const SALT_ROUNDS = 12;

// ── JWT Helpers ──

function generateAccessToken(userId: string, email: string, role: string): string {
  return jwt.sign(
    { sub: userId, user_id: userId, email, role: 'authenticated', app_role: role },
    JWT_ACCESS_SECRET as string,
    { expiresIn: '1h' }
  );
}

function generateRefreshToken(userId: string): string {
  return jwt.sign(
    { user_id: userId },
    JWT_REFRESH_SECRET as string,
    { expiresIn: '30d' }
  );
}

// ── Cookie Helpers ──

const setAuthCookies = (res: Response, access_token: string, refresh_token: string) => {
  const isProd = env.NODE_ENV === 'production';
  
  res.cookie('access_token', access_token, {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'none' : 'strict',
    maxAge: 3600 * 1000 // 1 hour
  });

  res.cookie('refresh_token', refresh_token, {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'none' : 'strict',
    maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
  });
};

const clearAuthCookies = (res: Response) => {
  const isProd = env.NODE_ENV === 'production';
  const opts = { httpOnly: true, secure: isProd, sameSite: isProd ? 'none' as const : 'strict' as const };
  res.clearCookie('access_token', opts);
  res.clearCookie('refresh_token', opts);
};

// ══════════════════════════════════════════════════
// ── Public Endpoints ──
// ══════════════════════════════════════════════════

export const register = async (req: Request, res: Response) => {
  try {
    const { name, email, password, phone, role = 'traveller', provider_type, pre_verified } = req.body;

    if (!email || !password || !name) {
      return res.status(400).json({ error: 'Name, email, and password are required' });
    }

    // ── LOW-1 FIX: Enforce stronger password policy ──
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }
    if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password)) {
      return res.status(400).json({ error: 'Password must contain at least one uppercase letter, one lowercase letter, and one number' });
    }

    // ── HIGH-3 FIX: Restrict self-registration roles to prevent privilege escalation ──
    const allowedSelfRegistrationRoles = ['traveller', 'provider'];
    const safeRole = allowedSelfRegistrationRoles.includes(role) ? role : 'traveller';

    const normalizedEmail = email.toLowerCase().trim();

    // Check if email already exists
    const { data: existing } = await supabase
      .from('users')
      .select('id, custom_id, is_verified')
      .eq('email', normalizedEmail)
      .single();

    if (existing) {
      if (existing.is_verified) {
        return res.status(400).json({ error: 'An account with this email already exists' });
      }
      // If they registered but never verified, delete the old entry and let them re-register
      await supabase.from('users').delete().eq('id', existing.id);
    }

    // Hash password
    const password_hash = await bcrypt.hash(password, SALT_ROUNDS);

    // ── OTP-FIRST FLOW: email was already verified before registration ──
    const isPreVerified = pre_verified === true || pre_verified === 'true';

    // Insert into public.users
    const { data: newUser, error: insertError } = await supabase
      .from('users')
      .insert([{
        custom_id: generateCustomId(`BY-${safeRole.toUpperCase().replace('_', '')}`),
        name,
        email: normalizedEmail,
        phone: phone || null,
        role: safeRole,
        password_hash,
        is_verified: isPreVerified, // Mark as verified if OTP was already confirmed
        provider_type: safeRole === 'provider' ? provider_type : null,
        provider_status: safeRole === 'provider' ? 'pending_setup' : null,
        agreed_terms_at: new Date().toISOString(),
      }])
      .select('id, custom_id, name, email, phone, role, is_verified, is_active, created_at, provider_type, provider_status, agreed_terms_at')
      .single();

    if (insertError) {
      console.error('Registration insert error:', insertError);
      return res.status(400).json({ error: insertError.message || 'Registration failed' });
    }

    // ── PRE-VERIFIED: Issue token and log user in immediately ──
    if (isPreVerified) {
      const accessToken = generateAccessToken(newUser.id, newUser.email, newUser.role);
      const refreshToken = generateRefreshToken(newUser.id);

      await enforceSessionLimit(newUser.id);
      await supabase
        .from('refresh_tokens')
        .insert([{ user_id: newUser.id, token: hashToken(refreshToken) }]);

      setAuthCookies(res, accessToken, refreshToken);

      // Send welcome email in background
      sendWelcomeEmail(newUser.email, newUser.name).catch(e => console.error('Failed to send welcome email:', e));
      sendAdminNewUserNotification(newUser).catch(e => console.error('Failed to send admin notification:', e));

      return res.status(201).json({
        message: 'Registration successful! Welcome to Bihar Yaatra.',
        token: accessToken,
        user: newUser,
      });
    }

    // ── STANDARD FLOW: Generate and send OTP for email verification ──
    try {
      const otp = generateOtp();
      await storeOtp(normalizedEmail, otp);
      await sendOtpEmail(normalizedEmail, otp, name);
    } catch (emailError: any) {
      console.error('Failed to send verification OTP email:', emailError.message);
      // Registration succeeded but email failed — user can resend from verify-otp page
    }

    return res.status(201).json({
      message: 'Registration successful! Please check your email for your verification code.',
      user: newUser,
      needs_email_verification: true,
      email: normalizedEmail,
    });
  } catch (error: any) {
    console.error('Register error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Fetch user from public.users
    const { data: user, error } = await supabase
      .from('users')
      .select('id, custom_id, name, email, phone, role, password_hash, is_verified, avatar_url, provider_type, provider_status, legal_documents')
      .eq('email', normalizedEmail)
      .single();

    if (error || !user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    if (!user.password_hash) {
      return res.status(401).json({ error: 'This is a legacy account. Please register again to use the new authentication system.' });
    }

    // Verify password
    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Check if email is verified
    if (!user.is_verified) {
      // Send a new OTP automatically
      try {
        const otp = generateOtp();
        await storeOtp(normalizedEmail, otp);
        await sendOtpEmail(normalizedEmail, otp, user.name);

        return res.status(401).json({
          error: 'Email not verified. A new verification code has been sent to your email.',
          needs_email_verification: true,
          email: normalizedEmail,
        });
      } catch (resendError: any) {
        console.error('Error sending verification OTP on login:', resendError);
        return res.status(401).json({
          error: 'Email not verified. Please try again later.'
        });
      }
    }

    // Generate JWT tokens
    const accessToken = generateAccessToken(user.id, user.email, user.role);
    const refreshToken = generateRefreshToken(user.id);

    // ── MED-6 FIX: Hash refresh token before DB storage ──
    // ── MED-7 FIX: Limit active sessions per user ──
    await enforceSessionLimit(user.id);
    await supabase
      .from('refresh_tokens')
      .insert([{ user_id: user.id, token: hashToken(refreshToken) }]);

    setAuthCookies(res, accessToken, refreshToken);

    // Return user without password_hash
    const { password_hash: _, ...safeUser } = user;

    return res.status(200).json({
      message: 'Login successful',
      token: accessToken,
      user: safeUser
    });
  } catch (error: any) {
    console.error('Login error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

const googleClient = new OAuth2Client(env.GOOGLE_CLIENT_ID);

export const googleLogin = async (req: Request, res: Response) => {
  try {
    const { token, role: requestedRole = 'traveller' } = req.body;
    // ── HIGH-4 FIX: Restrict self-registration roles via Google login ──
    const allowedSelfRegistrationRoles = ['traveller', 'provider'];
    const role = allowedSelfRegistrationRoles.includes(requestedRole) ? requestedRole : 'traveller';
    if (!token) {
      return res.status(400).json({ error: 'Google ID token is required' });
    }

    const ticket = await googleClient.verifyIdToken({
      idToken: token,
      audience: env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    if (!payload || !payload.email) {
      return res.status(400).json({ error: 'Invalid Google token' });
    }

    const email = payload.email.toLowerCase().trim();
    const name = payload.name || 'Google User';
    const avatar_url = payload.picture || null;

    // Check if user exists
    let { data: user, error: userError } = await supabase
      .from('users')
      .select('id, custom_id, name, email, phone, role, password_hash, is_verified, avatar_url, provider_type, provider_status, legal_documents')
      .eq('email', email)
      .single();

    if (userError && userError.code !== 'PGRST116') { // PGRST116 is no rows returned
      throw userError;
    }

    if (!user) {
      // Create new user
      const { data: newUser, error: insertError } = await supabase
        .from('users')
        .insert([{
          custom_id: generateCustomId(`BY-${role.toUpperCase().replace('_', '')}`),
          name,
          email,
          role,
          is_verified: true,
          avatar_url,
          password_hash: null
        }])
        .select('id, custom_id, name, email, phone, role, password_hash, is_verified, avatar_url, provider_type, provider_status, legal_documents')
        .single();
        
      if (insertError) throw insertError;
      user = newUser;

      // Send welcome email for new Google login registrations
      sendWelcomeEmail(user.email, user.name).catch(e => console.error('Failed to send welcome email:', e));
      sendAdminNewUserNotification(user).catch(e => console.error('Failed to send admin notification:', e));
    }

    // Generate JWT tokens
    const accessToken = generateAccessToken(user.id, user.email, user.role);
    const refreshToken = generateRefreshToken(user.id);

    // ── MED-6 + MED-7 FIX: Hash refresh token and limit sessions ──
    await enforceSessionLimit(user.id);
    await supabase
      .from('refresh_tokens')
      .insert([{ user_id: user.id, token: hashToken(refreshToken) }]);

    setAuthCookies(res, accessToken, refreshToken);

    // Return user without password_hash
    const { password_hash: _, ...safeUser } = user;

    return res.status(200).json({
      message: 'Login successful',
      token: accessToken,
      user: safeUser
    });
  } catch (error: any) {
    console.error('Google Login error:', error);
    return res.status(500).json({ error: 'Google authentication failed' });
  }
};

export const refresh = async (req: Request, res: Response) => {
  try {
    const refreshToken = req.cookies?.refresh_token;

    if (!refreshToken) {
      return res.status(401).json({ error: 'Refresh token is required' });
    }

    // Verify the refresh token
    let decoded: any;
    try {
      decoded = jwt.verify(refreshToken, JWT_REFRESH_SECRET);
    } catch {
      return res.status(401).json({ error: 'Invalid or expired refresh token' });
    }

    // ── MED-6 FIX: Look up by hashed token ──
    const { data: storedToken } = await supabase
      .from('refresh_tokens')
      .select('id')
      .eq('token', hashToken(refreshToken))
      .eq('user_id', decoded.user_id)
      .single();

    if (!storedToken) {
      return res.status(401).json({ error: 'Refresh token has been revoked' });
    }

    // Fetch current user data for the new access token
    const { data: user } = await supabase
      .from('users')
      .select('id, custom_id, email, role')
      .eq('id', decoded.user_id)
      .single();

    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    // Generate new tokens
    const newAccessToken = generateAccessToken(user.id, user.email, user.role);
    const newRefreshToken = generateRefreshToken(user.id);

    // Rotate: delete old refresh token and insert new one (hashed)
    await supabase.from('refresh_tokens').delete().eq('id', storedToken.id);
    await supabase.from('refresh_tokens').insert([{ user_id: user.id, token: hashToken(newRefreshToken) }]);

    setAuthCookies(res, newAccessToken, newRefreshToken);

    return res.status(200).json({ 
      message: 'Tokens refreshed',
      token: newAccessToken
    });
  } catch (error) {
    console.error('Refresh error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export const logout = async (req: Request, res: Response) => {
  try {
    const refreshToken = req.cookies?.refresh_token;

    // ── MED-6 FIX: Delete by hashed token ──
    if (refreshToken) {
      await supabase.from('refresh_tokens').delete().eq('token', hashToken(refreshToken));
    }

    clearAuthCookies(res);

    return res.status(200).json({ message: 'Logout successful' });
  } catch (error) {
    clearAuthCookies(res);
    return res.status(500).json({ error: 'Internal server error during logout' });
  }
};

export const getMe = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.user_id;

    const { data: user, error } = await supabase
      .from('users')
      .select('id, custom_id, name, email, phone, role, avatar_url, is_verified, created_at, updated_at, provider_type, provider_status, legal_documents')
      .eq('id', userId)
      .single();

    if (error || !user) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    return res.status(200).json({ user });
  } catch (error: any) {
    console.error('getMe error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateMe = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.user_id;
    const { name, phone, avatar_url } = req.body;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (avatar_url) {
      const allowedDomains = ['res.cloudinary.com', 'lh3.googleusercontent.com', 'images.unsplash.com'];
      try {
        const parsedUrl = new URL(avatar_url);
        if (!allowedDomains.includes(parsedUrl.hostname)) {
          return res.status(400).json({ error: 'Invalid avatar URL domain' });
        }
      } catch (e) {
        return res.status(400).json({ error: 'Invalid avatar URL format' });
      }
    }

    const { data: updatedUser, error: updateError } = await supabase
      .from('users')
      .update({
        name,
        phone: phone || null,
        avatar_url: avatar_url || null,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId)
      .select('id, custom_id, name, email, phone, role, avatar_url, is_verified, created_at, updated_at, provider_type, provider_status, legal_documents')
      .single();

    if (updateError) {
      throw updateError;
    }

    return res.status(200).json({ user: updatedUser });
  } catch (error: any) {
    console.error('updateMe error:', error);
    // ── LOW-2 FIX: Don't leak internal error details ──
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export const verifyProvider = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.user_id;
    const { documents } = req.body;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!documents) {
      return res.status(400).json({ error: 'Documents are required' });
    }

    const { data: updatedUser, error: updateError } = await supabase
      .from('users')
      .update({
        legal_documents: documents,
        provider_status: 'pending_verification',
        updated_at: new Date().toISOString()
      })
      .eq('id', userId)
      .eq('role', 'provider')
      .select('id, custom_id, name, email, role, provider_type, provider_status, legal_documents')
      .single();

    if (updateError || !updatedUser) {
      return res.status(400).json({ error: 'Failed to submit verification' });
    }

    // Send submission confirmation email
    sendProviderSubmissionEmail(updatedUser.email, updatedUser.name).catch(e => console.error('Failed to send provider submission email:', e));

    createNotification(
      updatedUser.id,
      'Verification Submitted',
      'Your documents have been submitted and are pending review.',
      'system',
      'fas fa-file-alt text-blue-500',
      '/dashboard/provider/setup'
    );

    return res.status(200).json({ message: 'Verification documents submitted successfully', user: updatedUser });
  } catch (error: any) {
    console.error('verifyProvider error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// ══════════════════════════════════════════════════
// ── Admin Endpoints ──
// ══════════════════════════════════════════════════

export const getAllUsers = async (req: Request, res: Response) => {
  try {
    // ── SEC-05 FIX: Paginate to prevent unbounded queries ──
    const { from, to } = parsePagination(req.query, 200);
    const { data, error } = await supabase
      .from('users')
      .select('id, custom_id, name, email, phone, role, avatar_url, is_verified, created_at, updated_at, provider_type, provider_status')
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) throw error;
    return res.status(200).json(data || []);
  } catch (error: any) {
    console.error('getAllUsers error:', error);
    // ── LOW-2 FIX: Don't leak internal error details ──
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export const adminCreateUser = async (req: Request, res: Response) => {
  try {
    const { name, email, password, phone, role = 'traveller' } = req.body;

    if (!email || !password || !name) {
      return res.status(400).json({ error: 'Name, email, and password are required' });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const password_hash = await bcrypt.hash(password, SALT_ROUNDS);

    const { data: profile, error: profileError } = await supabase
      .from('users')
      .insert([{
        custom_id: generateCustomId(`BY-${role.toUpperCase().replace('_', '')}`),
        name,
        email: normalizedEmail,
        phone: phone || null,
        role,
        password_hash,
        is_verified: true, // Admin-created users are pre-verified
      }])
      .select('id, custom_id, name, email, phone, role, is_verified, created_at')
      .single();

    if (profileError) {
      return res.status(400).json({ error: profileError.message });
    }

    // Send email with login credentials for admin-created users
    sendAdminCreatedUserEmail(profile.email, profile.name, profile.role, password).catch(e => console.error('Failed to send admin created user email:', e));
    sendAdminNewUserNotification(profile).catch(e => console.error('Failed to send admin notification:', e));

    createNotification(
      profile.id,
      'Welcome to Bihar Yaatra!',
      'Your account has been created by an administrator.',
      'system',
      'fas fa-user-check text-green-500',
      '/dashboard/user/profile'
    );

    return res.status(201).json({
      message: `User "${name}" created with role "${role}"`,
      user: profile
    });
  } catch (error: any) {
    console.error('adminCreateUser error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateUserRole = async (req: Request, res: Response) => {
  try {
    const { id: paramId } = req.params;
    const id = Array.isArray(paramId) ? paramId[0] : paramId;
    const { role } = req.body;

    const validRoles = ['traveller', 'provider', 'admin', 'superadmin', 'content_manager', 'approval_manager'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ error: `Invalid role. Must be one of: ${validRoles.join(', ')}` });
    }

    const { data, error } = await supabase
      .from('users')
      .update({ role, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('id, custom_id, name, email, role')
      .single();

    if (error) throw error;

    return res.status(200).json({ message: `Role updated to "${role}"`, user: data });
  } catch (error: any) {
    console.error('updateUserRole error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export const adminDeleteUser = async (req: Request, res: Response) => {
  try {
    const { id: paramId } = req.params;
    const id = Array.isArray(paramId) ? paramId[0] : paramId;
    const currentUserId = req.user?.user_id;

    if (id === currentUserId) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }

    // Delete refresh tokens first
    await supabase.from('refresh_tokens').delete().eq('user_id', id);

    // Delete user from public.users
    const { error: dbError } = await supabase
      .from('users')
      .delete()
      .eq('id', id);

    if (dbError) throw dbError;

    return res.status(200).json({ message: 'User deleted successfully' });
  } catch (error: any) {
    console.error('adminDeleteUser error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export const getAdminStats = async (req: Request, res: Response) => {
  try {
    const [users, bookings, homestays, transports, guides, packages] = await Promise.all([
      supabase.from('users').select('id', { count: 'exact', head: true }),
      supabase.from('bookings').select('id, custom_id, total_amount, status'),
      supabase.from('homestays').select('id', { count: 'exact', head: true }),
      supabase.from('transports').select('id', { count: 'exact', head: true }),
      supabase.from('guides').select('id', { count: 'exact', head: true }),
      supabase.from('packages').select('id', { count: 'exact', head: true }),
    ]);

    const totalRevenue = (bookings.data || [])
      .filter((b: any) => b.status === 'confirmed' || b.status === 'completed')
      .reduce((sum: number, b: any) => sum + Number(b.total_amount || 0), 0);

    return res.status(200).json({
      totalUsers: users.count || 0,
      totalBookings: bookings.data?.length || 0,
      totalHomestays: homestays.count || 0,
      totalTransports: transports.count || 0,
      totalGuides: guides.count || 0,
      totalPackages: packages.count || 0,
      totalRevenue,
    });
  } catch (error: any) {
    console.error('getAdminStats error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// ══════════════════════════════════════════════════
// ── Email OTP Endpoints ──
// ══════════════════════════════════════════════════

export const forgotPassword = async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });

    const normalizedEmail = email.toLowerCase().trim();

    // Check if user exists
    const { data: user } = await supabase
      .from('users')
      .select('id, custom_id, name')
      .eq('email', normalizedEmail)
      .single();

    // To prevent email enumeration, we can still say "If an account exists, a reset code was sent"
    // But since the current flow is more explicit, let's return a 404 for clarity just like sendEmailOtp.
    // ── HIGH-2 FIX: Prevent email enumeration — return same response regardless ──
    if (!user) {
      return res.status(200).json({ message: 'If an account exists with this email, a reset code has been sent.' });
    }

    const otp = generateOtp();
    await storeOtp(normalizedEmail, otp);
    await sendPasswordResetEmail(normalizedEmail, otp, user.name);

    return res.status(200).json({ message: 'If an account exists with this email, a reset code has been sent.' });
  } catch (error: any) {
    console.error('forgotPassword error:', error);
    return res.status(500).json({ error: 'Failed to process forgot password request.' });
  }
};

export const resetPassword = async (req: Request, res: Response) => {
  try {
    const { email, otp, newPassword } = req.body;
    if (!email || !otp || !newPassword) {
      return res.status(400).json({ error: 'Email, verification code, and new password are required' });
    }

    // ── LOW-1 FIX: Enforce stronger password policy on reset ──
    if (newPassword.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }
    if (!/[A-Z]/.test(newPassword) || !/[a-z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
      return res.status(400).json({ error: 'Password must contain at least one uppercase letter, one lowercase letter, and one number' });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Verify the OTP
    const isValid = await verifyStoredOtp(normalizedEmail, otp);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid or expired verification code. Please request a new one.' });
    }

    // Hash the new password
    const password_hash = await bcrypt.hash(newPassword, SALT_ROUNDS);

    // Update the password in the database
    const { error: updateError } = await supabase
      .from('users')
      .update({ password_hash, updated_at: new Date().toISOString() })
      .eq('email', normalizedEmail);

    if (updateError) {
      console.error('Error updating password:', updateError);
      return res.status(500).json({ error: 'Failed to reset password.' });
    }

    // Optionally: Revoke all existing refresh tokens so the user is logged out of all devices
    const { data: user } = await supabase.from('users').select('id').eq('email', normalizedEmail).single();
    if (user) {
      await supabase.from('refresh_tokens').delete().eq('user_id', user.id);
    }

    return res.status(200).json({ message: 'Password has been reset successfully. You can now log in.' });
  } catch (error: any) {
    console.error('resetPassword error:', error);
    return res.status(500).json({ error: 'Failed to reset password.' });
  }
};

export const sendEmailOtp = async (req: Request, res: Response) => {
  try {
    const { email, purpose } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });

    const normalizedEmail = email.toLowerCase().trim();

    // ── SIGNUP FLOW: User doesn't exist yet — send OTP directly ──
    // During signup, registration happens AFTER OTP verification, so the user
    // won't be in the DB yet. We skip the user-exists check in this case.
    if (purpose === 'signup') {
      const otp = generateOtp();
      await storeOtp(normalizedEmail, otp);
      await sendOtpEmail(normalizedEmail, otp);
      return res.status(200).json({ message: 'Verification code sent to your email' });
    }

    // ── OTHER FLOWS (post-login re-verification, etc.) ──
    // Verify the user exists first to prevent email enumeration.
    const { data: user } = await supabase
      .from('users')
      .select('id, custom_id, name')
      .eq('email', normalizedEmail)
      .single();

    // ── HIGH-2 FIX: Prevent email enumeration — return same response regardless ──
    if (!user) {
      return res.status(200).json({ message: 'If an account exists, a verification code has been sent to your email' });
    }

    const otp = generateOtp();
    await storeOtp(normalizedEmail, otp);
    await sendOtpEmail(normalizedEmail, otp, user.name);

    return res.status(200).json({ message: 'Verification code sent to your email' });
  } catch (error: any) {
    console.error('sendEmailOtp error:', error);
    return res.status(500).json({ error: 'Failed to send verification code' });
  }
};

export const verifyEmailOtp = async (req: Request, res: Response) => {
  try {
    const { email, otp, purpose } = req.body;
    if (!email || !otp) return res.status(400).json({ error: 'Email and verification code are required' });

    const normalizedEmail = email.toLowerCase().trim();

    // Verify the OTP
    const isValid = await verifyStoredOtp(normalizedEmail, otp);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid or expired verification code. Please request a new one.' });
    }

    // ── SIGNUP FLOW: User doesn't exist yet — just confirm OTP is valid ──
    // The register endpoint (called immediately after) will create the user
    // with is_verified=true. No need to UPDATE here.
    if (purpose === 'signup') {
      return res.status(200).json({
        message: 'Email verified successfully! You can now complete your registration.',
        verified: true,
      });
    }

    // ── OTHER FLOWS: Mark the existing user as verified ──
    const { data: user, error: updateError } = await supabase
      .from('users')
      .update({ is_verified: true, updated_at: new Date().toISOString() })
      .eq('email', normalizedEmail)
      .select('id, custom_id, name, email, role, avatar_url')
      .single();

    if (updateError || !user) {
      console.error('Error updating user verification status:', updateError);
      return res.status(500).json({ error: 'Failed to verify email' });
    }

    // Send welcome email
    sendWelcomeEmail(user.email, user.name).catch(e => console.error('Failed to send welcome email:', e));
    sendAdminNewUserNotification(user).catch(e => console.error('Failed to send admin notification:', e));

    // Generate JWT tokens so user is immediately logged in after OTP verification
    const accessToken = generateAccessToken(user.id, user.email, user.role);
    const refreshToken = generateRefreshToken(user.id);

    await enforceSessionLimit(user.id);
    await supabase
      .from('refresh_tokens')
      .insert([{ user_id: user.id, token: hashToken(refreshToken) }]);

    setAuthCookies(res, accessToken, refreshToken);

    return res.status(200).json({
      message: 'Email verified successfully! You can now log in.',
      verified: true,
      token: accessToken,
      user
    });
  } catch (error: any) {
    console.error('verifyEmailOtp error:', error);
    return res.status(500).json({ error: 'Failed to verify email' });
  }
};

export const adminApproveProvider = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status, rejectionReason } = req.body;

    if (!['verified', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'Status must be verified or rejected' });
    }

    const { data: currentUser } = await supabase
      .from('users')
      .select('legal_documents')
      .eq('id', id)
      .single();

    const currentDocs = currentUser?.legal_documents || {};
    const updatedDocs = {
      ...currentDocs,
      rejection_reason: status === 'rejected' ? (rejectionReason || 'Incomplete documents.') : null
    };

    const { data, error } = await supabase
      .from('users')
      .update({
        provider_status: status,
        legal_documents: updatedDocs,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .eq('role', 'provider')
      .select('id, custom_id, name, email, role, provider_type, provider_status, legal_documents')
      .single();

    if (error || !data) {
      console.error('adminApproveProvider db error:', error);
      return res.status(400).json({ error: 'Failed to update provider status or user is not a provider' });
    }

    // Send status email
    sendProviderStatusEmail(data.email, data.name, status as 'verified' | 'rejected', rejectionReason).catch(e => console.error('Failed to send provider status email:', e));

    return res.status(200).json({ message: `Provider status updated to ${status}`, user: data });
  } catch (error: any) {
    console.error('adminApproveProvider error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export const adminGetUserById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { data, error } = await supabase
      .from('users')
      .select('id, custom_id, name, email, phone, role, avatar_url, is_verified, created_at, updated_at, provider_type, provider_status, legal_documents')
      .eq('id', id)
      .single();

    if (error || !data) {
      console.error('adminGetUserById error:', error);
      return res.status(404).json({ error: 'User not found' });
    }

    // Fetch user bookings/activity logs
    const { data: bookings } = await supabase
      .from('bookings')
      .select('id, custom_id, service_type, service_name, total_amount, status, created_at')
      .eq('user_id', id)
      .order('created_at', { ascending: false })
      .limit(10);

    // Fetch active sessions/login logs
    const { data: sessions } = await supabase
      .from('refresh_tokens')
      .select('id, created_at')
      .eq('user_id', id)
      .order('created_at', { ascending: false });

    return res.status(200).json({ ...data, bookings: bookings || [], sessions: sessions || [] });
  } catch (error: any) {
    console.error('adminGetUserById error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
