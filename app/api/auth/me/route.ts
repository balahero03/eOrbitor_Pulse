import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import jwt from 'jsonwebtoken';
import { getJwtSecret } from '@/lib/jwt';


export async function GET(req: NextRequest) {
  // Outside the try/catch: a missing JWT_SECRET is a server misconfiguration,
  // and must not be swallowed into the generic 401 below.
  const secret = getJwtSecret();

  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, secret) as any;

    const user = await prisma.user.findUnique({ where: { id: decoded.id } });

    if (!user) {
      return NextResponse.json({ message: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }
}
