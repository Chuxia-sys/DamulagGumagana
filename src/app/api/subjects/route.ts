import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';

// GET /api/subjects
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const departmentId = searchParams.get('departmentId');

    const subjects = await db.subject.findMany({
      where: departmentId ? { departmentId } : undefined,
      include: {
        department: true,
        _count: { select: { schedules: true } },
      },
      orderBy: { subjectCode: 'asc' },
    });

    const formattedSubjects = subjects.map(subject => ({
      ...subject,
      requiredSpecialization: JSON.parse(subject.requiredSpecialization || '[]'),
    }));

    return NextResponse.json(formattedSubjects);
  } catch (error) {
    console.error('Error fetching subjects:', error);
    return NextResponse.json({ error: 'Failed to fetch subjects' }, { status: 500 });
  }
}

// POST /api/subjects - Admin and Department Head only
export async function POST(request: NextRequest) {
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

    const body = await request.json();
    const { subjectCode, subjectName, description, units, departmentId, requiredSpecialization } = body;

    if (!subjectCode || !subjectName || !units || !departmentId) {
      return NextResponse.json({ error: 'Subject code, name, units, and department are required' }, { status: 400 });
    }

    // Department heads can only create subjects for their department
    if (isDeptHead && !isAdmin && session.user.departmentId !== departmentId) {
      return NextResponse.json({ error: 'You can only create subjects for your department' }, { status: 403 });
    }

    // Check if subject code exists
    const existing = await db.subject.findUnique({ where: { subjectCode } });
    if (existing) {
      return NextResponse.json({ error: 'Subject code already exists' }, { status: 400 });
    }

    const subject = await db.subject.create({
      data: {
        subjectCode,
        subjectName,
        description,
        units,
        departmentId,
        requiredSpecialization: JSON.stringify(requiredSpecialization || []),
      },
      include: { department: true },
    });

    await db.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'create',
        entity: 'subject',
        entityId: subject.id,
        details: JSON.stringify({ subjectCode, subjectName }),
      },
    });

    return NextResponse.json({
      ...subject,
      requiredSpecialization: JSON.parse(subject.requiredSpecialization || '[]'),
    });
  } catch (error) {
    console.error('Error creating subject:', error);
    return NextResponse.json({ error: 'Failed to create subject' }, { status: 500 });
  }
}
