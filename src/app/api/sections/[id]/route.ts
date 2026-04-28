import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const section = await db.section.findUnique({
      where: { id },
      include: { department: true },
    });

    if (!section) {
      return NextResponse.json({ error: 'Section not found' }, { status: 404 });
    }

    return NextResponse.json(section);
  } catch (error) {
    console.error('Error fetching section:', error);
    return NextResponse.json({ error: 'Failed to fetch section' }, { status: 500 });
  }
}

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
    const body = await request.json();
    const { sectionName, sectionCode, yearLevel, departmentId, studentCount, isActive } = body;

    // Department heads can only update sections in their department
    if (isDeptHead && !isAdmin) {
      const existingSection = await db.section.findUnique({ where: { id } });
      if (!existingSection || existingSection.departmentId !== session.user.departmentId) {
        return NextResponse.json({ error: 'You can only update sections in your department' }, { status: 403 });
      }
    }

    const section = await db.section.update({
      where: { id },
      data: {
        sectionName,
        sectionCode,
        yearLevel,
        departmentId,
        studentCount,
        isActive: isActive ?? true,
      },
      include: { department: true },
    });

    await db.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'update',
        entity: 'section',
        entityId: id,
      },
    });

    return NextResponse.json(section);
  } catch (error) {
    console.error('Error updating section:', error);
    return NextResponse.json({ error: 'Failed to update section' }, { status: 500 });
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

    // Department heads can only delete sections in their department
    if (isDeptHead && !isAdmin) {
      const section = await db.section.findUnique({ where: { id } });
      if (!section || section.departmentId !== session.user.departmentId) {
        return NextResponse.json({ error: 'You can only delete sections in your department' }, { status: 403 });
      }
    }

    const schedulesCount = await db.schedule.count({ where: { sectionId: id } });
    if (schedulesCount > 0) {
      return NextResponse.json({ error: 'Cannot delete section with associated schedules' }, { status: 400 });
    }

    await db.section.delete({ where: { id } });

    await db.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'delete',
        entity: 'section',
        entityId: id,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting section:', error);
    return NextResponse.json({ error: 'Failed to delete section' }, { status: 500 });
  }
}
