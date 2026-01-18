// Seed script to populate database with test data
require('dotenv').config();
const { initDatabase } = require('./config/database');
const User = require('./models/User');
const Equipment = require('./models/Equipment');
const Reservation = require('./models/Reservation');

const seedDatabase = async () => {
  console.log('🌱 Starting database seeding...\n');

  try {
    // Initialize database
    await initDatabase();
    console.log('✓ Database initialized\n');

    // Create users
    console.log('Creating users...');
    
    // Check if admin exists
    const existingAdmin = await User.findByEmail('admin@test.com');
    if (!existingAdmin) {
      const adminId = await User.create('admin', 'admin@test.com', 'admin123', 'admin');
      console.log('✓ Admin user created (ID:', adminId, ')');
    } else {
      console.log('✓ Admin user already exists');
    }

    // Check if regular user exists
    const existingUser = await User.findByEmail('user@test.com');
    if (!existingUser) {
      const userId = await User.create('testuser', 'user@test.com', 'user123', 'user');
      console.log('✓ Regular user created (ID:', userId, ')');
    } else {
      console.log('✓ Regular user already exists');
    }

    // Create additional test users
    const testUsers = [
      { username: 'john', email: 'john@test.com', password: 'john123' },
      { username: 'jane', email: 'jane@test.com', password: 'jane123' },
    ];

    for (const userData of testUsers) {
      const existing = await User.findByEmail(userData.email);
      if (!existing) {
        await User.create(userData.username, userData.email, userData.password, 'user');
        console.log(`✓ User ${userData.username} created`);
      }
    }

    console.log('\n');

    // Create equipment
    console.log('Creating equipment...');
    
    const equipmentData = [
      {
        name: 'SEM (주사전자현미경)',
        description: '고해상도 표면 이미지 촬영을 위한 주사전자현미경',
        location: '1층 분석실',
        status: 'available',
        image_url: 'https://images.unsplash.com/photo-1581092160562-40aa08e78837?w=400'
      },
      {
        name: 'AFM (원자간력현미경)',
        description: '나노스케일 표면 형상 측정 장비',
        location: '2층 나노실험실',
        status: 'available',
        image_url: 'https://images.unsplash.com/photo-1532094349884-543bc11b234d?w=400'
      },
      {
        name: 'XRD (X선 회절분석기)',
        description: '결정 구조 분석을 위한 X선 회절 장비',
        location: '1층 분석실',
        status: 'available',
        image_url: 'https://images.unsplash.com/photo-1582719471384-894fbb16e074?w=400'
      },
      {
        name: 'FTIR (적외선분광기)',
        description: '화학 결합 분석을 위한 적외선 분광 장비',
        location: '3층 화학실',
        status: 'available',
        image_url: 'https://images.unsplash.com/photo-1584036561566-baf8f5f1b144?w=400'
      },
      {
        name: 'Spin Coater (스핀코터)',
        description: '박막 증착을 위한 스핀 코팅 장비',
        location: '지하 1층 공정실',
        status: 'available',
        image_url: 'https://images.unsplash.com/photo-1559757175-0eb30cd8c063?w=400'
      },
      {
        name: '3D 프린터',
        description: '시제품 제작용 FDM 방식 3D 프린터',
        location: '2층 제작실',
        status: 'maintenance',
        image_url: 'https://images.unsplash.com/photo-1581092160562-40aa08e78837?w=400'
      },
    ];

    for (const eq of equipmentData) {
      await Equipment.create(eq.name, eq.description, eq.location, eq.status, eq.image_url);
      console.log(`✓ Equipment created: ${eq.name}`);
    }

    console.log('\n');

    // Create sample reservations
    console.log('Creating sample reservations...');
    
    const equipment = await Equipment.getAll();
    const users = await User.getAll();
    
    if (equipment.length > 0 && users.length > 0) {
      const now = new Date();
      
      // Reservation 1: Today, 2 hours
      const res1Start = new Date(now);
      res1Start.setHours(14, 0, 0, 0);
      const res1End = new Date(res1Start);
      res1End.setHours(16, 0, 0, 0);
      
      if (equipment[0] && users[0]) {
        await Reservation.create(
          equipment[0].id,
          users[0].id,
          res1Start.toISOString(),
          res1End.toISOString(),
          '표면 형상 분석',
          'confirmed'
        );
        console.log('✓ Reservation 1 created (Today, 14:00-16:00)');
      }

      // Reservation 2: Tomorrow
      const res2Start = new Date(now);
      res2Start.setDate(res2Start.getDate() + 1);
      res2Start.setHours(10, 0, 0, 0);
      const res2End = new Date(res2Start);
      res2End.setHours(12, 0, 0, 0);
      
      if (equipment[1] && users[1]) {
        await Reservation.create(
          equipment[1].id,
          users[1].id,
          res2Start.toISOString(),
          res2End.toISOString(),
          '나노 구조 측정',
          'confirmed'
        );
        console.log('✓ Reservation 2 created (Tomorrow, 10:00-12:00)');
      }

      // Reservation 3: Next week
      const res3Start = new Date(now);
      res3Start.setDate(res3Start.getDate() + 7);
      res3Start.setHours(9, 0, 0, 0);
      const res3End = new Date(res3Start);
      res3End.setHours(11, 0, 0, 0);
      
      if (equipment[2] && users[0]) {
        await Reservation.create(
          equipment[2].id,
          users[0].id,
          res3Start.toISOString(),
          res3End.toISOString(),
          '결정 구조 분석',
          'confirmed'
        );
        console.log('✓ Reservation 3 created (Next week, 09:00-11:00)');
      }
    }

    console.log('\n✅ Database seeding completed successfully!\n');
    console.log('You can now login with:');
    console.log('  Admin: admin@test.com / admin123');
    console.log('  User:  user@test.com / user123\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding database:', error);
    process.exit(1);
  }
};

// Run seed if this file is executed directly
if (require.main === module) {
  seedDatabase();
}

module.exports = { seedDatabase };
