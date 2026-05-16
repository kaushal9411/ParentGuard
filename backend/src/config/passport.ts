import passport from 'passport';
import { Strategy as JwtStrategy, ExtractJwt, StrategyOptions } from 'passport-jwt';
import { Strategy as LocalStrategy } from 'passport-local';
import bcrypt from 'bcryptjs';
import { prisma } from './database';

export interface AuthPayload {
  userId: string;
  role: string;
}

export function initPassport(): void {
  // ── Local strategy — email + password login ───────────────────────────────
  passport.use(
    new LocalStrategy(
      { usernameField: 'email', passwordField: 'password', passReqToCallback: false },
      async (email, password, done) => {
        try {
          const user = await prisma.user.findUnique({ where: { email } });
          if (!user) return done(null, false, { message: 'Invalid credentials' });

          const valid = await bcrypt.compare(password, user.passwordHash);
          if (!valid) return done(null, false, { message: 'Invalid credentials' });

          return done(null, { userId: user.id, role: user.role, dbId: user.id });
        } catch (err) {
          return done(err);
        }
      },
    ),
  );

  // ── JWT strategy — Bearer token on protected routes ───────────────────────
  const jwtOptions: StrategyOptions = {
    jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
    secretOrKey: process.env.JWT_SECRET ?? 'dev_secret',
  };

  passport.use(
    new JwtStrategy(jwtOptions, async (payload: AuthPayload, done) => {
      try {
        const user = await prisma.user.findUnique({ where: { id: payload.userId } });
        if (!user) return done(null, false);
        return done(null, { userId: user.id, role: user.role });
      } catch (err) {
        return done(err);
      }
    }),
  );
}
