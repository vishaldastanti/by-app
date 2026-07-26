import { Request, Response, NextFunction } from 'express';

export const authorize = (...allowedRoles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const userRole = (req.user.role || '').trim().toLowerCase();
    const normalizedAllowedRoles = allowedRoles.map(r => r.trim().toLowerCase());

    if (!normalizedAllowedRoles.includes(userRole)) {
      console.error(`[Authorize Error] User role '${req.user.role}' not in allowed roles: ${allowedRoles.join(', ')}`);
      return res.status(403).json({ error: 'Forbidden: Insufficient permissions' });
    }

    next();
  };
};
