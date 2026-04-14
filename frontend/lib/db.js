import pkg from "pg";
const { Pool } = pkg;

export const pool = new Pool({
  host:     process.env.DB_HOST     || "db",
  user:     process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  port:     Number(process.env.DB_PORT) || 5432,
});
