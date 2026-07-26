import { Request, Response } from 'express';
import { adminSupabase } from '../config/supabase';
import { getSupabaseClient } from '../config/supabase';
import { createNotification } from '../services/notification.service';

// Provider API
// POST /api/v1/policies/propose
export const proposePolicy = async (req: Request, res: Response) => {
  const supabase = getSupabaseClient(req);
  try {
    const providerId = req.user?.user_id;
    if (!providerId) return res.status(401).json({ error: 'Unauthorized' });

    const { service_type, service_id, proposed_policy } = req.body;

    if (!['homestay', 'guide', 'transport', 'package'].includes(service_type)) {
        return res.status(400).json({ error: 'Invalid service type' });
    }
    
    // Verify provider owns the service
    let tableName = '';
    if (service_type === 'homestay') tableName = 'homestays';
    else if (service_type === 'guide') tableName = 'guides';
    else if (service_type === 'transport') tableName = 'transports';
    else if (service_type === 'package') tableName = 'packages';

    // The owner field might differ per table (owner_id vs user_id vs provider_id).
    // Let's assume user_id or provider_id. We'll check the service table.
    // For now, let's just insert it and let RLS handle it, or query it securely.
    // Actually we need to make sure the provider owns it.
    // homestays has user_id. tour_guides has user_id. transport_services has user_id. packages has created_by or user_id.
    const { data: service, error: serviceError } = await supabase
        .from(tableName)
        .select('user_id, id')
        .eq('id', service_id)
        .single();

    // If it's packages, it might be created_by. We'll do a simple fallback if user_id fails.
    if (serviceError) {
        // try created_by for packages
        if (service_type === 'package') {
            const { data: pkg, error: pkgError } = await supabase.from('packages').select('created_by').eq('id', service_id).single();
            if (pkgError || pkg.created_by !== providerId) return res.status(403).json({ error: 'Forbidden' });
        } else {
            return res.status(404).json({ error: 'Service not found or unauthorized' });
        }
    } else if (service.user_id !== providerId) {
        return res.status(403).json({ error: 'Forbidden' });
    }

    // Insert pending policy approval
    const { data, error } = await supabase
      .from('service_policy_approvals')
      .insert({
        service_type,
        service_id,
        provider_id: providerId,
        proposed_policy,
        status: 'pending'
      })
      .select()
      .single();

    if (error) throw error;

    // Notify admins
    // Optional: send email to admins or in-app notification

    return res.status(201).json(data);
  } catch (error: any) {
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// Admin API
// GET /api/v1/policies/pending
export const getPendingPolicies = async (req: Request, res: Response) => {
  try {
    const { data, error } = await adminSupabase
      .from('service_policy_approvals')
      .select('*, users(name, email)')
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return res.status(200).json(data);
  } catch (error: any) {
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// POST /api/v1/policies/:id/approve
export const approvePolicy = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const { data: request, error: fetchError } = await adminSupabase
      .from('service_policy_approvals')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !request) return res.status(404).json({ error: 'Request not found' });
    if (request.status !== 'pending') return res.status(400).json({ error: `Request already ${request.status}` });

    let tableName = '';
    if (request.service_type === 'homestay') tableName = 'homestays';
    else if (request.service_type === 'guide') tableName = 'guides';
    else if (request.service_type === 'transport') tableName = 'transports';
    else if (request.service_type === 'package') tableName = 'packages';

    // 1. Update the actual service table
    const { error: updateServiceError } = await adminSupabase
      .from(tableName)
      .update({ cancellation_policy: request.proposed_policy })
      .eq('id', request.service_id);

    if (updateServiceError) throw updateServiceError;

    // 2. Update the approval request
    const { data: updatedRequest, error: updateRequestError } = await adminSupabase
      .from('service_policy_approvals')
      .update({ status: 'approved' })
      .eq('id', id)
      .select()
      .single();

    if (updateRequestError) throw updateRequestError;

    // Notify Provider
    if (request.provider_id) {
      createNotification(
        request.provider_id,
        'Policy Approved',
        `Your custom cancellation policy for your ${request.service_type} has been approved and is now active.`,
        'system',
        'fas fa-check-circle text-green-500',
        `/dashboard/provider/${request.service_type}s`
      );
    }

    return res.status(200).json(updatedRequest);
  } catch (error: any) {
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// POST /api/v1/policies/:id/reject
export const rejectPolicy = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const { data: request, error: fetchError } = await adminSupabase
      .from('service_policy_approvals')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !request) return res.status(404).json({ error: 'Request not found' });
    if (request.status !== 'pending') return res.status(400).json({ error: `Request already ${request.status}` });

    const { data: updatedRequest, error: updateError } = await adminSupabase
      .from('service_policy_approvals')
      .update({
        status: 'rejected',
        reason: reason || 'Rejected by Admin'
      })
      .eq('id', id)
      .select()
      .single();

    if (updateError) throw updateError;

    // Notify Provider
    if (request.provider_id) {
      createNotification(
        request.provider_id,
        'Policy Rejected',
        `Your custom cancellation policy for your ${request.service_type} was rejected. Reason: ${reason || 'Admin decision'}.`,
        'system',
        'fas fa-times-circle text-red-500',
        `/dashboard/provider/${request.service_type}s`
      );
    }

    return res.status(200).json(updatedRequest);
  } catch (error: any) {
    return res.status(500).json({ error: 'Internal server error' });
  }
};
