import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import bcrypt from 'bcryptjs';

export async function POST() {
  try {
    console.log('🌱 Starting database seed...');

    // Hash password for all demo accounts
    const hashedPassword = await bcrypt.hash('password123', 10);

    // Create departments using upsert
    const departments = await Promise.all([
      db.department.upsert({
        where: { name: 'Computer Science' },
        update: { code: 'CS', college: 'College of Engineering' },
        create: {
          name: 'Computer Science',
          code: 'CS',
          college: 'College of Engineering',
        },
      }),
      db.department.upsert({
        where: { name: 'Electronics Engineering' },
        update: { code: 'EE', college: 'College of Engineering' },
        create: {
          name: 'Electronics Engineering',
          code: 'EE',
          college: 'College of Engineering',
        },
      }),
      db.department.upsert({
        where: { name: 'Mechanical Engineering' },
        update: { code: 'ME', college: 'College of Engineering' },
        create: {
          name: 'Mechanical Engineering',
          code: 'ME',
          college: 'College of Engineering',
        },
      }),
      db.department.upsert({
        where: { name: 'Civil Engineering' },
        update: { code: 'CE', college: 'College of Engineering' },
        create: {
          name: 'Civil Engineering',
          code: 'CE',
          college: 'College of Engineering',
        },
      }),
      db.department.upsert({
        where: { name: 'Business Administration' },
        update: { code: 'BA', college: 'College of Business' },
        create: {
          name: 'Business Administration',
          code: 'BA',
          college: 'College of Business',
        },
      }),
    ]);

    const csDept = departments.find(d => d.code === 'CS')!;
    console.log(`✅ Upserted ${departments.length} departments`);

    // Helper function to upsert user (handles both email and uid unique constraints)
    const upsertUser = async (userData: {
      uid: string;
      name: string;
      email: string;
      password: string;
      role: string;
      departmentId?: string;
      maxUnits: number;
      specialization: string;
    }) => {
      // Try to find by email first
      let user = await db.user.findUnique({
        where: { email: userData.email },
      });

      if (user) {
        // Update existing user
        return db.user.update({
          where: { id: user.id },
          data: {
            uid: userData.uid,
            name: userData.name,
            password: userData.password,
            role: userData.role,
            departmentId: userData.departmentId || null,
            maxUnits: userData.maxUnits,
            specialization: userData.specialization,
          },
        });
      }

      // Check if UID exists with different email
      user = await db.user.findUnique({
        where: { uid: userData.uid },
      });

      if (user) {
        // Update existing user with this UID
        return db.user.update({
          where: { id: user.id },
          data: {
            email: userData.email,
            name: userData.name,
            password: userData.password,
            role: userData.role,
            departmentId: userData.departmentId || null,
            maxUnits: userData.maxUnits,
            specialization: userData.specialization,
          },
        });
      }

      // Create new user
      return db.user.create({
        data: userData,
      });
    };

    // Create users
    const admin = await upsertUser({
      uid: 'admin-001',
      name: 'System Administrator',
      email: 'admin@fepc.edu.ph',
      password: hashedPassword,
      role: 'admin',
      maxUnits: 24,
      specialization: '[]',
    });
    console.log(`✅ Upserted admin user: ${admin.email}`);

    const deptHead = await upsertUser({
      uid: 'head-cs-001',
      name: 'Dr. Maria Santos',
      email: 'head.cs@fepc.edu.ph',
      password: hashedPassword,
      role: 'department_head',
      departmentId: csDept.id,
      maxUnits: 12,
      specialization: '["Computer Science", "Software Engineering"]',
    });
    console.log(`✅ Upserted department head: ${deptHead.email}`);

    const faculty1 = await upsertUser({
      uid: 'faculty-001',
      name: 'Prof. Juan Cruz',
      email: 'faculty1@fepc.edu.ph',
      password: hashedPassword,
      role: 'faculty',
      departmentId: csDept.id,
      maxUnits: 24,
      specialization: '["Programming", "Database Systems"]',
    });

    const faculty2 = await upsertUser({
      uid: 'faculty-002',
      name: 'Prof. Ana Reyes',
      email: 'faculty2@fepc.edu.ph',
      password: hashedPassword,
      role: 'faculty',
      departmentId: csDept.id,
      maxUnits: 24,
      specialization: '["Web Development", "Mobile Apps"]',
    });

    const faculty3 = await upsertUser({
      uid: 'faculty-003',
      name: 'Prof. Carlos Mendoza',
      email: 'faculty3@fepc.edu.ph',
      password: hashedPassword,
      role: 'faculty',
      departmentId: csDept.id,
      maxUnits: 18,
      specialization: '["Networking", "Security"]',
    });

    const facultyMembers = [faculty1, faculty2, faculty3];
    console.log(`✅ Upserted ${facultyMembers.length} faculty members`);

    // Create faculty preferences using upsert
    const allFaculty = [deptHead, ...facultyMembers];
    for (const faculty of allFaculty) {
      const existing = await db.facultyPreference.findUnique({
        where: { facultyId: faculty.id },
      });

      if (existing) {
        await db.facultyPreference.update({
          where: { facultyId: faculty.id },
          data: {
            preferredDays: '["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]',
            preferredTimeStart: '08:00',
            preferredTimeEnd: '17:00',
            preferredSubjects: '[]',
          },
        });
      } else {
        await db.facultyPreference.create({
          data: {
            facultyId: faculty.id,
            preferredDays: '["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]',
            preferredTimeStart: '08:00',
            preferredTimeEnd: '17:00',
            preferredSubjects: '[]',
          },
        });
      }
    }
    console.log(`✅ Upserted faculty preferences for ${allFaculty.length} faculty`);

    // Create rooms using upsert
    const rooms = await Promise.all([
      db.room.upsert({
        where: { roomName: 'Room 101' },
        update: { roomCode: 'R101', capacity: 40, equipment: '["Projector", "Whiteboard"]', building: 'Main Building', floor: 1 },
        create: {
          roomName: 'Room 101',
          roomCode: 'R101',
          capacity: 40,
          equipment: '["Projector", "Whiteboard"]',
          building: 'Main Building',
          floor: 1,
        },
      }),
      db.room.upsert({
        where: { roomName: 'Room 102' },
        update: { roomCode: 'R102', capacity: 35, equipment: '["Projector", "Whiteboard"]', building: 'Main Building', floor: 1 },
        create: {
          roomName: 'Room 102',
          roomCode: 'R102',
          capacity: 35,
          equipment: '["Projector", "Whiteboard"]',
          building: 'Main Building',
          floor: 1,
        },
      }),
      db.room.upsert({
        where: { roomName: 'Room 201' },
        update: { roomCode: 'R201', capacity: 45, equipment: '["Projector", "Whiteboard", "Audio System"]', building: 'Main Building', floor: 2 },
        create: {
          roomName: 'Room 201',
          roomCode: 'R201',
          capacity: 45,
          equipment: '["Projector", "Whiteboard", "Audio System"]',
          building: 'Main Building',
          floor: 2,
        },
      }),
      db.room.upsert({
        where: { roomName: 'Computer Lab A' },
        update: { roomCode: 'LAB-A', capacity: 30, equipment: '["Computers", "Projector", "Air Conditioning"]', building: 'IT Building', floor: 2 },
        create: {
          roomName: 'Computer Lab A',
          roomCode: 'LAB-A',
          capacity: 30,
          equipment: '["Computers", "Projector", "Air Conditioning"]',
          building: 'IT Building',
          floor: 2,
        },
      }),
      db.room.upsert({
        where: { roomName: 'Computer Lab B' },
        update: { roomCode: 'LAB-B', capacity: 30, equipment: '["Computers", "Projector", "Air Conditioning"]', building: 'IT Building', floor: 2 },
        create: {
          roomName: 'Computer Lab B',
          roomCode: 'LAB-B',
          capacity: 30,
          equipment: '["Computers", "Projector", "Air Conditioning"]',
          building: 'IT Building',
          floor: 2,
        },
      }),
    ]);
    console.log(`✅ Upserted ${rooms.length} rooms`);

    // Create subjects using upsert
    const subjects = await Promise.all([
      db.subject.upsert({
        where: { subjectCode: 'CS101' },
        update: { subjectName: 'Introduction to Programming', description: 'Fundamentals of programming using Python', units: 3, departmentId: csDept.id },
        create: {
          subjectCode: 'CS101',
          subjectName: 'Introduction to Programming',
          description: 'Fundamentals of programming using Python',
          units: 3,
          departmentId: csDept.id,
          requiredSpecialization: '[]',
        },
      }),
      db.subject.upsert({
        where: { subjectCode: 'CS102' },
        update: { subjectName: 'Data Structures and Algorithms', description: 'Study of data structures and algorithm design', units: 3, departmentId: csDept.id },
        create: {
          subjectCode: 'CS102',
          subjectName: 'Data Structures and Algorithms',
          description: 'Study of data structures and algorithm design',
          units: 3,
          departmentId: csDept.id,
          requiredSpecialization: '["Computer Science"]',
        },
      }),
      db.subject.upsert({
        where: { subjectCode: 'CS103' },
        update: { subjectName: 'Database Management Systems', description: 'Relational database design and SQL', units: 3, departmentId: csDept.id },
        create: {
          subjectCode: 'CS103',
          subjectName: 'Database Management Systems',
          description: 'Relational database design and SQL',
          units: 3,
          departmentId: csDept.id,
          requiredSpecialization: '["Database Systems"]',
        },
      }),
      db.subject.upsert({
        where: { subjectCode: 'CS104' },
        update: { subjectName: 'Web Development', description: 'HTML, CSS, JavaScript and modern frameworks', units: 3, departmentId: csDept.id },
        create: {
          subjectCode: 'CS104',
          subjectName: 'Web Development',
          description: 'HTML, CSS, JavaScript and modern frameworks',
          units: 3,
          departmentId: csDept.id,
          requiredSpecialization: '["Web Development"]',
        },
      }),
      db.subject.upsert({
        where: { subjectCode: 'CS105' },
        update: { subjectName: 'Object-Oriented Programming', description: 'OOP concepts using Java', units: 3, departmentId: csDept.id },
        create: {
          subjectCode: 'CS105',
          subjectName: 'Object-Oriented Programming',
          description: 'OOP concepts using Java',
          units: 3,
          departmentId: csDept.id,
          requiredSpecialization: '["Programming"]',
        },
      }),
    ]);
    console.log(`✅ Upserted ${subjects.length} subjects`);

    // Create sections using upsert
    const sections = await Promise.all([
      db.section.upsert({
        where: { sectionName: '1CS-A' },
        update: { sectionCode: '1CS-A', yearLevel: 1, departmentId: csDept.id, studentCount: 35 },
        create: {
          sectionName: '1CS-A',
          sectionCode: '1CS-A',
          yearLevel: 1,
          departmentId: csDept.id,
          studentCount: 35,
        },
      }),
      db.section.upsert({
        where: { sectionName: '1CS-B' },
        update: { sectionCode: '1CS-B', yearLevel: 1, departmentId: csDept.id, studentCount: 32 },
        create: {
          sectionName: '1CS-B',
          sectionCode: '1CS-B',
          yearLevel: 1,
          departmentId: csDept.id,
          studentCount: 32,
        },
      }),
      db.section.upsert({
        where: { sectionName: '2CS-A' },
        update: { sectionCode: '2CS-A', yearLevel: 2, departmentId: csDept.id, studentCount: 30 },
        create: {
          sectionName: '2CS-A',
          sectionCode: '2CS-A',
          yearLevel: 2,
          departmentId: csDept.id,
          studentCount: 30,
        },
      }),
      db.section.upsert({
        where: { sectionName: '2CS-B' },
        update: { sectionCode: '2CS-B', yearLevel: 2, departmentId: csDept.id, studentCount: 28 },
        create: {
          sectionName: '2CS-B',
          sectionCode: '2CS-B',
          yearLevel: 2,
          departmentId: csDept.id,
          studentCount: 28,
        },
      }),
      db.section.upsert({
        where: { sectionName: '3CS-A' },
        update: { sectionCode: '3CS-A', yearLevel: 3, departmentId: csDept.id, studentCount: 25 },
        create: {
          sectionName: '3CS-A',
          sectionCode: '3CS-A',
          yearLevel: 3,
          departmentId: csDept.id,
          studentCount: 25,
        },
      }),
    ]);
    console.log(`✅ Upserted ${sections.length} sections`);

    console.log('🎉 Database seed completed!');

    return NextResponse.json({
      success: true,
      message: 'Database seeded successfully!',
      data: {
        departments: departments.length,
        users: 1 + 1 + facultyMembers.length,
        rooms: rooms.length,
        subjects: subjects.length,
        sections: sections.length,
        demoCredentials: {
          admin: 'admin@fepc.edu.ph',
          deptHead: 'head.cs@fepc.edu.ph',
          faculty: 'faculty1@fepc.edu.ph',
          password: 'password123',
        },
      },
    });
  } catch (error) {
    console.error('❌ Seed failed:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to seed database', details: String(error) },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    // Check if database is seeded (check for admin user)
    const adminExists = await db.user.findUnique({
      where: { email: 'admin@fepc.edu.ph' },
    });

    return NextResponse.json({
      seeded: !!adminExists,
      message: adminExists 
        ? 'Database is already seeded' 
        : 'Database needs to be seeded. Call POST /api/seed to seed.',
    });
  } catch (error) {
    return NextResponse.json({
      seeded: false,
      error: 'Failed to check seed status',
      details: String(error),
    });
  }
}
