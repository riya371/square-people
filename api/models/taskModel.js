const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Task = sequelize.define(
  'Task',
  {
    task_id: {
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
    code: {
      type: DataTypes.STRING,
      allowNull: true, // auto-assigned by controller in Plan 3 (e.g. "#142")
    },
    title: { type: DataTypes.STRING, allowNull: false },
    description: { type: DataTypes.TEXT, allowNull: true },
    project_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: 'Projects', key: 'project_id' },
      onDelete: 'CASCADE',
    },
    assigned_to: {
      type: DataTypes.INTEGER,
      allowNull: true, // unassigned tasks are valid (e.g. in a backlog)
      references: { model: 'Employees', key: 'employee_id' },
      onDelete: 'SET NULL',
    },
    priority: {
      type: DataTypes.ENUM('low', 'medium', 'high'),
      defaultValue: 'medium',
      allowNull: false,
    },
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
  },
  {
    tableName: 'tasks',
    timestamps: true,
    indexes: [
      { unique: true, fields: ['company_id', 'code'], name: 'tasks_company_code_uniq', where: { code: { [require('sequelize').Op.ne]: null } } },
      { fields: ['project_id', 'status', 'position'], name: 'tasks_kanban_order_idx' },
    ],
  },
);

module.exports = Task;
