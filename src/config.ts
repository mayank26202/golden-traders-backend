import "dotenv/config";

export const config = {
  port: Number(process.env.PORT || 5000),
  mongoUri: process.env.MONGO_URI || "mongodb://127.0.0.1:27017/chicken_inventory",
  jwtSecret: process.env.JWT_SECRET || "dev-secret-change-me",
  keepAliveUrl: process.env.KEEP_ALIVE_URL || "",
  keepAliveMinutes: Number(process.env.KEEP_ALIVE_MINUTES || 14),
  admin: {
    name: process.env.ADMIN_NAME || "Admin",
    email: process.env.ADMIN_EMAIL || "admin@example.com",
    password: process.env.ADMIN_PASSWORD || "Admin@12345",
  },
};
