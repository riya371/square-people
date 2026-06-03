const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const User = sequelize.define(
  'User',
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
    employee_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: 'Employees', key: 'employee_id' },
      onDelete: 'SET NULL',
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: { isEmail: true },
    },
    password_hash: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    pin_hash: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    role: {
      type: DataTypes.ENUM('owner', 'admin', 'manager', 'member'),
      allowNull: false,
      defaultValue: 'member',
    },
    last_login_at: { type: DataTypes.DATE, allowNull: true },
    last_login_ip: { type: DataTypes.STRING, allowNull: true },
  },
  {
    tableName: 'users',
    timestamps: true,
    indexes: [
      { unique: true, fields: ['company_id', 'email'], name: 'users_company_email_uniq' },
    ],
  },
);

module.exports = User;
