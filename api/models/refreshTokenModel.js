const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const RefreshToken = sequelize.define(
  'RefreshToken',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: 'users', key: 'id' },
      onDelete: 'CASCADE',
    },
    token_hash: { type: DataTypes.STRING, allowNull: false, unique: true },
    expires_at: { type: DataTypes.DATE, allowNull: false },
    revoked_at: { type: DataTypes.DATE, allowNull: true },
    ip: { type: DataTypes.STRING, allowNull: true },
    ua: { type: DataTypes.STRING, allowNull: true },
  },
  {
    tableName: 'refresh_tokens',
    timestamps: true,
    indexes: [{ fields: ['user_id'], name: 'refresh_tokens_user_idx' }],
  },
);

module.exports = RefreshToken;
