const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Company = sequelize.define(
  'Company',
  {
    company_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    slug: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      validate: {
        is: /^[a-z0-9-]+$/,
        len: [2, 64],
      },
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      validate: { isEmail: true },
    },
    address: { type: DataTypes.STRING, allowNull: true },
    website: { type: DataTypes.STRING, allowNull: true },
    phone: { type: DataTypes.STRING, allowNull: true },
    workingDays: { type: DataTypes.STRING, allowNull: true },
    workingHours: { type: DataTypes.STRING, allowNull: true },
    foundedDate: { type: DataTypes.DATE, allowNull: true },
    industry: { type: DataTypes.STRING, allowNull: true },
    companySize: { type: DataTypes.STRING, allowNull: true },
  },
  {
    tableName: 'companies',
    timestamps: true,
  },
);

module.exports = Company;
