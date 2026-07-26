import { Request, Response } from 'express';
import { getSupabaseClient, adminSupabase } from '../config/supabase';
import { sendAdminNewTicketNotification } from '../services/email.service';

// Helper to log errors
const logError = (message: string, error: any) => {
    console.error(`[Support Controller] ${message}:`, error);
};

export const createTicket = async (req: Request, res: Response): Promise<void> => {
    const supabase = getSupabaseClient(req);
    try {
        const userId = req.user?.user_id;
        const { booking_id, issue_type, description } = req.body;

        if (!userId) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }

        if (!issue_type || !description) {
            res.status(400).json({ error: 'Missing required fields' });
            return;
        }

        const { data, error } = await supabase
            .from('support_tickets')
            .insert([{ 
                user_id: userId, 
                booking_id: booking_id || null, 
                issue_type, 
                description,
                status: 'open'
            }])
            .select()
            .single();

        if (error) throw error;

        // Fetch user email for the notification
        const { data: userData } = await supabase.from('users').select('email').eq('id', userId).single();
        const userEmail = userData?.email || 'Unknown User';

        // Send email notification asynchronously
        sendAdminNewTicketNotification(data, userEmail).catch(err => {
            logError('Failed to send admin ticket notification email', err);
        });

        res.status(201).json({ message: 'Ticket created successfully', ticket: data });
    } catch (error) {
        logError('Error creating ticket', error);
        res.status(500).json({ error: 'Failed to create ticket' });
    }
};

export const getUserTickets = async (req: Request, res: Response): Promise<void> => {
    const supabase = getSupabaseClient(req);
    try {
        const userId = req.user?.user_id;

        if (!userId) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }

        const { data, error } = await supabase
            .from('support_tickets')
            .select(`
                *,
                bookings (
                    service_name,
                    service_type
                )
            `)
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

        if (error) throw error;

        res.status(200).json(data);
    } catch (error) {
        logError('Error fetching user tickets', error);
        res.status(500).json({ error: 'Failed to fetch tickets' });
    }
};

export const getAllTickets = async (req: Request, res: Response): Promise<void> => {
    const supabase = getSupabaseClient(req);
    try {
        // Assume admin middleware handles authorization
        const { data, error } = await supabase
            .from('support_tickets')
            .select(`
                *,
                users:user_id (
                    name,
                    email
                ),
                bookings (
                    service_name,
                    service_type
                )
            `)
            .order('created_at', { ascending: false });

        if (error) throw error;

        res.status(200).json(data);
    } catch (error) {
        logError('Error fetching all tickets', error);
        res.status(500).json({ error: 'Failed to fetch tickets' });
    }
};

export const updateTicketStatus = async (req: Request, res: Response): Promise<void> => {
    const supabase = getSupabaseClient(req);
    try {
        const { id } = req.params;
        const { status } = req.body;

        if (!status) {
            res.status(400).json({ error: 'Status is required' });
            return;
        }

        const { data, error } = await supabase
            .from('support_tickets')
            .update({ status, updated_at: new Date().toISOString() })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        res.status(200).json({ message: 'Ticket status updated', ticket: data });
    } catch (error) {
        logError('Error updating ticket status', error);
        res.status(500).json({ error: 'Failed to update ticket status' });
    }
};

export const getTicketById = async (req: Request, res: Response): Promise<void> => {
    const supabase = getSupabaseClient(req);
    try {
        const { id } = req.params;
        const userId = req.user?.user_id;
        const userRole = req.user?.role;

        const { data, error } = await supabase
            .from('support_tickets')
            .select(`
                *,
                users:user_id (
                    name,
                    email
                ),
                bookings (
                    service_name,
                    service_type
                )
            `)
            .eq('id', id)
            .single();

        if (error || !data) {
            res.status(404).json({ error: 'Ticket not found' });
            return;
        }

        // Verify authorization
        if (userRole !== 'admin' && userRole !== 'superadmin' && data.user_id !== userId) {
            res.status(403).json({ error: 'Forbidden' });
            return;
        }

        res.status(200).json(data);
    } catch (error) {
        logError('Error fetching ticket by id', error);
        res.status(500).json({ error: 'Failed to fetch ticket' });
    }
};

export const getTicketMessages = async (req: Request, res: Response): Promise<void> => {
    const supabase = getSupabaseClient(req);
    try {
        const { id } = req.params;
        
        // First verify they have access to the ticket
        const { data: ticket, error: ticketError } = await supabase
            .from('support_tickets')
            .select('user_id')
            .eq('id', id)
            .single();
            
        if (ticketError || !ticket) {
            res.status(404).json({ error: 'Ticket not found' });
            return;
        }

        const userId = req.user?.user_id;
        const userRole = req.user?.role;
        
        if (userRole !== 'admin' && userRole !== 'superadmin' && ticket.user_id !== userId) {
            res.status(403).json({ error: 'Forbidden' });
            return;
        }

        const { data, error } = await supabase
            .from('ticket_messages')
            .select(`
                *,
                users:sender_id (
                    name
                )
            `)
            .eq('ticket_id', id)
            .order('created_at', { ascending: true });

        if (error) throw error;

        res.status(200).json(data);
    } catch (error) {
        logError('Error fetching ticket messages', error);
        res.status(500).json({ error: 'Failed to fetch ticket messages' });
    }
};

export const addTicketMessage = async (req: Request, res: Response): Promise<void> => {
    const supabase = getSupabaseClient(req);
    try {
        const { id } = req.params;
        const { message } = req.body;
        const userId = req.user?.user_id;
        const userRole = req.user?.role;

        if (!userId || !message) {
            res.status(400).json({ error: 'Message is required' });
            return;
        }

        // Verify access
        const { data: ticket, error: ticketError } = await supabase
            .from('support_tickets')
            .select('user_id')
            .eq('id', id)
            .single();
            
        if (ticketError || !ticket) {
            res.status(404).json({ error: 'Ticket not found' });
            return;
        }

        const isAdmin = userRole === 'admin' || userRole === 'superadmin';
        if (!isAdmin && ticket.user_id !== userId) {
            res.status(403).json({ error: 'Forbidden' });
            return;
        }

        const { data, error } = await supabase
            .from('ticket_messages')
            .insert([{
                ticket_id: id,
                sender_id: userId,
                sender_role: isAdmin ? 'admin' : 'user',
                message
            }])
            .select(`
                *,
                users:sender_id (
                    name
                )
            `)
            .single();

        if (error) throw error;

        res.status(201).json({ message: 'Message added successfully', ticketMessage: data });
    } catch (error) {
        logError('Error adding ticket message', error);
        res.status(500).json({ error: 'Failed to add message' });
    }
};
