import { pool } from "@/lib/db";
import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";

export async function POST(req) {
  try {
    const { name, email, password } = await req.json();

    if (!name || !email || !password) {
      return NextResponse.json(
        { error: "Missing fields" },
        { status: 400 }
      );
    }

    // Check if user already exists
    const exists = await pool.query(
      `SELECT 1 FROM "user" WHERE email = $1`,
      [email]
    );

    if (exists.rows.length > 0) {
      return NextResponse.json(
        { error: "User already exists" },
        { status: 409 }
      );
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // ✅ CORRECT INSERT (MATCHES YOUR DB)
    await pool.query(
      `INSERT INTO "user" (email, hash_pass, "name")
       VALUES ($1, $2, $3)`,
      [email, hashedPassword, name]
    );

    return NextResponse.json({ success: true });

  } catch (err) {
    console.error("REGISTER ERROR:", err);
    return NextResponse.json(
      { error: "Registration failed" },
      { status: 500 }
    );
  }
}
