import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  // Create departments
  const departments = await Promise.all([
    prisma.department.upsert({
      where: { name: 'Computer Science' },
      update: {},
      create: {
        name: 'Computer Science',
        code: 'CS',
        college: 'College of Engineering',
      },
    }),
    prisma.department.upsert({
      where: { name: 'Electronics Engineering' },
      update: {},
      create: {
        name: 'Electronics Engineering',
        code: 'EE',
        college: 'College of Engineering',
      },
    }),
    prisma.department.upsert({
      where: { name: 'Mechanical Engineering' },
      update: {},
      create: {
        name: 'Mechanical Engineering',
        code: 'ME',
        college: 'College of Engineering',
      },
    }),
    prisma.department.upsert({
      where: { name: 'Civil Engineering' },
      update: {},
      create: {
        name: 'Civil Engineering',
        code: 'CE',
        college: 'College of Engineering',
      },
    }),
    prisma.department.upsert({
      where: { name: 'Business Administration' },
      update: {},
      create: {
        name: 'Business Administration',
        code: 'BA',
        college: 'College of Business',
      },
    }),
  ]);

  const csDept = departments.find(d => d.code === 'CS')!;
  console.log(`✅ Created ${departments.length} departments`);

  // Hash password for all demo accounts
  const hashedPassword = await bcrypt.hash('password123', 10);

  // Create admin user
  const admin = await prisma.user.upsert({
    where: { email: 'admin@fepc.edu.ph' },
    update: {},
    create: {
      uid: 'admin-001',
      name: 'System Administrator',
      email: 'admin@fepc.edu.ph',
      password: hashedPassword,
      role: 'admin',
      maxUnits: 24,
      specialization: '[]',
    },
  });
  console.log(`✅ Created admin user: ${admin.email}`);

  // Create department head
  const deptHead = await prisma.user.upsert({
    where: { email: 'head.cs@fepc.edu.ph' },
    update: {},
    create: {
      uid: 'head-cs-001',
      name: 'Dr. Maria Santos',
      email: 'head.cs@fepc.edu.ph',
      password: hashedPassword,
      role: 'department_head',
      departmentId: csDept.id,
      maxUnits: 12,
      specialization: '["Computer Science", "Software Engineering"]',
    },
  });
  console.log(`✅ Created department head: ${deptHead.email}`);

  // Create faculty members
  const facultyMembers = await Promise.all([
    prisma.user.upsert({
      where: { email: 'faculty1@fepc.edu.ph' },
      update: {},
      create: {
        uid: 'faculty-001',
        name: 'Prof. Juan Cruz',
        email: 'faculty1@fepc.edu.ph',
        password: hashedPassword,
        role: 'faculty',
        departmentId: csDept.id,
        maxUnits: 24,
        specialization: '["Programming", "Database Systems"]',
      },
    }),
    prisma.user.upsert({
      where: { email: 'faculty2@fepc.edu.ph' },
      update: {},
      create: {
        uid: 'faculty-002',
        name: 'Prof. Ana Reyes',
        email: 'faculty2@fepc.edu.ph',
        password: hashedPassword,
        role: 'faculty',
        departmentId: csDept.id,
        maxUnits: 24,
        specialization: '["Web Development", "Mobile Apps"]',
      },
    }),
    prisma.user.upsert({
      where: { email: 'faculty3@fepc.edu.ph' },
      update: {},
      create: {
        uid: 'faculty-003',
        name: 'Prof. Carlos Mendoza',
        email: 'faculty3@fepc.edu.ph',
        password: hashedPassword,
        role: 'faculty',
        departmentId: csDept.id,
        maxUnits: 18,
        specialization: '["Networking", "Security"]',
      },
    }),
  ]);
  console.log(`✅ Created ${facultyMembers.length} faculty members`);

  // Create faculty preferences for all faculty
  const allFaculty = [deptHead, ...facultyMembers];
  for (const faculty of allFaculty) {
    await prisma.facultyPreference.upsert({
      where: { facultyId: faculty.id },
      update: {},
      create: {
        facultyId: faculty.id,
        preferredDays: '["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]',
        preferredTimeStart: '08:00',
        preferredTimeEnd: '17:00',
        preferredSubjects: '[]',
      },
    });
  }
  console.log(`✅ Created faculty preferences for ${allFaculty.length} faculty`);

  // Create sample rooms
  const rooms = await Promise.all([
    prisma.room.upsert({
      where: { roomName: 'Room 101' },
      update: {},
      create: {
        roomName: 'Room 101',
        roomCode: 'R101',
        capacity: 40,
        equipment: '["Projector", "Whiteboard"]',
        building: 'Main Building',
        floor: 1,
      },
    }),
    prisma.room.upsert({
      where: { roomName: 'Room 102' },
      update: {},
      create: {
        roomName: 'Room 102',
        roomCode: 'R102',
        capacity: 35,
        equipment: '["Projector", "Whiteboard"]',
        building: 'Main Building',
        floor: 1,
      },
    }),
    prisma.room.upsert({
      where: { roomName: 'Room 201' },
      update: {},
      create: {
        roomName: 'Room 201',
        roomCode: 'R201',
        capacity: 45,
        equipment: '["Projector", "Whiteboard", "Audio System"]',
        building: 'Main Building',
        floor: 2,
      },
    }),
    prisma.room.upsert({
      where: { roomName: 'Computer Lab A' },
      update: {},
      create: {
        roomName: 'Computer Lab A',
        roomCode: 'LAB-A',
        capacity: 30,
        equipment: '["Computers", "Projector", "Air Conditioning"]',
        building: 'IT Building',
        floor: 2,
      },
    }),
    prisma.room.upsert({
      where: { roomName: 'Computer Lab B' },
      update: {},
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

  console.log(`✅ Created ${rooms.length} rooms`);

  // Create sample subjects
  const subjects = await Promise.all([
    prisma.subject.upsert({
      where: { subjectCode: 'CS101' },
      update: {},
      create: {
        subjectCode: 'CS101',
        subjectName: 'Introduction to Programming',
        description: 'Fundamentals of programming using Python',
        units: 3,
        departmentId: csDept.id,
        requiredSpecialization: '[]',
      },
    }),
    prisma.subject.upsert({
      where: { subjectCode: 'CS102' },
      update: {},
      create: {
        subjectCode: 'CS102',
        subjectName: 'Data Structures and Algorithms',
        description: 'Study of data structures and algorithm design',
        units: 3,
        departmentId: csDept.id,
        requiredSpecialization: '["Computer Science"]',
      },
    }),
    prisma.subject.upsert({
      where: { subjectCode: 'CS103' },
      update: {},
      create: {
        subjectCode: 'CS103',
        subjectName: 'Database Management Systems',
        description: 'Relational database design and SQL',
        units: 3,
        departmentId: csDept.id,
        requiredSpecialization: '["Database Systems"]',
      },
    }),
    prisma.subject.upsert({
      where: { subjectCode: 'CS104' },
      update: {},
      create: {
        subjectCode: 'CS104',
        subjectName: 'Web Development',
        description: 'HTML, CSS, JavaScript and modern frameworks',
        units: 3,
        departmentId: csDept.id,
        requiredSpecialization: '["Web Development"]',
      },
    }),
    prisma.subject.upsert({
      where: { subjectCode: 'CS105' },
      update: {},
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

  console.log(`✅ Created ${subjects.length} subjects`);

  // Create sample sections
  const sections = await Promise.all([
    prisma.section.upsert({
      where: { sectionName: '1CS-A' },
      update: {},
      create: {
        sectionName: '1CS-A',
        sectionCode: '1CS-A',
        yearLevel: 1,
        departmentId: csDept.id,
        studentCount: 35,
      },
    }),
    prisma.section.upsert({
      where: { sectionName: '1CS-B' },
      update: {},
      create: {
        sectionName: '1CS-B',
        sectionCode: '1CS-B',
        yearLevel: 1,
        departmentId: csDept.id,
        studentCount: 32,
      },
    }),
    prisma.section.upsert({
      where: { sectionName: '2CS-A' },
      update: {},
      create: {
        sectionName: '2CS-A',
        sectionCode: '2CS-A',
        yearLevel: 2,
        departmentId: csDept.id,
        studentCount: 30,
      },
    }),
    prisma.section.upsert({
      where: { sectionName: '2CS-B' },
      update: {},
      create: {
        sectionName: '2CS-B',
        sectionCode: '2CS-B',
        yearLevel: 2,
        departmentId: csDept.id,
        studentCount: 28,
      },
    }),
    prisma.section.upsert({
      where: { sectionName: '3CS-A' },
      update: {},
      create: {
        sectionName: '3CS-A',
        sectionCode: '3CS-A',
        yearLevel: 3,
        departmentId: csDept.id,
        studentCount: 25,
      },
    }),
  ]);

  console.log(`✅ Created ${sections.length} sections`);

  console.log('🎉 Database seed completed!');
  console.log('');
  console.log('📝 Demo Login Credentials (all use password: password123):');
  console.log('   Admin:      admin@fepc.edu.ph');
  console.log('   Dept Head:  head.cs@fepc.edu.ph');
  console.log('   Faculty:    faculty1@fepc.edu.ph');
  console.log('');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
