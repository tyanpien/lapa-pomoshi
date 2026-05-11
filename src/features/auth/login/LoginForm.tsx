"use client";

import styles from "./LoginForm.module.css";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { useState } from "react";
import Image from "next/image";
import axios from "axios";
import { fetchAuthMe, fetchProfileName, login, mapBackendRoleToApp } from "@/features/auth/api/login";
import { setAuthCookies } from "@/shared/lib/auth/cookies";
import { USER_EMAIL_STORAGE_KEY } from "@/shared/lib/hooks/useUser";
import { authHintKey, formatAuthCredential } from "@/shared/lib/auth/contactCredential";

type AppRole = "user" | "volunteer" | "organization";

const resolveRoleHint = (contact: string): AppRole | null => {
  if (!contact) return null;
  return (localStorage.getItem(`auth_role_hint:${authHintKey(contact)}`) as AppRole | null) ?? null;
};

const resolveNameHint = (contact: string): string | null => {
  if (!contact) return null;
  return localStorage.getItem(`auth_name_hint:${authHintKey(contact)}`);
};

const getApiErrorMessage = (error: unknown): string => {
  if (axios.isAxiosError(error)) {
    const detail = error.response?.data?.detail;
    if (typeof detail === "string" && detail.trim()) return detail;
    if (Array.isArray(detail) && detail.length > 0 && typeof detail[0]?.msg === "string") {
      return detail[0].msg;
    }
  }
  return error instanceof Error ? error.message : "Ошибка входа.";
};

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const from = searchParams.get("from") || "/";

  const [showPassword, setShowPassword] = useState(false);
  const [contact, setContact] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorText, setErrorText] = useState("");

  const handleLogin = async () => {
    setErrorText("");
    setIsSubmitting(true);

    try {
      const credential = formatAuthCredential(contact);
      if (!credential) {
        throw new Error("Укажите e-mail или номер телефона.");
      }

      await login({ credential, password });

      const token = localStorage.getItem("access_token") || "";
      localStorage.setItem("token", token);

      const me = await fetchAuthMe(token);
      const roleToApply = me ? mapBackendRoleToApp(me.role) : resolveRoleHint(contact) || "user";

      if (me?.email?.trim()) {
        localStorage.setItem(USER_EMAIL_STORAGE_KEY, me.email.trim());
      } else {
        localStorage.removeItem(USER_EMAIL_STORAGE_KEY);
      }

      localStorage.setItem("userRole", roleToApply);
      localStorage.setItem("userAvatar", "/event.png");
      if (token) {
        setAuthCookies({ role: roleToApply, token });
      }
      const nameFromMe = me?.full_name?.trim() || "";
      const nameFromProfile = nameFromMe ? "" : await fetchProfileName(token);
      const currentName = localStorage.getItem("userName")?.trim();
      const fallbackName = roleToApply === "organization" ? "Организация" : "Пользователь";
      localStorage.setItem(
        "userName",
        nameFromMe || nameFromProfile || resolveNameHint(contact) || currentName || fallbackName
      );
      window.dispatchEvent(new Event("auth-changed"));

      router.push(from);
      router.refresh();
    } catch (error) {
      setErrorText(getApiErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={styles.wrapper}>
      <div className={styles.back} onClick={() => router.push(from)}>
        &lt; Назад
      </div>

      <div className={styles.left}>
        <div className={styles.logoBlock}>
          <h1>Лапа помощи</h1>
          <img src="/lapa-reg.svg" alt="logo" className={styles.logo} />
          <p>Помогаем тем, кто не умеет говорить</p>
        </div>
      </div>

      <div className={styles.right}>
        <h2>Вход</h2>

        <div className={styles.email}>E-mail или телефон</div>
        <input
          type="text"
          value={contact}
          onChange={(e) => setContact(e.target.value)}
          placeholder="Введите e-mail или номер телефона"
        />

        <div className={styles.email}>Пароль</div>

        <div className={styles.passwordWrapper}>
          <input
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Не менее 8 символов"
          />

          <span
            className={styles.eye}
            onClick={() => setShowPassword((prev) => !prev)}
          >
            <Image
              src={showPassword ? "/eye-close.svg" : "/eye.svg"}
              alt="toggle password"
              width={20}
              height={20}
            />
          </span>
        </div>

        <div className={styles.forgot}>Забыли пароль?</div>

        {errorText && <p>{errorText}</p>}

        <button className={styles.loginBtn} onClick={handleLogin} disabled={isSubmitting}>
          {isSubmitting ? "Выполняем вход..." : "Войти"}
        </button>

        <p className={styles.bottomText}>
          Еще нет аккаунта?{" "}
          <Link className={styles.register} href="/register">
            Зарегистрироваться
          </Link>
        </p>
      </div>
    </div>
  );
}
