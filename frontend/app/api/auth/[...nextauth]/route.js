// app/api/auth/[...nextauth]/route.js
import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";

const API_URL = process.env.NEXT_PUBLIC_API_URL;
const API_SECRET_KEY = process.env.API_SECRET_KEY;

/**
 * Helper function to refresh the token when it expires.
 */
async function refreshAccessToken(token) {
  try {
    const response = await fetch(`${API_URL}/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        refresh_token: token.refreshToken,
      }),
    });

    const refreshedTokens = await response.json();

    if (!response.ok) {
      throw refreshedTokens;
    }

    return {
      ...token,
      accessToken: refreshedTokens.access_token,
      accessTokenExpires: Date.now() + 15 * 60 * 1000, // Reset to 15 minutes
      refreshToken: refreshedTokens.refresh_token ?? token.refreshToken, // Fallback if new one wasn't sent
    };
  } catch (error) {
    console.error("RefreshAccessTokenError", error);
    return {
      ...token,
      error: "RefreshAccessTokenError", // This tells the client to force sign-out
    };
  }
}

const handler = NextAuth({
  providers: [
    // 1. Google Login
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),

    // 2. Manual Email/Password Login
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        username: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        console.log("CONNECTING TO:", `${API_URL}/token`);
        console.log("Work");
        if (!credentials?.email || !credentials?.password) return null;

        const formData = new URLSearchParams();
        formData.append("username", credentials.email);
        formData.append("password", credentials.password);

        try {
          const res = await fetch(`${API_URL}/token`, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: formData,
          });

          const data = await res.json();

          if (res.ok && data.access_token) {
            // Return object to be saved in JWT
            return {
              id: credentials.email,
              email: credentials.email,
              accessToken: data.access_token,
              refreshToken: data.refresh_token,
              accessTokenExpires: Date.now() + 15 * 60 * 1000, // 15 minutes
            };
          }
          return null;
        } catch (err) {
          console.error("Login Failed", err);
          return null;
        }
      },
    }),
  ],
  callbacks: {
    // 3. Handle Google Login Backend Sync
    async signIn({ user, account }) {
      if (account.provider === "google") {
        try {
          // SECURITY UPDATE: Added X-API-Key header
          const res = await fetch(`${API_URL}/social-login`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-API-Key": API_SECRET_KEY,
            },
            body: JSON.stringify({ email: user.email }),
          });

          const data = await res.json();

          if (res.ok && data.access_token) {
            // Attach backend tokens to the 'user' object temporarily
            // so we can persist them in the JWT callback below
            user.accessToken = data.access_token;
            user.refreshToken = data.refresh_token;
            user.accessTokenExpires = Date.now() + 15 * 60 * 1000;
            return true;
          }
          return false;
        } catch (err) {
          console.error("Google Backend Sync Failed", err);
          return false;
        }
      }
      return true;
    },

    // 4. JWT Management (The Brain)
    async jwt({ token, user, account }) {
      // Initial Sign In
      if (account && user) {
        return {
          accessToken: user.accessToken,
          accessTokenExpires: user.accessTokenExpires,
          refreshToken: user.refreshToken,
          user,
        };
      }

      // Return previous token if the access token has not expired yet
      // We subtract 10 seconds for a safety buffer
      if (Date.now() < token.accessTokenExpires - 10000) {
        return token;
      }

      // Access token has expired, try to update it
      return refreshAccessToken(token);
    },

    // 5. Session Exposure (The Interface)
    async session({ session, token }) {
      session.user = token.user;
      session.accessToken = token.accessToken;
      session.error = token.error; // Pass error to client so we can logout if needed
      return session;
    },
  },
  pages: {
    signIn: "/auth/signin", // Optional: Custom sign-in page
  },
});

export { handler as GET, handler as POST };
