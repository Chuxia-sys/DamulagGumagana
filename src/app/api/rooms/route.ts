import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';

// GET /api/rooms
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const rooms = await db.room.findMany({
      include: {
        _count: { select: { schedules: true } },
      },
      orderBy: [{ building: 'asc' }, { roomName: 'asc' }],
    });

    const formattedRooms = rooms.map(room => ({
      ...room,
      equipment: JSON.parse(room.equipment || '[]'),
    }));

    return NextResponse.json(formattedRooms);
  } catch (error) {
    console.error('Error fetching rooms:', error);
    return NextResponse.json({ error: 'Failed to fetch rooms' }, { status: 500 });
  }
}

// POST /api/rooms - Admin only
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Access denied. Admin only.' }, { status: 403 });
    }

    const body = await request.json();
    const { roomName, roomCode, capacity, equipment, building, floor } = body;

    if (!roomName || !capacity || !building) {
      return NextResponse.json({ error: 'Room name, capacity, and building are required' }, { status: 400 });
    }

    // Check if room name already exists
    const existing = await db.room.findUnique({ where: { roomName } });
    if (existing) {
      return NextResponse.json({ error: 'Room name already exists' }, { status: 400 });
    }

    const room = await db.room.create({
      data: {
        roomName,
        roomCode,
        capacity,
        equipment: JSON.stringify(equipment || []),
        building,
        floor,
      },
    });

    await db.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'create',
        entity: 'room',
        entityId: room.id,
        details: JSON.stringify({ roomName, building }),
      },
    });

    return NextResponse.json({
      ...room,
      equipment: JSON.parse(room.equipment || '[]'),
    });
  } catch (error) {
    console.error('Error creating room:', error);
    return NextResponse.json({ error: 'Failed to create room' }, { status: 500 });
  }
}
