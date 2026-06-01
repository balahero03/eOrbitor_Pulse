import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, AuthUser } from '@/lib/middleware/auth';
import { ForbiddenError } from '@/lib/errors';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: vendorId } = await params;
  return withAuth(async (req: NextRequest, user: AuthUser) => {
    if (!['SUPER_ADMIN', 'ADMIN'].includes(user.role)) throw new ForbiddenError();

    const { productId, vendorSku, vendorPrice, leadTime, minimumOrder } = await req.json();

    if (!productId || !vendorSku || !vendorPrice) {
      return NextResponse.json(
        { message: 'productId, vendorSku, and vendorPrice are required' },
        { status: 400 }
      );
    }

    const existingLink = await prisma.vendorProduct.findUnique({
      where: { vendorId_productId: { vendorId, productId } },
    });
    if (existingLink) {
      return NextResponse.json({ message: 'Product already linked to this vendor' }, { status: 400 });
    }

    const vendorProduct = await prisma.vendorProduct.create({
      data: {
        vendorId,
        productId,
        vendorSku,
        vendorPrice: parseFloat(vendorPrice),
        leadTime: leadTime ? parseInt(leadTime) : null,
        minimumOrder: minimumOrder ? parseInt(minimumOrder) : null,
      },
      include: {
        product: { select: { id: true, sku: true, name: true, basePrice: true } },
        vendor: { select: { id: true, vendorName: true } },
      },
    });

    return NextResponse.json(vendorProduct, { status: 201 });
  })(req);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: vendorId } = await params;
  return withAuth(async (req: NextRequest, user: AuthUser) => {
    if (!['SUPER_ADMIN', 'ADMIN'].includes(user.role)) throw new ForbiddenError();

    const { searchParams } = new URL(req.url);
    const productId = searchParams.get('productId');

    if (!productId) {
      return NextResponse.json({ message: 'productId is required' }, { status: 400 });
    }

    await prisma.vendorProduct.delete({
      where: { vendorId_productId: { vendorId, productId } },
    });

    return NextResponse.json({ message: 'Product removed from vendor' });
  })(req);
}
