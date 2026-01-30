const bcrypt = require('bcryptjs');
const { query, run, get } = require('../config/database');

class User {
  // Create new user with extended fields
  static async create(username, email, password, role = 'user', department = null, phone = null, userRole = 'staff', supervisor = null) {
    const hashedPassword = await bcrypt.hash(password, 10);
    const sql = `
      INSERT INTO users (username, email, password_hash, role, department, phone, user_role, supervisor)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id
    `;
    const result = await get(sql, [username, email, hashedPassword, role, department, phone, userRole, supervisor]);
    return result.id;
  }

  // Find user by email
  static async findByEmail(email) {
    const sql = 'SELECT * FROM users WHERE email = $1';
    return await get(sql, [email]);
  }

  // Find user by username
  static async findByUsername(username) {
    const sql = 'SELECT * FROM users WHERE username = $1';
    return await get(sql, [username]);
  }

  // Find user by ID
  static async findById(id) {
    const sql = 'SELECT id, username, email, role, department, phone, user_role, supervisor, created_at FROM users WHERE id = $1';
    return await get(sql, [id]);
  }

  // Verify password
  static async verifyPassword(plainPassword, hashedPassword) {
    return await bcrypt.compare(plainPassword, hashedPassword);
  }

  // Get all users (admin only)
  static async getAll() {
    const sql = 'SELECT id, username, email, role, department, phone, user_role, supervisor, created_at FROM users ORDER BY created_at DESC';
    return await query(sql);
  }

  // Update user role (legacy)
  static async updateRole(userId, role) {
    const sql = 'UPDATE users SET role = $1 WHERE id = $2';
    return await run(sql, [role, userId]);
  }

  // Update user role (new system)
  static async updateUserRole(userId, userRole) {
    const sql = 'UPDATE users SET user_role = $1 WHERE id = $2';
    return await run(sql, [userRole, userId]);
  }

  // Update user profile
  static async updateProfile(userId, department, phone, userRole, supervisor) {
    const sql = `
      UPDATE users SET department = $1, phone = $2, user_role = $3, supervisor = $4
      WHERE id = $5
    `;
    return await run(sql, [department, phone, userRole, supervisor, userId]);
  }

  // Delete user
  static async delete(userId) {
    const sql = 'DELETE FROM users WHERE id = $1';
    return await run(sql, [userId]);
  }

  // Check if user can manage equipment (장비담당자 or 관리자)
  static isManager(userRole) {
    return ['equipment_manager', 'admin'].includes(userRole);
  }

  // Check if user needs permission to book
  static needsPermission(userRole) {
    return ['intern', 'student', 'staff'].includes(userRole);
  }
}

module.exports = User;

