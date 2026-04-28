import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

// POST /api/auth/register - Register a new faculty account
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, email, password, confirmPassword, departmentId, specialization, phone } = body;

    // Validation
    if (!name || !email || !password) {
      return NextResponse.json({ error: 'Name, email, and password are required' }, { status: 400 });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: 'Invalid email format' }, { status: 400 });
    }

    // Validate password strength
    if (password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters long' }, { status: 400 });
    }

    // Check if passwords match
    if (confirmPassword && password !== confirmPassword) {
      return NextResponse.json({ error: 'Passwords do not match' }, { status: 400 });
    }

    // Check if email already exists
    const existingUser = await db.user.findUnique({ where: { email } });
    if (existingUser) {
      return NextResponse.json({ error: 'An account with this email already exists' }, { status: 400 });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user with faculty role
    const user = await db.user.create({
      data: {
        uid: uuidv4(),
        name,
        email,
        password: hashedPassword,
        role: 'faculty', // Default role for self-registration
        departmentId: departmentId || null,
        contractType: 'full-time',
        maxUnits: 24,
        specialization: JSON.stringify(specialization || []),
        phone: phone || null,
      },
      include: { department: true },
    });

    // Create default preferences for faculty
    await db.facultyPreference.create({
      data: {
        facultyId: user.id,
        preferredDays: JSON.stringify(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']),
        preferredTimeStart: '08:00',
        preferredTimeEnd: '17:00',
        preferredSubjects: JSON.stringify([]),
      },
    });

    // Create audit log
    await db.auditLog.create({
      data: {
        userId: user.id,
        action: 'register',
        entity: 'user',
        entityId: user.id,
        details: JSON.stringify({ name, email, role: 'faculty' }),
      },
    });

    // Return user without password
    return NextResponse.json({
      success: true,
      message: 'Account created successfully',
      user: {
        id: user.id,
        uid: user.uid,
        name: user.name,
        email: user.email,
        role: user.role,
        departmentId: user.departmentId,
        department: user.department,
      },
    });
  } catch (error) {
    console.error('Error registering user:', error);
    return NextResponse.json({ error: 'Failed to create account' }, { status: 500 });
  }
}
