import { Model, DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

class BaseModel extends Model {
  /**
   * Base model with common functionality for all models
   */
  static initModel(name, attributes, options = {}) {
    const defaultAttributes = {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
      updatedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
    };

    const mergedAttributes = { ...defaultAttributes, ...attributes };
    
    const defaultOptions = {
      sequelize,
      modelName: name,
      tableName: name.toLowerCase() + 's',
      timestamps: true,
      underscored: false,
      indexes: [
        {
          fields: ['createdAt'],
        },
      ],
    };

    const mergedOptions = { ...defaultOptions, ...options };
    
    return super.init(mergedAttributes, mergedOptions);
  }

  /**
   * Get a record by ID with error handling
   */
  static async findByIdOrFail(id, options = {}) {
    const record = await this.findByPk(id, options);
    if (!record) {
      throw new Error(`${this.name} with ID ${id} not found`);
    }
    return record;
  }

  /**
   * Create multiple records with transaction support
   */
  static async bulkCreateSafe(records, options = {}) {
    try {
      return await this.bulkCreate(records, {
        validate: true,
        individualHooks: true,
        ...options,
      });
    } catch (error) {
      throw new Error(`Failed to create ${this.name} records: ${error.message}`);
    }
  }

  /**
   * Update record with validation
   */
  async updateSafe(values, options = {}) {
    try {
      return await this.update(values, {
        validate: true,
        individualHooks: true,
        ...options,
      });
    } catch (error) {
      throw new Error(`Failed to update ${this.constructor.name}: ${error.message}`);
    }
  }

  /**
   * Soft delete functionality
   */
  async softDelete(options = {}) {
    if (this.constructor.rawAttributes.deletedAt) {
      return await this.update({ deletedAt: new Date() }, options);
    }
    throw new Error(`${this.constructor.name} does not support soft delete`);
  }

  /**
   * Check if record is soft deleted
   */
  get isDeleted() {
    return this.deletedAt !== null;
  }

  /**
   * Convert model to JSON with selected fields
   */
  toSafeJSON(excludeFields = ['password', 'passwordHash']) {
    const json = this.toJSON();
    excludeFields.forEach(field => delete json[field]);
    return json;
  }
}

export default BaseModel;