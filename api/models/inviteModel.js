const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Invite = sequelize.define(
  'Invite',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    company_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: 'companies', key: 'company_id' },
      onDelete: 'CASCADE',
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: { isEmail: true },
    },
    role: {
      type: DataTypes.ENUM('owner', 'admin', 'manager', 'member'),
      allowNull: false,
      defaultValue: 'member',
    },
    employee_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: 'Employees', key: 'employee_id' },
      onDelete: 'SET NULL',
    },
    token_hash: { type: DataTypes.STRING, allowNull: false, unique: true },
    expires_at: { type: DataTypes.DATE, allowNull: false },
    accepted_at: { type: DataTypes.DATE, allowNull: true },
    created_by_user_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: 'users', key: 'id' },
      onDelete: 'SET NULL',
    },
  },
  {
    tableName: 'invites',
    timestamps: true,
    indexes: [{ fields: ['company_id', 'email'], name: 'invites_company_email_idx' }],
  },
);

module.exports = Invite;
