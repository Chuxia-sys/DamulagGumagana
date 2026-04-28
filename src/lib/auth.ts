import NextAuth, { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { db } from './db';
import bcrypt from 'bcryptjs';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      uid: string;
      name: string;
      email: string;
      role: string;
      departmentId: string | null;
      image?: string | null;
    };
  }
  interface User {
    id: string;
    uid: string;
    name: string;
    email: string;
    role: string;
    departmentId: string | null;
    image?: string | null;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string;
    uid: string;
    name: string;
    email: string;
    role: string;
    departmentId: string | null;
    // NOTE: image is NOT stored in JWT to prevent token size issues with base64 images
  }
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const user = await db.user.findUnique({
          where: { email: credentials.email },
          include: { department: true },
        });

        if (!user) {
          return null;
        }

        const passwordMatch = await bcrypt.compare(credentials.password, user.password);

        if (!passwordMatch) {
          return null;
        }

        // Create audit log for login
        await db.auditLog.create({
          data: {
            userId: user.id,
            action: 'login',
            entity: 'user',
            entityId: user.id,
          },
        });

        // NOTE: Do NOT return image here - base64 images can be very large
        // and may cause JWT/session serialization issues. Image should be
        // fetched separately by components that need it.
        return {
          id: user.id,
          uid: user.uid,
          name: user.name,
          email: user.email,
          role: user.role,
          departmentId: user.departmentId,
          // image is intentionally NOT returned to prevent token bloat
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger }) {
      // Initial sign in
      if (user) {
        token.id = user.id;
        token.uid = user.uid;
        token.name = user.name;
        token.email = user.email;
        token.role = user.role;
        token.departmentId = user.departmentId;
        // NOTE: Do NOT store image in JWT - it can be too large (base64)
      }
      
      // Handle session update - refresh user data from database
      if (trigger === 'update' && token.id) {
        // Fetch fresh user data from database
        const freshUser = await db.user.findUnique({
          where: { id: token.id },
        });
        
        if (freshUser) {
          token.name = freshUser.name;
          token.departmentId = freshUser.departmentId;
          // NOTE: Do NOT store image in JWT
        }
      }
      
      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user = {
          id: token.id,
          uid: token.uid,
          name: token.name ?? '',
          email: token.email ?? '',
          role: token.role,
          departmentId: token.departmentId,
          // Image will be fetched separately by components that need it
          image: null,
        };
      }
      return session;
    },
  },
  pages: {
    signIn: '/',
  },
  session: {
    strategy: 'jwt',
    maxAge: 24 * 60 * 60, // 24 hours
  },
  secret: process.env.NEXTAUTH_SECRET || 'fepc-scheduling-system-premium-secret-key-2024',
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
