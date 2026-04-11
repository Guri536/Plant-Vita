import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";

// Internal Docker network URL (server-side only – never exposed to the browser)
const BACKEND_URL = process.env.BACKEND_URL || "http://backend:8000";

export const authOptions = {
  providers: [
    // ── Email / Password ────────────────────────────────────────────────────
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        try {
          // FastAPI expects OAuth2PasswordRequestForm (form-encoded, field "username")
          const form = new URLSearchParams();
          form.append("username", credentials.email);
          form.append("password", credentials.password);

          const res = await fetch(`${BACKEND_URL}/token`, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: form.toString(),
          });

          if (!res.ok) return null;

          const { access_token, refresh_token } = await res.json();

          return {
            id: credentials.email,
            email: credentials.email,
            // Derive a display name from the email prefix
            name: credentials.email.split("@")[0],
            accessToken: access_token,
            refreshToken: refresh_token,
          };
        } catch (err) {
          console.error("[NextAuth] Credentials authorize error:", err);
          return null;
        }
      },
    }),

    // ── Google OAuth ─────────────────────────────────────────────────────────
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
    }),
  ],

  callbacks: {
    // Called every time a JWT is created or updated.
    async jwt({ token, user, account }) {
      // ── Initial credentials sign-in ──────────────────────────────────────
      if (account?.provider === "credentials" && user) {
        token.accessToken = user.accessToken;
        token.refreshToken = user.refreshToken;
        token.name = user.name;
      }

      // ── Initial Google sign-in: exchange Google identity for FastAPI JWT ──
      if (account?.provider === "google" && token.email) {
        try {
          const res = await fetch(`${BACKEND_URL}/social-login`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              // API_SECRET_KEY must match the backend env var
              "x-api-key": process.env.API_SECRET_KEY || "",
            },
            body: JSON.stringify({ email: token.email }),
          });

          if (res.ok) {
            const { access_token, refresh_token } = await res.json();
            token.accessToken = access_token;
            token.refreshToken = refresh_token;
          } else {
            console.error("[NextAuth] social-login failed:", await res.text());
          }
        } catch (err) {
          console.error("[NextAuth] social-login error:", err);
        }
      }

      return token;
    },

    // Expose only what client code needs; never put refresh tokens here.
    async session({ session, token }) {
      session.accessToken = token.accessToken;
      // Keep Google's display name if present, else fall back to derived name
      session.user.name = session.user.name || token.name;
      return session;
    },
  },

  pages: { signIn: "/" },
  session: { strategy: "jwt" },
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };