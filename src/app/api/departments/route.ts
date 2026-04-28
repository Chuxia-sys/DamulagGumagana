import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';

// GET /api/departments
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const isAuthenticated = !!session?.user?.id;

    const departments = await db.department.findMany({
      ...(isAuthenticated
        ? {
            include: {
              _count: { select: { users: true, subjects: true, sections: true } },
            },
          }
        : {
            select: { id: true, name: true, code: true },
          }),
      orderBy: { name: 'asc' },
    });

    return NextResponse.json(departments);
  } catch (error) {
    console.error('Error fetching departments:', error);
    return NextResponse.json({ error: 'Failed to fetch departments' }, { status: 500 });
  }
}

// POST /api/departments - Admin only
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
    const { name, code, college } = body;

    if (!name || !college) {
      return NextResponse.json({ error: 'Name and college are required' }, { status: 400 });
    }

    // Check if department name already exists
    const existing = await db.department.findUnique({ where: { name } });
    if (existing) {
      return NextResponse.json({ error: 'Department name already exists' }, { status: 400 });
    }

    const department = await db.department.create({
      data: { name, code, college },
    });

    await db.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'create',
        entity: 'department',
        entityId: department.id,
        details: JSON.stringify({ name, code, college }),
      },
    });

    return NextResponse.json(department);
  } catch (error) {
    console.error('Error creating department:', error);
    return NextResponse.json({ error: 'Failed to create department' }, { status: 500 });
  }
}
