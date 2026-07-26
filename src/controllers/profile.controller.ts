import { Request, Response } from 'express';
import { getSupabaseClient, adminSupabase } from '../config/supabase';

// Get user profile/preferences
export const getProfile = async (req: Request, res: Response) => {
  const supabase = getSupabaseClient(req);
    try {
        const userId = req.user?.user_id;
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        // Fetch from user_profiles table
        const { data, error } = await supabase
            .from('user_profiles')
            .select('*')
            .eq('user_id', userId)
            .single();

        if (error && error.code !== 'PGRST116') { // PGRST116 is "No rows found"
            console.error('Error fetching profile:', error);
            return res.status(500).json({ error: 'Failed to fetch profile' });
        }

        // Return empty profile object if none exists yet
        return res.json(data || { user_id: userId, dietary_pref: 'Any', languages: [] });
    } catch (error) {
        console.error('Profile fetch error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// Update user profile/preferences
export const updateProfile = async (req: Request, res: Response) => {
  const supabase = getSupabaseClient(req);
    try {
        const userId = req.user?.user_id;
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const { age, gender, emergency_contact_name, emergency_contact_phone, dietary_pref, accessibility_needs, languages, id_proof_url } = req.body;

        const payload = {
            user_id: userId,
            age: age ? parseInt(age) : null,
            gender,
            emergency_contact_name,
            emergency_contact_phone,
            dietary_pref,
            accessibility_needs,
            languages: languages || [],
            id_proof_url,
            updated_at: new Date().toISOString()
        };

        const { data, error } = await supabase
            .from('user_profiles')
            .upsert(payload)
            .select()
            .single();

        if (error) {
            console.error('Error updating profile:', error);
            return res.status(500).json({ error: 'Failed to update profile' });
        }

        return res.json(data);
    } catch (error) {
        console.error('Profile update error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
