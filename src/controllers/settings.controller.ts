import { Request, Response } from 'express';
import { adminSupabase } from '../config/supabase';

// GET /api/v1/settings/:key
export const getSetting = async (req: Request, res: Response) => {
  try {
    const { key } = req.params;
    const { data, error } = await adminSupabase
      .from('system_settings')
      .select('value, description')
      .eq('key', key)
      .single();

    if (error || !data) {
      return res.status(404).json({ error: 'Setting not found' });
    }

    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};

// PUT /api/v1/settings/:key
export const updateSetting = async (req: Request, res: Response) => {
  try {
    const { key } = req.params;
    const { value, description } = req.body;

    const { data, error } = await adminSupabase
      .from('system_settings')
      .upsert({ key, value, description, updated_at: new Date().toISOString() })
      .select()
      .single();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};
