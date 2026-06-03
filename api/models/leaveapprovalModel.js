const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const LeaveApproval = sequelize.define(
  'LeaveApproval',
  {
    leave_approval_id: {
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
    leave_request_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: 'LeaveRequest', key: 'leave_id' },
      onDelete: 'CASCADE',
    },
    approver_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: 'Employees', key: 'employee_id' },
      onDelete: 'CASCADE',
    },
    decision: {
      type: DataTypes.ENUM('approved', 'rejected'),
      allowNull: false,
    },
    reason: { type: DataTypes.TEXT, allowNull: true },
    decided_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  },
  {
    tableName: 'leaveapprovals',
    timestamps: true,
  },
);

module.exports = LeaveApproval;
