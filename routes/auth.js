const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();

// Register new user
router.post('/register', async (req, res) => {
  try {
    const { username, email, password, department, phone, userRole, supervisor } = req.body;

    // Validation
    if (!username || !email || !password) {
      return res.status(400).json({ error: '이름, 이메일, 비밀번호는 필수입니다.' });
    }

    if (!department) {
      return res.status(400).json({ error: '소속을 선택해주세요.' });
    }

    if (!phone) {
      return res.status(400).json({ error: '연락처를 입력해주세요.' });
    }

    if (!userRole) {
      return res.status(400).json({ error: '신분을 선택해주세요.' });
    }

    // Validate user role
    const validRoles = ['intern', 'student', 'staff', 'equipment_manager', 'admin'];
    if (!validRoles.includes(userRole)) {
      return res.status(400).json({ error: '유효하지 않은 신분입니다.' });
    }

    // Intern and student must have supervisor
    if (['intern', 'student'].includes(userRole) && !supervisor) {
      return res.status(400).json({ error: '인턴/학생연구원은 연수책임자를 입력해야 합니다.' });
    }

    // Check if user already exists
    const existingUser = await User.findByEmail(email);
    if (existingUser) {
      return res.status(400).json({ error: '이미 등록된 이메일입니다.' });
    }

    const existingUsername = await User.findByUsername(username);
    if (existingUsername) {
      return res.status(400).json({ error: '이미 사용 중인 이름입니다.' });
    }

    // Set legacy role based on new userRole
    const legacyRole = ['equipment_manager', 'admin'].includes(userRole) ? 'admin' : 'user';

    const userId = await User.create(
      username, email, password, legacyRole,
      department, phone, userRole, supervisor || null
    );

    res.status(201).json({
      message: '회원가입이 완료되었습니다.',
      userId
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: '회원가입에 실패했습니다.' });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validation
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Find user
    const user = await User.findByEmail(email);
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Verify password
    const isValid = await User.verifyPassword(password, user.password_hash);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate JWT token with extended fields
    const token = jwt.sign(
      {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        user_role: user.user_role,
        department: user.department
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );

    res.json({
      message: '로그인 성공',
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        user_role: user.user_role,
        department: user.department,
        phone: user.phone,
        supervisor: user.supervisor
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Get current user info
router.get('/me', verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to get user info' });
  }
});

// Get all users (admin only)
router.get('/users', verifyToken, async (req, res) => {
  try {
    // Check if admin
    if (req.user.user_role !== 'admin') {
      return res.status(403).json({ error: 'Admin only' });
    }
    const { query } = require('../config/database');
    const users = await query('SELECT id, username, email, department, phone, user_role, supervisor FROM users ORDER BY id');
    res.json(users);
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Failed to get users' });
  }
});

// Get single user (admin only)
router.get('/users/:id', verifyToken, async (req, res) => {
  try {
    if (req.user.user_role !== 'admin') {
      return res.status(403).json({ error: 'Admin only' });
    }
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to get user' });
  }
});

// Update user (admin only)
router.put('/users/:id', verifyToken, async (req, res) => {
  try {
    if (req.user.user_role !== 'admin') {
      return res.status(403).json({ error: 'Admin only' });
    }

    const { username, email, department, phone, userRole, supervisor } = req.body;
    const { run } = require('../config/database');

    await run(`
      UPDATE users 
      SET username = $1, email = $2, department = $3, phone = $4, user_role = $5, supervisor = $6
      WHERE id = $7
    `, [username, email, department, phone, userRole, supervisor || null, req.params.id]);

    res.json({ message: '사용자 정보가 수정되었습니다.' });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ error: '사용자 수정에 실패했습니다.' });
  }
});

// Delete user (admin only)
router.delete('/users/:id', verifyToken, async (req, res) => {
  try {
    if (req.user.user_role !== 'admin') {
      return res.status(403).json({ error: 'Admin only' });
    }

    // Prevent self-deletion
    if (req.params.id == req.user.id) {
      return res.status(400).json({ error: '자기 자신은 삭제할 수 없습니다.' });
    }

    const { run } = require('../config/database');
    const userId = req.params.id;

    // Delete related permissions first
    await run('DELETE FROM equipment_permissions WHERE user_id = $1', [userId]);

    // Remove as equipment manager (set to NULL)
    await run('UPDATE equipment SET manager_id = NULL WHERE manager_id = $1', [userId]);

    // Delete related reservations (or keep for history - here we delete)
    await run('DELETE FROM reservations WHERE user_id = $1', [userId]);

    // Delete related equipment logs
    await run('DELETE FROM equipment_logs WHERE user_id = $1', [userId]);

    // Delete user
    await run('DELETE FROM users WHERE id = $1', [userId]);

    res.json({ message: '사용자가 삭제되었습니다.' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: '사용자 삭제에 실패했습니다: ' + error.message });
  }
});

module.exports = router;

