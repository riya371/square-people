const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Employee = sequelize.define(
  'Employee',
  {
    employee_id: {
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
    department_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: 'departments', key: 'department_id' },
      onDelete: 'SET NULL',
    },
    manager_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: 'Employees', key: 'employee_id' },
      onDelete: 'SET NULL',
    },
    employee_code: {
      type: DataTypes.STRING,
      allowNull: true, // assigned on hire; nullable for now so existing rows survive sync
    },
    name: { type: DataTypes.STRING, allowNull: false },
    email: { type: DataTypes.STRING, allowNull: false },
    phone: { type: DataTypes.STRING, allowNull: true },
    dob: { type: DataTypes.DATEONLY, allowNull: true },
    hire_date: { type: DataTypes.DATEONLY, allowNull: true },
    termination_date: { type: DataTypes.DATEONLY, allowNull: true },
    status: {
      type: DataTypes.ENUM('active', 'inactive', 'terminated'),
      defaultValue: 'active',
      allowNull: false,
    },
  },
  {
    tableName: 'Employees',
    timestamps: true,
    indexes: [
      { unique: true, fields: ['company_id', 'email'], name: 'employees_company_email_uniq' },
      { unique: true, fields: ['company_id', 'employee_code'], name: 'employees_company_code_uniq', where: { employee_code: { [require('sequelize').Op.ne]: null } } },
    ],
  },
);

module.exports = Employee;
