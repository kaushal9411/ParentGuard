import { Request, Response, NextFunction } from 'express';
import passport from 'passport';
import { AuthPayload } from '../config/passport';

// Extend Express Request so all route handlers can access req.auth
declare global {
  namespace Express {
    interface Request {
      auth: AuthPayload;
    }
  }
}

export type { AuthPayload };

/**
 * Passport JWT middleware — validates Bearer token and populates req.auth.
 * Returns 401 if token is missing, invalid, or expired.
 */
export function authenticate(req: Request, res: Response, next: NextFunction): void {
  passport.authenticate(
    'jwt',
    { session: false },
    (err: Error | null, user: AuthPayload | false) => {
      if (err) return next(err);
      if (!user) {
        res.status(401).json({ error: 'Invalid or expired token' });
        return;
      }
      req.auth = user;
      next();
    },
  )(req, res, next);
}
