import { Request, Response, NextFunction } from 'express';
import { getUserFeatures } from '../routes/subscriptions';
import type { SubscriptionFeatures } from '../types/subscription';

type FeatureKey = keyof SubscriptionFeatures;

/**
 * Gate a route behind a subscription feature.
 * Returns 403 with { error: 'plan_limit', feature, upgradeRequired: true }
 * if the user's active plan does not include the feature.
 */
export function requireFeature(feature: FeatureKey) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const features = await getUserFeatures(req.auth.userId);
      const value = features[feature];
      // For numeric features (maxDevices, historyDays) just pass — they need custom logic
      if (typeof value === 'boolean' && !value) {
        res.status(403).json({
          error:           'plan_limit',
          feature,
          upgradeRequired: true,
          message:         `Your current plan does not include this feature. Please upgrade to access it.`,
        });
        return;
      }
      // Attach features to request so routes can use them (e.g. historyDays)
      (req as Request & { planFeatures?: SubscriptionFeatures }).planFeatures = features;
      next();
    } catch {
      next(); // fail open — don't block on subscription errors
    }
  };
}

/**
 * Check maxDevices limit before allowing device registration.
 */
export async function checkDeviceLimit(req: Request, res: Response, next: NextFunction) {
  try {
    const { prisma } = await import('../config/database');
    const features = await getUserFeatures(req.auth.userId);
    const currentCount = await prisma.device.count({ where: { userId: req.auth.userId } });
    if (currentCount >= features.maxDevices) {
      res.status(403).json({
        error:           'plan_limit',
        feature:         'maxDevices',
        upgradeRequired: true,
        message:         `Your plan allows a maximum of ${features.maxDevices} device(s). Please upgrade to add more.`,
        current:         currentCount,
        max:             features.maxDevices,
      });
      return;
    }
    next();
  } catch {
    next();
  }
}
