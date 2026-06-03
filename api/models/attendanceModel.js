const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Attendance = sequelize.define(
  'Attendance',
  {
    attendance_id: {
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
      allowNull: false,
      references: { model: 'Employees', key: 'employee_id' },
      onDelete: 'CASCADE',
    },
    logged_date: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    signed_in_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    signed_out_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM('present', 'late', 'leave', 'absent'),
      allowNull: false,
      defaultValue: 'present',
    },
  },
  {
    tableName: 'Attendance',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      { unique: true, fields: ['employee_id', 'logged_date'], name: 'attendance_employee_date_uniq' },
    ],
  },
);

module.exports = Attendance;
