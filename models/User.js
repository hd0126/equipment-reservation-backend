const bcrypt = require('bcryptjs');
const { query, run, get } = require('../config/database');

class User {
  // Create new user
  static async create(username, email, password, role = 'user') {
    const hashedPassword = await bcrypt.hash(password, 10);
    const sql = `
      INSERT INTO users (username, email, password_hash, role)
      VALUES (?, ?, ?, ?)
    `;
    const result = await run(sql, [username, email, hashedPassword, role]);
    return result.id;
  }

  // Find user by email
  static async findByEmail(email) {
    const sql = 'SELECT * FROM users WHERE email = ?';
    return await get(sql, [email]);
  }

  // Find user by username
  static async findByUsername(username) {
    const sql = 'SELECT * FROM users WHERE username = ?';
    return await get(sql, [username]);
  }

  // Find user by ID
  static async findById(id) {
    const sql = 'SELECT id, username, email, role, created_at FROM users WHERE id = ?';
    return await get(sql, [id]);
  }

  // Verify password
  static async verifyPassword(plainPassword, hashedPassword) {
    return await bcrypt.compare(plainPassword, hashedPassword);
  }

  // Get all users (admin only)
  static async getAll() {
    const sql = 'SELECT id, username, email, role, created_at FROM users ORDER BY created_at DESC';
    return await query(sql);
  }

  // Update user role
  static async updateRole(userId, role) {
    const sql = 'UPDATE users SET role = ? WHERE id = ?';
    return await run(sql, [role, userId]);
  }

  // Delete user
  static async delete(userId) {
    const sql = 'DELETE FROM users WHERE id = ?';
    return await run(sql, [userId]);
  }
}

module.exports = User;
