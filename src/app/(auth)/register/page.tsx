import { Suspense } from "react";
import { AuthModal } from "@/widgets/auth-modal/AuthModal";
import { RegisterForm } from "@/features/auth/register/RegisterForm";

export default function RegisterPage() {
  return (
    <AuthModal>
      <Suspense fallback={null}>
        <RegisterForm />
      </Suspense>
    </AuthModal>
  );
}
