const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Subtask = sequelize.define(
  'Subtask',
  {
    subtask_id: {
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
    task_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: 'tasks', key: 'task_id' },
      onDelete: 'CASCADE',
    },
    assigned_to: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: 'Employees', key: 'employee_id' },
      onDelete: 'SET NULL',
    },
    title: { type: DataTypes.STRING, allowNull: false },
    description: { type: DataTypes.TEXT, allowNull: true },
    status: {
      type: DataTypes.ENUM('pending', 'in_progress', 'completed'),
      defaultValue: 'pending',
      allowNull: false,
    },
    position: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    deadline: { type: DataTypes.DATE, allowNull: true },
  },
  {
    tableName: 'subtasks',
    timestamps: true,
  },
);

module.exports = Subtask;
