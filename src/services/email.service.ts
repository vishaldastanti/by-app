/**
 * ═══════════════════════════════════════════════════════════════
 *  Email Service — Public API
 *
 *  This is the ONLY file other modules should import from.
 *  All email types are thin wrappers around a shared transporter.
 *
 *  Architecture:
 *    email/transporter.ts  → Gmail API + Resend clients & sendEmail()
 *    email/templates.ts    → All branded HTML templates
 *    email.service.ts      → Public exports (this file)
 * ═══════════════════════════════════════════════════════════════
 */

export { sendEmail } from './email/transporter';
export type { EmailPayload } from './email/transporter';

export {
  getOtpEmailHtml,
  getPasswordResetEmailHtml,
  getGenericEmailHtml,
  getBookingEmailHtml,
  getHomestayEmailHtml,
} from './email/templates';
import { env } from '../config/env';

import { sendEmail } from './email/transporter';
import {
  getOtpEmailHtml,
  getPasswordResetEmailHtml,
  getGenericEmailHtml,
  getBookingEmailHtml,
  getHomestayEmailHtml,
} from './email/templates';

// ═══════════════════════════════════════════════════════════════
//  OTP Emails
// ═══════════════════════════════════════════════════════════════

/**
 * Send an OTP verification email.
 * Falls back gracefully — logs OTP to console if delivery fails.
 */
export async function sendOtpEmail(to: string, otp: string, name?: string): Promise<void> {
  const subject = `${otp} is your BiharYaatra verification code`;
  const html = getOtpEmailHtml(otp, name);
  const text = `Your BiharYaatra verification code is: ${otp}. It expires in 10 minutes.`;

  const sent = await sendEmail({ to, subject, html, text }, 'OTP email');

  if (!sent) {
    console.error(`\n======================================================`);
    console.error(`🚨 EMAIL DELIVERY FAILED 🚨`);
    console.error(`Could not send OTP to: ${to}`);
    console.error(`Your Verification Code is: ${otp}`);
    console.error(`======================================================\n`);
    console.warn('⚠ Continuing without email delivery since OTP was logged to console.');
  }
}

/**
 * Send a password reset OTP email.
 * Falls back gracefully — logs OTP to console if delivery fails.
 */
export async function sendPasswordResetEmail(to: string, otp: string, name?: string): Promise<void> {
  const subject = `${otp} is your BiharYaatra password reset code`;
  const resetUrl = `${env.CLIENT_URL || 'http://localhost:3000'}/auth/reset-password?email=${encodeURIComponent(to)}&otp=${otp}`;
  const html = getPasswordResetEmailHtml(otp, name, resetUrl);
  const text = `Your BiharYaatra password reset code is: ${otp}. It expires in 10 minutes.\nClick here to reset your password: ${resetUrl}`;

  const sent = await sendEmail({ to, subject, html, text }, 'Password reset email');

  if (!sent) {
    console.error(`\n======================================================`);
    console.error(`🚨 EMAIL DELIVERY FAILED 🚨`);
    console.error(`Could not send Password Reset OTP to: ${to}`);
    console.error(`Your Reset Code is: ${otp}`);
    console.error(`======================================================\n`);
    console.warn('⚠ Continuing without email delivery since OTP was logged to console.');
  }
}

// ═══════════════════════════════════════════════════════════════
//  Booking Emails
// ═══════════════════════════════════════════════════════════════

/**
 * Send a booking confirmation email (tour or homestay variant).
 */
export async function sendBookingEmail(to: string, booking: any, user: any, details?: any): Promise<void> {
  const isHomestay = booking.service_type === 'homestay';

  const subject = isHomestay
    ? `Booking Confirmed! 🏨 Your stay at ${booking.service_name} is confirmed.`
    : `Booking Confirmed: ${booking.service_name} (#${booking.id.slice(-8).toUpperCase()})`;

  const html = isHomestay
    ? getHomestayEmailHtml(booking, user, details)
    : getBookingEmailHtml(booking, user, details);

  const text = isHomestay
    ? `Your hotel booking at ${booking.service_name} has been successfully confirmed. Booking ID: #${booking.id.slice(-8).toUpperCase()}. Check-in: ${booking.check_in ? new Date(booking.check_in).toLocaleDateString() : 'N/A'}. We look forward to welcoming you!`
    : `Your booking for ${booking.service_name} is confirmed! Booking ID: #${booking.id.slice(-8).toUpperCase()}. Total: ₹${booking.total_amount}.`;

  await sendEmail({ to, subject, html, text }, 'Booking confirmation email');
}

// ═══════════════════════════════════════════════════════════════
//  Generic / Notification Emails
// ═══════════════════════════════════════════════════════════════

/** Internal helper — builds generic HTML and sends. */
async function sendGenericEmail(
  to: string, subject: string, title: string,
  greeting: string, messageHtml: string, text: string,
): Promise<void> {
  const html = getGenericEmailHtml(title, greeting, messageHtml);
  await sendEmail({ to, subject, html, text }, `Email "${subject}"`);
}

/** Welcome & account confirmation email (sent to every new user). */
export async function sendWelcomeEmail(to: string, name: string): Promise<void> {
  return sendGenericEmail(
    to,
    'Welcome and Account Confirmed - BiharYaatra',
    'Welcome & Account Confirmed',
    `Hi ${name},`,
    `<p style="margin:0 0 16px;font-size:15px;color:#64748b;line-height:1.6;">Welcome to BiharYaatra! Your account has been successfully created and confirmed.</p>
     <p style="margin:0 0 16px;font-size:15px;color:#64748b;line-height:1.6;">You can now explore spiritual destinations, book unique heritage stays, and connect with verified local guides across Bihar.</p>
     <p style="margin:0 0 16px;font-size:15px;color:#64748b;line-height:1.6;">Let the journey begin!</p>`,
    `Hi ${name},\n\nWelcome to BiharYaatra! Your account has been successfully created and confirmed.\n\nLet the journey begin!`,
  );
}

/** Email sent to users created manually by an admin, containing their login credentials. */
export async function sendAdminCreatedUserEmail(to: string, name: string, role: string, rawPassword: string): Promise<void> {
  const roleFormatted = role.charAt(0).toUpperCase() + role.slice(1);
  return sendGenericEmail(
    to,
    'Your BiharYaatra Account Has Been Created',
    'Account Created by Admin',
    `Hi ${name},`,
    `<p style="margin:0 0 16px;font-size:15px;color:#64748b;line-height:1.6;">An administrator has created a <strong>${roleFormatted}</strong> account for you on BiharYaatra.</p>
     <p style="margin:0 0 16px;font-size:15px;color:#64748b;line-height:1.6;">You can log in using the following credentials:</p>
     <div style="background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px;margin-bottom:16px;">
       <p style="margin:0 0 8px;font-size:14px;color:#334155;"><strong>Email:</strong> ${to}</p>
       <p style="margin:0 0 8px;font-size:14px;color:#334155;"><strong>Password:</strong> <span style="font-family:monospace;background:#e2e8f0;padding:2px 4px;border-radius:4px;">${rawPassword}</span></p>
     </div>
     <p style="margin:0 0 16px;font-size:15px;color:#64748b;line-height:1.6;">We highly recommend that you log in and change your password immediately from your account settings. Alternatively, you can use the link below to set a new password right away.</p>
     <div style="text-align:center;margin:32px 0;">
       <a href="${env.CLIENT_URL || 'https://www.biharyaatra.com'}/auth/login" style="background-color:#f97316;color:#ffffff;padding:12px 24px;text-decoration:none;border-radius:8px;font-weight:bold;display:inline-block;margin-right:12px;">Log In Now</a>
       <a href="${env.CLIENT_URL || 'https://www.biharyaatra.com'}/auth/forgot-password" style="background-color:#ffffff;color:#64748b;border:1px solid #cbd5e1;padding:12px 24px;text-decoration:none;border-radius:8px;font-weight:bold;display:inline-block;">Change Password</a>
     </div>`,
    `Hi ${name},\n\nAn administrator has created a ${roleFormatted} account for you on BiharYaatra.\n\nYour login credentials are:\nEmail: ${to}\nPassword: ${rawPassword}\n\nPlease log in and change your password immediately, or visit ${env.CLIENT_URL || 'https://www.biharyaatra.com'}/auth/forgot-password to set a new one.`,
  );
}

/** Notification sent when a provider submits verification documents. */
export async function sendProviderSubmissionEmail(to: string, name: string): Promise<void> {
  return sendGenericEmail(
    to,
    'Verification Documents Received',
    'Application Received',
    `Hi ${name},`,
    `<p style="margin:0 0 16px;font-size:15px;color:#64748b;line-height:1.6;">Thank you for submitting your verification documents to partner with BiharYaatra.</p>
     <p style="margin:0 0 16px;font-size:15px;color:#64748b;line-height:1.6;">Our team has received your application and will review it shortly. This process typically takes 1-2 business days.</p>
     <p style="margin:0 0 16px;font-size:15px;color:#64748b;line-height:1.6;">We will notify you via email as soon as there is an update on your partner status.</p>`,
    `Hi ${name},\n\nThank you for submitting your documents. Our team is reviewing them and will update you shortly.`,
  );
}

/** Notification sent when a provider's application is approved or rejected. */
export async function sendProviderStatusEmail(
  to: string, name: string, status: 'verified' | 'rejected', reason?: string,
): Promise<void> {
  const isVerified = status === 'verified';

  const subject = isVerified
    ? 'Congratulations! Your BiharYaatra Partner Account is Approved'
    : 'Update on your BiharYaatra Partner Application';

  const title = isVerified ? 'Application Approved' : 'Application Update';

  const messageHtml = isVerified
    ? `<p style="margin:0 0 16px;font-size:15px;color:#64748b;line-height:1.6;">Great news! Your partner application has been <strong>approved</strong>.</p>
       <p style="margin:0 0 16px;font-size:15px;color:#64748b;line-height:1.6;">You can now log in to your dashboard and start creating listings for your services. We're excited to partner with you to showcase the best of Bihar!</p>`
    : `<p style="margin:0 0 16px;font-size:15px;color:#64748b;line-height:1.6;">Thank you for your interest in partnering with BiharYaatra. Unfortunately, we are unable to approve your application at this time.</p>
       <div style="background-color:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:16px;margin-bottom:16px;">
         <p style="margin:0 0 8px;font-size:13px;font-weight:700;color:#991b1b;text-transform:uppercase;">Reason for rejection:</p>
         <p style="margin:0;font-size:14px;color:#7f1d1d;">${reason || 'Incomplete or invalid verification documents.'}</p>
       </div>
       <p style="margin:0 0 16px;font-size:15px;color:#64748b;line-height:1.6;">If you believe this was a mistake or have updated your documents, please reply to this email to contact our support team.</p>`;

  const text = isVerified
    ? `Hi ${name},\n\nYour partner application has been approved! You can now log in to your dashboard and create listings.`
    : `Hi ${name},\n\nUnfortunately, we couldn't approve your application. Reason: ${reason || 'Incomplete documents'}.`;

  return sendGenericEmail(to, subject, title, `Hi ${name},`, messageHtml, text);
}

/** Notification sent when a provider creates a new listing. */
export async function sendListingCreationEmail(
  to: string, name: string, listingName: string, type: string,
): Promise<void> {
  return sendGenericEmail(
    to,
    `Listing Created: ${listingName}`,
    'Listing Created',
    `Hi ${name},`,
    `<p style="margin:0 0 16px;font-size:15px;color:#64748b;line-height:1.6;">Your new ${type} listing <strong>"${listingName}"</strong> has been successfully created.</p>
     <p style="margin:0 0 16px;font-size:15px;color:#64748b;line-height:1.6;">You can manage your availability, pricing, and details directly from your partner dashboard.</p>`,
    `Hi ${name},\n\nYour new ${type} listing "${listingName}" has been successfully created.`,
  );
}

/** Notification sent to admin when a new user registers. */
export async function sendAdminNewUserNotification(user: any): Promise<void> {
  const adminEmail = env.ADMIN_EMAIL;
  const roleFormatted = user.role.charAt(0).toUpperCase() + user.role.slice(1);

  return sendGenericEmail(
    adminEmail,
    `New User Registration: ${user.name}`,
    'New User Alert',
    'Hello Admin,',
    `<p style="margin:0 0 16px;font-size:15px;color:#64748b;line-height:1.6;">A new user has successfully registered on BiharYaatra.</p>
     <div style="background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px;margin-bottom:16px;">
       <p style="margin:0 0 8px;font-size:14px;color:#334155;"><strong>Name:</strong> ${user.name}</p>
       <p style="margin:0 0 8px;font-size:14px;color:#334155;"><strong>Email:</strong> ${user.email}</p>
       <p style="margin:0 0 8px;font-size:14px;color:#334155;"><strong>Role:</strong> ${roleFormatted}</p>
     </div>
     <p style="margin:0 0 16px;font-size:15px;color:#64748b;line-height:1.6;">You can review their profile in the admin dashboard.</p>`,
    `Hello Admin,\n\nA new user has successfully registered.\nName: ${user.name}\nEmail: ${user.email}\nRole: ${roleFormatted}`,
  );
}

/** Notification sent to admin when a new support ticket is created. */
export async function sendAdminNewTicketNotification(ticket: any, userEmail: string): Promise<void> {
  const adminEmail = env.ADMIN_EMAIL || 'admin@biharyaatra.com';
  
  return sendGenericEmail(
    adminEmail,
    `New Support Ticket Created: ${ticket.issue_type.replace(/_/g, ' ')}`,
    'New Support Ticket Alert',
    'Hello Admin,',
    `<p style="margin:0 0 16px;font-size:15px;color:#64748b;line-height:1.6;">A new support ticket has been raised by a user.</p>
     <div style="background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px;margin-bottom:16px;">
       <p style="margin:0 0 8px;font-size:14px;color:#334155;"><strong>Ticket ID:</strong> ${ticket.id}</p>
       <p style="margin:0 0 8px;font-size:14px;color:#334155;"><strong>User:</strong> ${userEmail}</p>
       <p style="margin:0 0 8px;font-size:14px;color:#334155;"><strong>Issue Type:</strong> <span style="text-transform: capitalize;">${ticket.issue_type.replace(/_/g, ' ')}</span></p>
       <p style="margin:0 0 8px;font-size:14px;color:#334155;"><strong>Description:</strong> ${ticket.description}</p>
     </div>
     <p style="margin:0 0 16px;font-size:15px;color:#64748b;line-height:1.6;">You can view and manage this ticket in the admin dashboard under the Support Tickets section.</p>`,
    `Hello Admin,\n\nA new support ticket has been raised.\nTicket ID: ${ticket.id}\nUser: ${userEmail}\nIssue Type: ${ticket.issue_type}\nDescription: ${ticket.description}`,
  );
}

/** Notification sent to a user when their booking is auto-cancelled due to non-payment of advance. */
export async function sendAutoCancellationEmail(to: string, name: string, booking: any): Promise<void> {
  return sendGenericEmail(
    to,
    `Booking Cancelled: Advance Payment Required`,
    'Booking Cancelled',
    `Hi ${name || 'Guest'},`,
    `<p style="margin:0 0 16px;font-size:15px;color:#64748b;line-height:1.6;">We are writing to inform you that your booking for <strong>${booking.service_name}</strong> (Booking ID: #${booking.id.slice(-8).toUpperCase()}) has been automatically cancelled.</p>
     <div style="background-color:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:16px;margin-bottom:16px;">
       <p style="margin:0 0 8px;font-size:13px;font-weight:700;color:#991b1b;text-transform:uppercase;">Reason for cancellation:</p>
       <p style="margin:0;font-size:14px;color:#7f1d1d;">The required 20% advance payment was not received 24 hours prior to your check-in time.</p>
     </div>
     <p style="margin:0 0 16px;font-size:15px;color:#64748b;line-height:1.6;">If you still wish to travel, please visit BiharYaatra to create a new booking. For any questions, reply to this email.</p>`,
    `Hi ${name || 'Guest'},\n\nYour booking for ${booking.service_name} (#${booking.id.slice(-8).toUpperCase()}) has been cancelled because the required 20% advance payment was not received 24 hours prior to check-in.\n\nPlease create a new booking if you still wish to travel.`,
  );
}

/** Notification sent to user when their refund is processed. */
export async function sendRefundEmail(to: string, name: string, amount: number, customId: string, serviceName: string): Promise<void> {
  return sendGenericEmail(
    to,
    `Refund Processed: ₹${amount}`,
    'Refund Processed',
    `Hi ${name || 'Guest'},`,
    `<p style="margin:0 0 16px;font-size:15px;color:#64748b;line-height:1.6;">We have successfully processed a refund of <strong>₹${amount}</strong> for your booking <strong>${serviceName}</strong> (Booking ID: #${customId}).</p>
     <p style="margin:0 0 16px;font-size:15px;color:#64748b;line-height:1.6;">The amount should reflect in your original payment method within 5-7 business days depending on your bank.</p>`,
    `Hi ${name || 'Guest'},\n\nWe have successfully processed a refund of ₹${amount} for your booking ${serviceName} (Booking ID: #${customId}).\n\nThe amount should reflect in your original payment method within 5-7 business days.`
  );
}
