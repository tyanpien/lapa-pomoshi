import { Suspense } from "react";
import { AuthModal } from "@/widgets/auth-modal/AuthModal";
import { LoginForm } from "@/features/auth/login/LoginForm";

export default function LoginPage() {
  return (
    <AuthModal>
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
    </AuthModal>
  );
}
