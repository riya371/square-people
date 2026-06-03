const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const WorkTracking = sequelize.define(
  'WorkTracking',
  {
    log_id: {
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
    task_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: 'tasks', key: 'task_id' },
      onDelete: 'SET NULL',
    },
    subtask_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: 'subtasks', key: 'subtask_id' },
      onDelete: 'SET NULL',
    },
    start_time: { type: DataTypes.DATE, allowNull: false },
    end_time: { type: DataTypes.DATE, allowNull: true },
    duration_minutes: { type: DataTypes.INTEGER, allowNull: true },
    logged_date: { type: DataTypes.DATEONLY, allowNull: false },
  },
  {
    tableName: 'workTracking',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false,
  },
);

module.exports = WorkTracking;
