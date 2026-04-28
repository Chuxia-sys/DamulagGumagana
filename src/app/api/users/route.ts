import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

// GET /api/users - Fetch all users (Admin and Department Head only)
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const role = searchParams.get('role');
    const departmentId = searchParams.get('departmentId');

    // Only admin and department_head can list users
    const isAdmin = session.user.role === 'admin';
    const isDeptHead = session.user.role === 'department_head';
    
    if (!isAdmin && !isDeptHead) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Department heads can only see users from their department
    const filterDepartmentId = isDeptHead ? session.user.departmentId : departmentId;

    const users = await db.user.findMany({
      where: {
        ...(role && { role }),
        ...(filterDepartmentId && { departmentId: filterDepartmentId }),
      },
      include: {
        department: true,
        preferences: true,
        _count: { select: { schedules: true } },
      },
      orderBy: { name: 'asc' },
    });

    const formattedUsers = users.map(user => ({
      ...user,
      specialization: JSON.parse(user.specialization || '[]'),
      preferences: user.preferences ? {
        ...user.preferences,
        preferredDays: JSON.parse(user.preferences.preferredDays || '[]'),
        preferredSubjects: JSON.parse(user.preferences.preferredSubjects || '[]'),
        unavailableDays: user.preferences.unavailableDays ? JSON.parse(user.preferences.unavailableDays) : [],
      } : null,
    }));

    return NextResponse.json(formattedUsers);
  } catch (error) {
    console.error('Error fetching users:', error);
    return NextResponse.json([], { status: 200 });
  }
}

// POST /api/users - Create a new user (Admin only)
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only admin can create users
    if (session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Access denied. Admin only.' }, { status: 403 });
    }

    const body = await request.json();
    const { name, email, password, role, departmentId, contractType, maxUnits, specialization } = body;

    // Validation
    if (!name || !email || !password) {
      return NextResponse.json({ error: 'Name, email, and password are required' }, { status: 400 });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: 'Invalid email format' }, { status: 400 });
    }

    // Validate password length
    if (password.length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 });
    }

    // Check if email already exists
    const existingUser = await db.user.findUnique({ where: { email } });
    if (existingUser) {
      return NextResponse.json({ error: 'Email already exists' }, { status: 400 });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const user = await db.user.create({
      data: {
        uid: uuidv4(),
        name,
        email,
        password: hashedPassword,
        role: role || 'faculty',
        departmentId: departmentId || null,
        contractType: contractType || 'full-time',
        maxUnits: maxUnits || 24,
        specialization: JSON.stringify(specialization || []),
      },
      include: { department: true },
    });

    // Create default preferences for faculty
    if (role === 'faculty') {
      await db.facultyPreference.create({
        data: {
          facultyId: user.id,
          preferredDays: JSON.stringify(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']),
          preferredTimeStart: '08:00',
          preferredTimeEnd: '17:00',
          preferredSubjects: JSON.stringify([]),
        },
      });
    }

    // Create audit log
    await db.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'create',
        entity: 'user',
        entityId: user.id,
        details: JSON.stringify({ name, email, role }),
      },
    });

    // Create notification for new user
    await db.notification.create({
      data: {
        userId: user.id,
        title: 'Welcome to FEPC Scheduling System',
        message: `Your account has been created. Please update your preferences and profile.`,
        type: 'success',
      },
    });

    return NextResponse.json({
      ...user,
      specialization: JSON.parse(user.specialization || '[]'),
    });
  } catch (error) {
    console.error('Error creating user:', error);
    return NextResponse.json({ error: 'Failed to create user' }, { status: 500 });
  }
}
