import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/preferences - Get faculty preferences
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const facultyId = searchParams.get('facultyId');

    if (!facultyId) {
      return NextResponse.json({ error: 'Faculty ID is required' }, { status: 400 });
    }

    const preferences = await db.facultyPreference.findUnique({
      where: { facultyId },
    });

    if (!preferences) {
      return NextResponse.json(null);
    }

    return NextResponse.json({
      ...preferences,
      preferredDays: JSON.parse(preferences.preferredDays || '[]'),
      preferredSubjects: JSON.parse(preferences.preferredSubjects || '[]'),
      unavailableDays: preferences.unavailableDays ? JSON.parse(preferences.unavailableDays) : [],
    });
  } catch (error) {
    console.error('Error fetching preferences:', error);
    return NextResponse.json({ error: 'Failed to fetch preferences' }, { status: 500 });
  }
}

// PUT /api/preferences - Update faculty preferences
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { facultyId, preferredDays, preferredTimeStart, preferredTimeEnd, preferredSubjects, unavailableDays, notes } = body;

    if (!facultyId) {
      return NextResponse.json({ error: 'Faculty ID is required' }, { status: 400 });
    }

    // Upsert preferences
    const preferences = await db.facultyPreference.upsert({
      where: { facultyId },
      create: {
        facultyId,
        preferredDays: JSON.stringify(preferredDays || []),
        preferredTimeStart: preferredTimeStart || '08:00',
        preferredTimeEnd: preferredTimeEnd || '17:00',
        preferredSubjects: JSON.stringify(preferredSubjects || []),
        unavailableDays: unavailableDays ? JSON.stringify(unavailableDays) : null,
        notes: notes || null,
      },
      update: {
        preferredDays: JSON.stringify(preferredDays || []),
        preferredTimeStart: preferredTimeStart || '08:00',
        preferredTimeEnd: preferredTimeEnd || '17:00',
        preferredSubjects: JSON.stringify(preferredSubjects || []),
        unavailableDays: unavailableDays ? JSON.stringify(unavailableDays) : null,
        notes: notes || null,
      },
    });

    // Create audit log
    await db.auditLog.create({
      data: {
        userId: facultyId,
        action: 'update_preferences',
        entity: 'facultyPreference',
        entityId: preferences.id,
      },
    });

    // Create notification
    await db.notification.create({
      data: {
        userId: facultyId,
        title: 'Preferences Updated',
        message: 'Your scheduling preferences have been saved successfully.',
        type: 'success',
      },
    });

    return NextResponse.json({
      success: true,
      preferences: {
        ...preferences,
        preferredDays: JSON.parse(preferences.preferredDays || '[]'),
        preferredSubjects: JSON.parse(preferences.preferredSubjects || '[]'),
        unavailableDays: preferences.unavailableDays ? JSON.parse(preferences.unavailableDays) : [],
      },
    });
  } catch (error) {
    console.error('Error updating preferences:', error);
    return NextResponse.json({ error: 'Failed to update preferences' }, { status: 500 });
  }
}
