import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: process.env.NEXTAUTH_SECRET,
  trustHost: true,
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET
    })
  ],
  pages: {
    signIn: "/login"
  },
  session: {
    strategy: "jwt"
  },
  callbacks: {
    jwt({ token, profile }) {
      if (profile?.sub) token.userId = profile.sub;
      return token;
    },
    session({ session, token }) {
      if (session.user) session.user.id = token.userId || token.sub;
      return session;
    },
    authorized({ auth: session, request }) {
      const isLoginPage = request.nextUrl.pathname.startsWith("/login");
      if (isLoginPage && session?.user) {
        return Response.redirect(new URL("/", request.nextUrl));
      }
      return Boolean(session?.user);
    }
  }
});
