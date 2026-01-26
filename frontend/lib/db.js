import pkg from "pg";
const { Pool } = pkg;

export const pool = new Pool({
  host: "db",          // docker service name
  user: "user",
  password: "plantvita",
  database: "plantvita_db",
  port: 5432,
}); 
