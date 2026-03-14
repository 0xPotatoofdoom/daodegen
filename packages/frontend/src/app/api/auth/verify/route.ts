import { NextRequest, NextResponse } from 'next/server';
import { verifyAgentIdentity } from '@/lib/auth';
import { SignJWT } from 'jose';
import { reqLogger } from '@/lib/logger';
import { apiError, Errors, getTraceId } from '@/lib/errors';

import { env } from '@/lib/env';

const SECRET_KEY = new TextEncoder().encode(env.JWT_SECRET);

export async function POST(req: NextRequest) {
  const traceId = getTraceId(req);
  try {
    const { message, signature } = await req.json();

    const authResult = await verifyAgentIdentity({ message, signature });

    if (!authResult.success) {
      return apiError(401, Errors.AUTH_INVALID_TOKEN, { reason: authResult.error }, undefined, traceId);
    }

    // Create JWT
    const token = await new SignJWT({ 
        sub: authResult.address, 
        agentId: authResult.agentId 
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('24h')
      .sign(SECRET_KEY);

    const response = NextResponse.json({ success: true, token });
    
    // Set cookie
    response.cookies.set('auth-token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 60 * 60 * 24, // 1 day
    });

    return response;

  } catch (error: unknown) {
    const log = reqLogger('auth-verify', traceId);
    log.error({ err: error }, 'Auth verify failed');
    return apiError(500, Errors.INTERNAL_ERROR, { operation: "auth_verify" }, undefined, traceId);
  }
}
