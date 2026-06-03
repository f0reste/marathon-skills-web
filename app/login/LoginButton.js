"use client";

import { signIn } from "next-auth/react";

export default function LoginButton() {
  return (
    <button className="button button-google" type="button" onClick={() => signIn("google", { callbackUrl: "/dashboard" })}>
      <span className="google-mark">G</span>
      Войти через Google
    </button>
  );
}
