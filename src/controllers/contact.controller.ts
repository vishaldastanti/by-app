import { Request, Response } from 'express';
import { adminSupabase } from '../config/supabase';

export const submitContactForm = async (req: Request, res: Response) => {
  try {
    const { firstName, lastName, email, subject, message } = req.body;
    
    if (!firstName || !email || !message) {
      return res.status(400).json({ error: 'First name, email, and message are required' });
    }

    if (message.length > 1000) {
      return res.status(400).json({ error: 'Message cannot exceed 1000 characters' });
    }

    const sanitizedMessage = message.replace(/<[^>]*>?/gm, '');
    const sanitizedFirstName = firstName.replace(/<[^>]*>?/gm, '');
    const sanitizedLastName = lastName ? lastName.replace(/<[^>]*>?/gm, '') : null;
    const sanitizedSubject = subject ? subject.replace(/<[^>]*>?/gm, '') : 'General Inquiry';

    const { data, error } = await adminSupabase
      .from('contact_messages')
      .insert([{
        first_name: sanitizedFirstName,
        last_name: sanitizedLastName,
        email,
        subject: sanitizedSubject,
        message: sanitizedMessage,
        status: 'new'
      }])
      .select()
      .single();

    if (error) {
        console.error('Supabase error inserting contact message:', error);
        return res.status(500).json({ error: 'Database error' });
    }

    return res.status(201).json({ success: true, message: 'Message sent successfully', data });
  } catch (error: any) {
    console.error('Contact form error:', error);
    return res.status(500).json({ error: 'Failed to submit contact form' });
  }
};
