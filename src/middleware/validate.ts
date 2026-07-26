import { Request, Response, NextFunction } from 'express';
import { ZodSchema } from 'zod';

type RequestParts = {
  body?: Request['body'];
  query?: Request['query'];
  params?: Request['params'];
};

export const validate = (schema: ZodSchema<RequestParts>) => 
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params,
      });
      if (parsed.body !== undefined) req.body = parsed.body;
      if (parsed.query !== undefined) req.query = parsed.query;
      if (parsed.params !== undefined) req.params = parsed.params;
      return next();
    } catch (error: any) {
      console.error('Validation error:', error.issues || error.message || error);
      return res.status(400).json({ error: error.issues || error.errors || error.message || 'Validation failed' });
    }
  };
