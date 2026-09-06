require('dotenv').config();
const app = require('./app');
const connectDB = require('./config/db');

const PORT = process.env.PORT || 5000;

async function start() {
  if (!process.env.JWT_SECRET) {
    console.error('[fatal] JWT_SECRET is not set. Copy .env.example to .env and configure it.');
    process.exit(1);
  }
  await connectDB();
  const server = app.listen(PORT, () => {
    console.log(`[server] listening on port ${PORT} (${process.env.NODE_ENV || 'development'})`);
  });

  // Guard against unhandled rejections crashing the process silently.
  process.on('unhandledRejection', (err) => {
    console.error('[unhandledRejection]', err);
    server.close(() => process.exit(1));
  });
}

start().catch((err) => {
  console.error('[fatal] Failed to start server:', err.message);
  process.exit(1);
});
