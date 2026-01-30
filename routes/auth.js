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

module.exports = router;
