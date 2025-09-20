import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User, transaction } from '../models/index.js';
import { logger } from '../middlewares/errorHandler.js';

class AuthService {
  /**
   * Register a new user
   */
  static async register(userData, dbTransaction = null) {
    const { username, email, password, role = 'user' } = userData;

    try {
      const operation = async (t) => {
        // Import Op from sequelize
        const { Op } = await import('sequelize');
        
        // Check if user already exists
        const existingUser = await User.findOne({
          where: {
            [Op.or]: [{ email }, { username }],
          },
          transaction: t,
        });

        if (existingUser) {
          const field = existingUser.email === email ? 'email' : 'username';
          throw new Error(`User with this ${field} already exists`);
        }

        // Validate password strength
        this.validatePassword(password);

        // Create user (password will be hashed by model hook)
        const user = await User.create({
          username,
          email,
          passwordHash: password, // Will be hashed by beforeCreate hook
          role,
        }, { transaction: t });

        logger.info('User registered successfully:', { userId: user.id, username, email });

        return user.toSafeJSON();
      };

      if (dbTransaction) {
        return await operation(dbTransaction);
      } else {
        return await transaction(operation);
      }
    } catch (error) {
      logger.error('Registration failed:', { username, email, error: error.message });
      throw error;
    }
  }

  /**
   * Login user
   */
  static async login(credentials) {
    const { identifier, password, rememberMe = false } = credentials; // identifier can be email or username

    try {
      // Find user by email or username
        // Import Op from sequelize
        const { Op } = await import('sequelize');
        
        const user = await User.findOne({
          where: {
            [Op.or]: [
              { email: identifier },
              { username: identifier },
            ],
          },
        });      if (!user) {
        throw new Error('Invalid credentials');
      }

      // Verify password
      const isPasswordValid = await user.verifyPassword(password);
      if (!isPasswordValid) {
        throw new Error('Invalid credentials');
      }

      // Generate JWT token with appropriate expiration
      const token = user.generateAuthToken(rememberMe);

      logger.info('User logged in successfully:', { 
        userId: user.id, 
        username: user.username,
        rememberMe 
      });

      return {
        token,
        user: user.toSafeJSON(),
      };
    } catch (error) {
      logger.error('Login failed:', { identifier, error: error.message });
      throw error;
    }
  }

  /**
   * Refresh token
   */
  static async refreshToken(token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET, { ignoreExpiration: true });
      
      const user = await User.findByPk(decoded.id);
      if (!user) {
        throw new Error('User not found');
      }

      // Generate new token
      const newToken = user.generateAuthToken();

      return {
        token: newToken,
        user: user.toSafeJSON(),
      };
    } catch (error) {
      logger.error('Token refresh failed:', { error: error.message });
      throw new Error('Invalid token');
    }
  }

  /**
   * Change password
   */
  static async changePassword(userId, currentPassword, newPassword, dbTransaction = null) {
    try {
      const operation = async (t) => {
        const user = await User.findByPk(userId, { transaction: t });
        if (!user) {
          throw new Error('User not found');
        }

        // Verify current password
        const isCurrentPasswordValid = await user.verifyPassword(currentPassword);
        if (!isCurrentPasswordValid) {
          throw new Error('Current password is incorrect');
        }

        // Validate new password
        this.validatePassword(newPassword);

        // Update password
        await user.updateSafe({ passwordHash: newPassword }, { transaction: t });

        logger.info('Password changed successfully:', { userId });

        return { success: true, message: 'Password changed successfully' };
      };

      if (dbTransaction) {
        return await operation(dbTransaction);
      } else {
        return await transaction(operation);
      }
    } catch (error) {
      logger.error('Password change failed:', { userId, error: error.message });
      throw error;
    }
  }

  /**
   * Update user profile
   */
  static async updateProfile(userId, updates, dbTransaction = null) {
    const allowedUpdates = ['username', 'email'];
    const sanitizedUpdates = {};

    // Filter allowed updates
    Object.keys(updates).forEach(key => {
      if (allowedUpdates.includes(key)) {
        sanitizedUpdates[key] = updates[key];
      }
    });

    if (Object.keys(sanitizedUpdates).length === 0) {
      throw new Error('No valid fields to update');
    }

    try {
      const operation = async (t) => {
        // Check for duplicate username/email if being updated
        if (sanitizedUpdates.username || sanitizedUpdates.email) {
          const whereClause = { id: { [Op.ne]: userId } };
          const orConditions = [];

          if (sanitizedUpdates.username) {
            orConditions.push({ username: sanitizedUpdates.username });
          }
          if (sanitizedUpdates.email) {
            orConditions.push({ email: sanitizedUpdates.email });
          }

          whereClause[Op.or] = orConditions;

          const existingUser = await User.findOne({
            where: whereClause,
            transaction: t,
          });

          if (existingUser) {
            const field = existingUser.username === sanitizedUpdates.username ? 'username' : 'email';
            throw new Error(`This ${field} is already taken`);
          }
        }

        // Update user
        const user = await User.findByPk(userId, { transaction: t });
        if (!user) {
          throw new Error('User not found');
        }

        await user.updateSafe(sanitizedUpdates, { transaction: t });
        await user.reload({ transaction: t });

        logger.info('User profile updated:', { userId, updates: Object.keys(sanitizedUpdates) });

        return user.toSafeJSON();
      };

      if (dbTransaction) {
        return await operation(dbTransaction);
      } else {
        return await transaction(operation);
      }
    } catch (error) {
      logger.error('Profile update failed:', { userId, error: error.message });
      throw error;
    }
  }

  /**
   * Delete user account
   */
  static async deleteAccount(userId, password, dbTransaction = null) {
    try {
      const operation = async (t) => {
        const user = await User.findByPk(userId, { transaction: t });
        if (!user) {
          throw new Error('User not found');
        }

        // Verify password before deletion
        const isPasswordValid = await user.verifyPassword(password);
        if (!isPasswordValid) {
          throw new Error('Password is incorrect');
        }

        // Delete user (cascading deletes will handle related records)
        await user.destroy({ transaction: t });

        logger.info('User account deleted:', { userId, username: user.username });

        return { success: true, message: 'Account deleted successfully' };
      };

      if (dbTransaction) {
        return await operation(dbTransaction);
      } else {
        return await transaction(operation);
      }
    } catch (error) {
      logger.error('Account deletion failed:', { userId, error: error.message });
      throw error;
    }
  }

  /**
   * Set/Update user's OpenAI API key
   */
  static async setOpenAIKey(userId, apiKey, dbTransaction = null) {
    try {
      const operation = async (t) => {
        const user = await User.findByPk(userId, { transaction: t });
        if (!user) {
          throw new Error('User not found');
        }

        // Validate API key format (basic check)
        if (apiKey && !apiKey.startsWith('sk-')) {
          throw new Error('Invalid OpenAI API key format');
        }

        await user.setOpenAIKey(apiKey, true); // true = encrypt the key

        logger.info('OpenAI API key updated:', { userId });

        return { success: true, message: 'OpenAI API key updated successfully' };
      };

      if (dbTransaction) {
        return await operation(dbTransaction);
      } else {
        return await transaction(operation);
      }
    } catch (error) {
      logger.error('OpenAI key update failed:', { userId, error: error.message });
      throw error;
    }
  }

  /**
   * Get user by ID
   */
  static async getUserById(userId) {
    try {
      const user = await User.findByPk(userId);
      if (!user) {
        throw new Error('User not found');
      }

      return user.toSafeJSON();
    } catch (error) {
      logger.error('Get user failed:', { userId, error: error.message });
      throw error;
    }
  }

  /**
   * Search users (admin only)
   */
  static async searchUsers(query, limit = 20, offset = 0) {
    try {
      const { Op } = await import('sequelize');
      const users = await User.findAndCountAll({
        where: {
          [Op.or]: [
            { username: { [Op.iLike]: `%${query}%` } },
            { email: { [Op.iLike]: `%${query}%` } },
          ],
        },
        limit,
        offset,
        order: [['createdAt', 'DESC']],
      });

      return {
        users: users.rows.map(user => user.toSafeJSON()),
        total: users.count,
      };
    } catch (error) {
      logger.error('User search failed:', { query, error: error.message });
      throw error;
    }
  }

  /**
   * Validate password strength
   */
  static validatePassword(password) {
    if (!password || password.length < 8) {
      throw new Error('Password must be at least 8 characters long');
    }

    if (!/(?=.*[a-z])/.test(password)) {
      throw new Error('Password must contain at least one lowercase letter');
    }

    if (!/(?=.*[A-Z])/.test(password)) {
      throw new Error('Password must contain at least one uppercase letter');
    }

    if (!/(?=.*\d)/.test(password)) {
      throw new Error('Password must contain at least one number');
    }

    if (!/(?=.*[@$!%*?&])/.test(password)) {
      throw new Error('Password must contain at least one special character (@$!%*?&)');
    }
  }

  /**
   * Verify JWT token
   */
  static async verifyToken(token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findByPk(decoded.id);
      
      if (!user) {
        throw new Error('User not found');
      }

      return user.toSafeJSON();
    } catch (error) {
      logger.error('Token verification failed:', { error: error.message });
      throw new Error('Invalid token');
    }
  }
}

export default AuthService;