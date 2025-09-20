import { DataTypes } from 'sequelize';
import BaseModel from './BaseModel.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

class User extends BaseModel {
  /**
   * Hash password before saving
   */
  static async hashPassword(password) {
    const saltRounds = 12;
    return await bcrypt.hash(password, saltRounds);
  }

  /**
   * Verify password
   */
  async verifyPassword(password) {
    return await bcrypt.compare(password, this.passwordHash);
  }

  /**
   * Generate JWT token
   */
  generateAuthToken(rememberMe = false) {
    const expiresIn = rememberMe ? '30d' : (process.env.JWT_EXPIRES_IN || '24h');
    
    return jwt.sign(
      {
        id: this.id,
        username: this.username,
        email: this.email,
        role: this.role,
      },
      process.env.JWT_SECRET,
      {
        expiresIn,
      }
    );
  }

  /**
   * Find user by email or username
   */
  static async findByEmailOrUsername(identifier) {
    return await this.findOne({
      where: {
        $or: [
          { email: identifier },
          { username: identifier },
        ],
      },
    });
  }

  /**
   * Get user's subscriptions with feeds
   */
  async getSubscriptionsWithFeeds() {
    const { Subscription, Feed } = await import('./index.js');
    return await Subscription.findAll({
      where: { userId: this.id },
      include: [
        {
          model: Feed,
          as: 'feed',
        },
      ],
    });
  }

  /**
   * Check if user has admin role
   */
  get isAdmin() {
    return this.role === 'admin';
  }

  /**
   * Get safe user data for API responses
   */
  toSafeJSON() {
    return super.toSafeJSON(['passwordHash', 'openaiKey']);
  }

  /**
   * Instance method to update OpenAI key (encrypted)
   */
  async setOpenAIKey(key, encrypt = true) {
    if (encrypt && key) {
      const crypto = await import('node:crypto');
      const algorithm = 'aes-256-cbc';
      const secretKey = process.env.ENCRYPTION_KEY;
      
      if (!secretKey || secretKey.length !== 32) {
        throw new Error('ENCRYPTION_KEY must be exactly 32 characters long');
      }
      
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipheriv(algorithm, secretKey, iv);
      let encrypted = cipher.update(key, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      this.openaiKey = `${iv.toString('hex')}:${encrypted}`;
    } else {
      this.openaiKey = key;
    }
    
    await this.save();
  }

  /**
   * Decrypt OpenAI key
   */
  async getDecryptedOpenAIKey() {
    if (!this.openaiKey || !this.openaiKey.includes(':')) {
      return this.openaiKey;
    }

    try {
      const crypto = await import('node:crypto');
      const algorithm = 'aes-256-cbc';
      const secretKey = process.env.ENCRYPTION_KEY;
      
      if (!secretKey || secretKey.length !== 32) {
        throw new Error('ENCRYPTION_KEY must be exactly 32 characters long');
      }
      
      const [ivHex, encryptedHex] = this.openaiKey.split(':');
      const iv = Buffer.from(ivHex, 'hex');
      
      const decipher = crypto.createDecipheriv(algorithm, secretKey, iv);
      let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
      console.error('Failed to decrypt OpenAI key:', error);
      return null;
    }
  }
}

// Initialize the User model
User.initModel('User', {
  username: {
    type: DataTypes.STRING(50),
    allowNull: false,
    validate: {
      len: [3, 50],
      isAlphanumeric: true,
    },
  },
  email: {
    type: DataTypes.STRING(255),
    allowNull: false,
    validate: {
      isEmail: true,
    },
  },
  passwordHash: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  role: {
    type: DataTypes.ENUM('user', 'admin'),
    defaultValue: 'user',
    allowNull: false,
  },
  openaiKey: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Encrypted user-specific OpenAI API key',
  },
}, {
  indexes: [
    {
      unique: true,
      fields: ['email'],
    },
    {
      unique: true,
      fields: ['username'],
    },
  ],
  hooks: {
    beforeCreate: async (user) => {
      if (user.passwordHash && !user.passwordHash.startsWith('$2a$')) {
        user.passwordHash = await User.hashPassword(user.passwordHash);
      }
    },
    beforeUpdate: async (user) => {
      if (user.changed('passwordHash') && !user.passwordHash.startsWith('$2a$')) {
        user.passwordHash = await User.hashPassword(user.passwordHash);
      }
    },
  },
});

export default User;