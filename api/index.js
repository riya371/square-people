const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const pinoHttp = require('pino-http');

const env = require('./config/env');
const sequelize = require('./config/database');

// Require every model file so Sequelize registers all models before sync().
require('./models/companyModel');
require('./models/departmentModel');
require('./models/employeeModel');
require('./models/roleModel');
require('./models/teamModel');
require('./models/teamMemberModel');
require('./models/projectModel');
require('./models/taskModel');
require('./models/subtaskModel');
require('./models/worktrackingModel');
require('./models/attendanceModel');
require('./models/leaverequestModel');
require('./models/leaveapprovalModel');
require('./models/userModel');
require('./models/refreshTokenModel');
require('./models/passwordResetTokenModel');
require('./models/inviteModel');
require('./models/auditLogModel');

// Wire associations after every model is registered.
require('./association');

// Routes
const authRoutes = require('./routes/authRoutes');
const meRoutes = require('./routes/meRoutes');
const companyRoutes = require('./routes/companyRoutes');
const departmentRoutes = require('./routes/departmentRoutes');
const employeeRoutes = require('./routes/employeeRoutes');
const roleRoutes = require('./routes/roleRoutes');
const teamRoutes = require('./routes/teamRoutes');
const projectRoutes = require('./routes/projectRoutes');
const taskRoutes = require('./routes/taskRoutes');
const subtaskRoute = require('./routes/subtaskRoute');
const worktrackingRoutes = require('./routes/worktrackingRoutes');
const attendanceRoutes = require('./routes/attendanceRoutes');
const leaverequestRoutes = require('./routes/leaverequestRoutes');
const auditRoutes = require('./routes/auditRoutes');
const dashboardRoutes = require('./routes/statsRoutes');
const inviteRoutes = require('./routes/inviteRoutes');

const errorHandler = require('./middleware/errorHandler');

const app = express();

app.use(helmet());
app.use(cors({ origin: env.FRONTEND_URL, credentials: true }));
app.use(cookieParser());
app.use(express.json());
app.use(pinoHttp({
  level: env.NODE_ENV === 'development' ? 'info' : 'warn',
  redact: ['req.headers.cookie', 'req.headers.authorization'],
}));

// Health check (handy for smoke testing)
app.get('/health', (_req, res) => res.json({ ok: true, ts: new Date().toISOString() }));

// API routes (auth + me + dashboard arrive in later plans)
app.use('/api/auth', authRoutes);
app.use('/api/me', meRoutes);
app.use('/api/companies', companyRoutes);
app.use('/api/departments', departmentRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/roles', roleRoutes);
app.use('/api/teams', teamRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/time', worktrackingRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/leaves', leaverequestRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/invites', inviteRoutes);
app.use('/api', subtaskRoute);

// 404
app.use((req, res, _next) => {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: `No route for ${req.method} ${req.originalUrl}`, details: null } });
});

// Centralised error handler (must be last)
app.use(errorHandler);

(async () => {
  try {
    await sequelize.authenticate();
    console.log('DB connection OK');
    await sequelize.sync({ alter: true });
    console.log('Models synced');
    app.listen(env.PORT, () => {
      console.log(`Server running on http://localhost:${env.PORT}`);
    });
  } catch (err) {
    console.error('Unable to start server:', err);
    process.exit(1);
  }
})();
