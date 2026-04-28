import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';

// GET - Poll for new notifications since a given timestamp
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const since = searchParams.get('since');
    
    // Build where clause for new notifications
    const where: {
      userId: string;
      read: boolean;
      createdAt?: { gt: Date };
    } = {
      userId: session.user.id,
      read: false,
    };

    // If 'since' timestamp is provided, only get notifications after that time
    if (since) {
      where.createdAt = { gt: new Date(since) };
    }

    const notifications = await db.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    return NextResponse.json({
      notifications,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error polling notifications:', error);
    return NextResponse.json({ notifications: [], timestamp: new Date().toISOString() });
  }
}
