import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { pool } from "@/lib/db";

const handler = NextAuth({
  debug: true,
  trustHost: true,

  providers: [
    // 🔵 GOOGLE LOGIN
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),

    // 🔐 EMAIL + PASSWORD LOGIN
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },

      async authorize(credentials) {
        const { email, password } = credentials;

        const client = await pool.connect();
        try {
          const result = await client.query(
            `SELECT id, email, hash_pass, name
             FROM "user"
             WHERE email = $1`,
            [email]
          );

          if (result.rows.length === 0) {
            throw new Error("User not found");
          }

          const user = result.rows[0];

          const isValid = await bcrypt.compare(
            password,
            user.hash_pass
          );

          if (!isValid) {
            throw new Error("Invalid password");
          }

          // ✅ This becomes session.user
          return {
            id: user.id,
            name: user.name,
            email: user.email,
          };
        } finally {
          client.release();
        }
      },
    }),
  ],

  session: {
    strategy: "jwt",
  },

  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.name = user.name;
      }
      return token;
    },

    async session({ session, token }) {
      session.user.id = token.id;
      session.user.name = token.name;
      return session;
    },
  },

  secret: process.env.NEXTAUTH_SECRET,
});

export { handler as GET, handler as POST };
