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
    const subject = await db.subject.findUnique({
      where: { id },
      include: { department: true },
    });

    if (!subject) {
      return NextResponse.json({ error: 'Subject not found' }, { status: 404 });
    }

    return NextResponse.json({
      ...subject,
      requiredSpecialization: JSON.parse(subject.requiredSpecialization || '[]'),
    });
  } catch (error) {
    console.error('Error fetching subject:', error);
    return NextResponse.json({ error: 'Failed to fetch subject' }, { status: 500 });
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
    const { subjectCode, subjectName, description, units, departmentId, requiredSpecialization, isActive } = body;

    // Department heads can only update subjects in their department
    if (isDeptHead && !isAdmin) {
      const existingSubject = await db.subject.findUnique({ where: { id } });
      if (!existingSubject || existingSubject.departmentId !== session.user.departmentId) {
        return NextResponse.json({ error: 'You can only update subjects in your department' }, { status: 403 });
      }
    }

    const subject = await db.subject.update({
      where: { id },
      data: {
        subjectCode,
        subjectName,
        description,
        units,
        departmentId,
        requiredSpecialization: JSON.stringify(requiredSpecialization || []),
        isActive: isActive ?? true,
      },
      include: { department: true },
    });

    await db.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'update',
        entity: 'subject',
        entityId: id,
        details: JSON.stringify({ subjectCode, subjectName }),
      },
    });

    return NextResponse.json({
      ...subject,
      requiredSpecialization: JSON.parse(subject.requiredSpecialization || '[]'),
    });
  } catch (error) {
    console.error('Error updating subject:', error);
    return NextResponse.json({ error: 'Failed to update subject' }, { status: 500 });
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

    // Department heads can only delete subjects in their department
    if (isDeptHead && !isAdmin) {
      const subject = await db.subject.findUnique({ where: { id } });
      if (!subject || subject.departmentId !== session.user.departmentId) {
        return NextResponse.json({ error: 'You can only delete subjects in your department' }, { status: 403 });
      }
    }

    // Check if subject has schedules
    const schedulesCount = await db.schedule.count({ where: { subjectId: id } });
    if (schedulesCount > 0) {
      return NextResponse.json({ 
        error: 'Cannot delete subject with associated schedules' 
      }, { status: 400 });
    }

    await db.subject.delete({ where: { id } });

    await db.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'delete',
        entity: 'subject',
        entityId: id,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting subject:', error);
    return NextResponse.json({ error: 'Failed to delete subject' }, { status: 500 });
  }
}
