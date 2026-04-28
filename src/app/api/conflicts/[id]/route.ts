import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const isAdmin = session.user.role === 'admin';
    const isDeptHead = session.user.role === 'department_head';

    if (!isAdmin && !isDeptHead) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const { id } = await params;

    const conflict = await db.conflict.update({
      where: { id },
      data: {
        resolved: true,
        resolvedBy: session.user.id,
        resolvedAt: new Date(),
      },
    });

    await db.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'resolve',
        entity: 'conflict',
        entityId: id,
        details: JSON.stringify({ resolvedBy: session.user.id }),
      },
    });

    return NextResponse.json(conflict);
  } catch (error) {
    console.error('Error resolving conflict:', error);
    return NextResponse.json({ error: 'Failed to resolve conflict' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const isAdmin = session.user.role === 'admin';
    const isDeptHead = session.user.role === 'department_head';

    if (!isAdmin && !isDeptHead) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const { id } = await params;
    await db.conflict.delete({ where: { id } });

    await db.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'delete',
        entity: 'conflict',
        entityId: id,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting conflict:', error);
    return NextResponse.json({ error: 'Failed to delete conflict' }, { status: 500 });
  }
}
