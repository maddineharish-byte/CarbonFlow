/**
 * CarbonFlow — Authentication, JWT Lifecycle & Multi-Tenant Context Middleware
 */
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { db } from './db.ts';
import { TenantContext, RoleName, PermissionCode } from './types.ts';
import { hasPermission, ROLE_PERMISSIONS } from './rbac.ts';

const JWT_SECRET = process.env.JWT_SECRET || 'carbonflow-jwt-super-secret-key-2026-sha256';
const REFRESH_SECRET = process.env.REFRESH_TOKEN_SECRET || 'carbonflow-refresh-super-secret-key-2026-sha512';

export interface AuthenticatedRequest extends Request {
  tenantContext?: TenantContext;
}

export interface JwtPayload {
  userId: string;
  organizationId: string;
  role: RoleName;
}

export function generateTokenPair(userId: string, organizationId: string, role: RoleName) {
  const payload: JwtPayload = { userId, organizationId, role };
  
  // Access token valid for 15 minutes
  const accessToken = jwt.sign(payload, JWT_SECRET, { expiresIn: '15m' });

  // Refresh token valid for 7 days
  const rawRefreshToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(rawRefreshToken).digest('hex');
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  db.refreshTokens.push({
    id: crypto.randomUUID(),
    userId,
    tokenHash,
    expiresAt,
    createdAt: new Date().toISOString(),
  });

  return { accessToken, refreshToken: rawRefreshToken };
}

/**
 * Middleware: Derives and cryptographically verifies TenantContext.
 * Reject any untrusted organization claims.
 */
export function authenticateTenant(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Missing or malformed Authorization header.' },
    });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
    const user = db.users.find((u) => u.id === decoded.userId && u.isActive);
    if (!user) {
      return res.status(401).json({
        success: false,
        error: { code: 'USER_DEACTIVATED', message: 'User account is inactive or deleted.' },
      });
    }

    // Crucial: Verify user actually belongs to requested organization
    const membership = db.memberships.find(
      (m) => m.userId === decoded.userId && m.organizationId === decoded.organizationId && m.isActive
    );

    if (!membership) {
      return res.status(403).json({
        success: false,
        error: { code: 'TENANT_ACCESS_DENIED', message: 'User does not belong to this organization.' },
      });
    }

    req.tenantContext = {
      organizationId: membership.organizationId,
      userId: user.id,
      role: membership.role,
      permissions: ROLE_PERMISSIONS[membership.role] || [],
    };

    next();
  } catch (err) {
    return res.status(401).json({
      success: false,
      error: { code: 'INVALID_TOKEN', message: 'Access token expired or signature invalid.' },
    });
  }
}

/**
 * Middleware: Enforces canonical RBAC permission server-side.
 */
export function requirePermission(permission: PermissionCode) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.tenantContext) {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required.' },
      });
    }

    if (!hasPermission(req.tenantContext.role, permission)) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: `Role '${req.tenantContext.role}' lacks required permission '${permission}'.`,
        },
      });
    }

    next();
  };
}
