"use client";

import styles from "./RegisterForm.module.css";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useSearchParams, useRouter } from "next/navigation";
import axios from "axios";
import { registerOrganization } from "@/features/auth/api/registerOrganization";
import { fetchAuthMe, login, mapBackendRoleToApp } from "@/features/auth/api/login";
import { registerUser } from "@/features/auth/api/registerUser";
import { registerVolunteer } from "@/features/auth/api/registerVolunteer";
import { verifyEmailWithToken, verifyPhoneWithToken } from "@/features/auth/api/verify";
import { setAuthCookies } from "@/shared/lib/auth/cookies";
import { USER_EMAIL_STORAGE_KEY } from "@/shared/lib/hooks/useUser";
import { authHintKey, formatAuthCredential, isLikelyAuthContact } from "@/shared/lib/auth/contactCredential";

type Role = "user" | "volunteer" | "org" | null;

type AppRole = "user" | "volunteer" | "organization";

const ORGANIZATION_TYPES = [
  "Приют",
  "Фонд",
  "Передержка",
  "Иная зоозащитная организация",
] as const;

const MIN_PASSWORD_LENGTH = 8;

const PERSON_NAME_PATTERN = /^\p{L}+(?:\s+\p{L}+)*$/u;

const isValidPersonDisplayName = (value: string): boolean => {
  const trimmed = value.trim();
  if (!trimmed) return false;
  return PERSON_NAME_PATTERN.test(trimmed);
};

const PERSON_NAME_VALIDATION_ERROR =
  "Имя может содержать только буквы и пробелы между словами, без цифр и символов (=, -, + и т. п.).";

const withMinLength = (value: string, fallback: string): string => {
  const normalized = value.trim();
  return normalized.length >= 2 ? normalized : fallback;
};

const toAppRole = (role: Role): AppRole => {
  return role === "org" ? "organization" : role === "volunteer" ? "volunteer" : "user";
};

const getDefaultAvatarByRole = (role: AppRole): string => {
  if (role === "organization") return "/event.png";
  return "/event.png";
};

const saveRoleHint = (contact: string, role: AppRole) => {
  const key = authHintKey(contact);
  if (!key) return;
  localStorage.setItem(`auth_role_hint:${key}`, role);
};

const saveNameHint = (contact: string, name: string) => {
  const key = authHintKey(contact);
  const normalizedName = name.trim();
  if (!key || !normalizedName) return;
  localStorage.setItem(`auth_name_hint:${key}`, normalizedName);
};

const resolveRoleHint = (contact: string): AppRole | null => {
  if (!contact) return null;
  return (localStorage.getItem(`auth_role_hint:${authHintKey(contact)}`) as AppRole | null) ?? null;
};

const resolveNameHint = (contact: string): string | null => {
  if (!contact) return null;
  return localStorage.getItem(`auth_name_hint:${authHintKey(contact)}`);
};

async function consumeVerificationTokens(payload: {
  email_verification_token?: string;
  phone_verification_token?: string | null;
}) {
  try {
    const e = payload.email_verification_token?.trim();
    if (e) await verifyEmailWithToken(e);
  } catch {
  }
  try {
    const p = payload.phone_verification_token?.trim();
    if (p) await verifyPhoneWithToken(p);
  } catch {
  }
}

const getRoleDisplayName = (params: {
  role: AppRole;
  userName: string;
  volunteerName: string;
  orgFullName: string;
}): string => {
  if (params.role === "organization") {
    return params.orgFullName.trim() || "Организация";
  }
  if (params.role === "volunteer") {
    return params.volunteerName.trim() || "Волонтер";
  }
  return params.userName.trim() || "Пользователь";
};

const getApiErrorMessage = (error: unknown): string => {
  if (axios.isAxiosError(error)) {
    const detail = error.response?.data?.detail;
    if (typeof detail === "string" && detail.trim()) {
      return detail;
    }
    if (Array.isArray(detail) && detail.length > 0) {
      const firstDetail = detail[0];
      if (typeof firstDetail?.msg === "string") {
        return firstDetail.msg;
      }
    }
    if (error.response?.status) {
      return `Ошибка сервера (${error.response.status}). Проверьте логи бэкенда.`;
    }
  }

  return error instanceof Error ? error.message : "Ошибка регистрации.";
};

export function RegisterForm() {
  const [step, setStep] = useState<"role" | "form" | "success">("role");
  const [role, setRole] = useState<Role>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [hasTransport, setHasTransport] = useState(false);
  const [canTravel, setCanTravel] = useState(false);
  const [verification, setVerification] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [errorText, setErrorText] = useState("");
  const [successContact, setSuccessContact] = useState("");
  const [successPassword, setSuccessPassword] = useState("");

  const [userName, setUserName] = useState("");
  const [userContact, setUserContact] = useState("");
  const [userPassword, setUserPassword] = useState("");
  const [userPasswordConfirm, setUserPasswordConfirm] = useState("");
  const [volunteerName, setVolunteerName] = useState("");
  const [volunteerContact, setVolunteerContact] = useState("");
  const [volunteerPassword, setVolunteerPassword] = useState("");
  const [volunteerPasswordConfirm, setVolunteerPasswordConfirm] = useState("");
  const [volunteerCity, setVolunteerCity] = useState("");

  const [orgFullName, setOrgFullName] = useState("");
  const [orgContact, setOrgContact] = useState("");
  const [orgPassword, setOrgPassword] = useState("");
  const [orgPasswordConfirm, setOrgPasswordConfirm] = useState("");
  const [orgSpecialization, setOrgSpecialization] = useState("");
  const [isOrgTypeOpen, setIsOrgTypeOpen] = useState(false);
  const [orgWorkTerritory, setOrgWorkTerritory] = useState("");
  const [orgDescription] = useState("");
  const [orgAdmissionRules] = useState("");
  const [orgContactType] = useState("");
  const [orgContactValue] = useState("");
  const [orgContactNote] = useState("");
  const [orgDocumentsUrl] = useState("");
  const [orgVerificationComment] = useState("");
  const [agreement, setAgreement] = useState(false);
  const orgTypeRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const from = searchParams.get("from") || "/";

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (orgTypeRef.current && !orgTypeRef.current.contains(event.target as Node)) {
        setIsOrgTypeOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const validateRegistrationForm = (): string | null => {
    if (!agreement) {
      return "Нужно согласиться с обработкой персональных данных.";
    }

    if (role === "user") {
      if (!userName.trim()) return "Укажите имя.";
      if (!isValidPersonDisplayName(userName)) return PERSON_NAME_VALIDATION_ERROR;
      if (!userContact.trim()) return "Укажите e-mail или телефон.";
      if (!isLikelyAuthContact(userContact)) return "Укажите корректный e-mail или телефон.";
      if (!formatAuthCredential(userContact)) return "Укажите корректный e-mail или телефон.";
      if (!userPassword) return "Введите пароль.";
      if (userPassword.length < MIN_PASSWORD_LENGTH) {
        return "Пароль должен быть не менее 8 символов.";
      }
      if (!userPasswordConfirm) return "Подтвердите пароль.";
      if (userPassword !== userPasswordConfirm) return "Пароли не совпадают.";
      return null;
    }

    if (role === "volunteer") {
      if (!volunteerName.trim()) return "Укажите имя.";
      if (!isValidPersonDisplayName(volunteerName)) return PERSON_NAME_VALIDATION_ERROR;
      if (!volunteerContact.trim()) return "Укажите e-mail или телефон.";
      if (!isLikelyAuthContact(volunteerContact)) return "Укажите корректный e-mail или телефон.";
      if (!formatAuthCredential(volunteerContact)) return "Укажите корректный e-mail или телефон.";
      if (!volunteerCity.trim()) return "Укажите город.";
      if (!volunteerPassword) return "Введите пароль.";
      if (volunteerPassword.length < MIN_PASSWORD_LENGTH) {
        return "Пароль должен быть не менее 8 символов.";
      }
      if (!volunteerPasswordConfirm) return "Подтвердите пароль.";
      if (volunteerPassword !== volunteerPasswordConfirm) return "Пароли не совпадают.";
      return null;
    }

    if (role === "org") {
      if (!orgFullName.trim()) return "Укажите название организации.";
      if (!orgContact.trim()) return "Укажите e-mail или телефон.";
      if (!isLikelyAuthContact(orgContact)) return "Укажите корректный e-mail или телефон.";
      if (!formatAuthCredential(orgContact)) return "Укажите корректный e-mail или телефон.";
      if (!orgSpecialization) return "Выберите тип организации.";
      if (!orgWorkTerritory.trim()) return "Укажите город.";
      if (!orgPassword) return "Введите пароль.";
      if (orgPassword.length < MIN_PASSWORD_LENGTH) {
        return "Пароль должен быть не менее 8 символов.";
      }
      if (!orgPasswordConfirm) return "Подтвердите пароль.";
      if (orgPassword !== orgPasswordConfirm) return "Пароли не совпадают.";
      return null;
    }

    return null;
  };

  const submitRegistration = async () => {
    if (!role) return;

    const validationMessage = validateRegistrationForm();
    if (validationMessage) {
      setErrorText(validationMessage);
      return;
    }

    setErrorText("");
    setIsSubmitting(true);

    try {
      if (role === "user") {
        const contact = formatAuthCredential(userContact)!;

        const regUser = await registerUser({
          contact,
          full_name: userName.trim(),
          password: userPassword,
          password_confirmation: userPasswordConfirm,
          consent_personal_data: true,
        });

        await consumeVerificationTokens(regUser);

        if (regUser.user) {
          saveRoleHint(userContact, mapBackendRoleToApp(regUser.user.role));
          saveNameHint(userContact, regUser.user.full_name);
        } else {
          saveRoleHint(userContact, "user");
          saveNameHint(userContact, userName);
        }

        setSuccessContact(userContact);
        setSuccessPassword(userPassword);
      }

      if (role === "volunteer") {
        const contact = formatAuthCredential(volunteerContact)!;

        const availability = [
          `Личный транспорт: ${hasTransport ? "да" : "нет"}`,
          `Могу выезжать: ${canTravel ? "да" : "нет"}`,
        ].join("; ");

        const regVol = await registerVolunteer({
          contact,
          full_name: volunteerName.trim(),
          password: volunteerPassword,
          password_confirmation: volunteerPasswordConfirm,
          consent_personal_data: true,
          location_city: volunteerCity.trim(),
          has_own_transport: hasTransport,
          can_travel_other_area: canTravel,
          availability,
          travel_radius_km: 5000,
        });

        await consumeVerificationTokens(regVol);

        if (regVol.user) {
          saveRoleHint(volunteerContact, mapBackendRoleToApp(regVol.user.role));
          saveNameHint(volunteerContact, regVol.user.full_name);
        } else {
          saveRoleHint(volunteerContact, "volunteer");
          saveNameHint(volunteerContact, volunteerName);
        }

        setSuccessContact(volunteerContact);
        setSuccessPassword(volunteerPassword);
      }

      if (role === "org") {
        const contact = formatAuthCredential(orgContact)!;

        const orgName = withMinLength(orgFullName, "Организация");
        const city = orgWorkTerritory.trim();
        const description = withMinLength(orgDescription, `Организация ${orgName}`);
        const admissionRules = withMinLength(orgAdmissionRules, "По договоренности");
        const contactType = withMinLength(orgContactType, "phone");
        const contactValue = withMinLength(orgContactValue, orgContact.trim() || "не указано");
        const contactNote = withMinLength(orgContactNote, "основной");
        const documentsUrl = withMinLength(orgDocumentsUrl, "не указано");
        const verificationComment = withMinLength(
          orgVerificationComment,
          verification ? "Верификация включена" : "Верификация не запрошена"
        );

        const regOrg = await registerOrganization({
          contact,
          full_name: orgName,
          password: orgPassword,
          password_confirmation: orgPasswordConfirm,
          consent_personal_data: true,
          display_name: orgName,
          organization_type: orgSpecialization,
          city,
          request_verification: verification,
          legal_name: orgName,
          work_territory: city,
          description,
          admission_rules: admissionRules,
          contacts: [
            {
              contact_type: contactType,
              value: contactValue,
              note: contactNote,
            },
          ],
          verification: {
            documents_url: documentsUrl,
            comment: verificationComment,
          },
        });

        await consumeVerificationTokens(regOrg);

        if (regOrg.user) {
          saveRoleHint(orgContact, mapBackendRoleToApp(regOrg.user.role));
          saveNameHint(orgContact, regOrg.user.full_name);
        } else {
          saveRoleHint(orgContact, "organization");
          saveNameHint(orgContact, orgFullName);
        }

        setSuccessContact(orgContact);
        setSuccessPassword(orgPassword);
      }

      setStep("success");
    } catch (error) {
      setErrorText(getApiErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSuccessLogin = async () => {
    setErrorText("");
    setIsLoggingIn(true);

    try {
      const credential = formatAuthCredential(successContact);
      if (!credential) {
        throw new Error("Укажите корректный e-mail или телефон.");
      }

      const roleFromRegistration = toAppRole(role);

      await login({
        credential,
        password: successPassword,
      });

      const token = localStorage.getItem("access_token") || "";
      localStorage.setItem("token", token);

      const me = await fetchAuthMe(token);
      const roleToApply = me ? mapBackendRoleToApp(me.role) : resolveRoleHint(successContact) || roleFromRegistration;

      if (me?.email?.trim()) {
        localStorage.setItem(USER_EMAIL_STORAGE_KEY, me.email.trim());
      } else {
        localStorage.removeItem(USER_EMAIL_STORAGE_KEY);
      }

      const nameFromRoleForm = getRoleDisplayName({
        role: roleToApply,
        userName,
        volunteerName,
        orgFullName,
      });
      const nameToApply =
        me?.full_name?.trim() ||
        resolveNameHint(successContact) ||
        nameFromRoleForm;

      localStorage.setItem("userRole", roleToApply);
      localStorage.setItem("userAvatar", getDefaultAvatarByRole(roleToApply));
      localStorage.setItem("userName", nameToApply || "Пользователь");
      if (token) {
        setAuthCookies({ role: roleToApply, token });
      }
      window.dispatchEvent(new Event("auth-changed"));

      router.push("/");
      router.refresh();
    } catch (error) {
      setErrorText(getApiErrorMessage(error));
    } finally {
      setIsLoggingIn(false);
    }
  };

  return (
    <div className={styles.wrapper}>
      <div className={styles.left}>
        <div className={styles.logoBlock}>
          <h1>Лапа помощи</h1>
          <img src="/lapa-reg.svg" alt="logo" className={styles.logo} />
          <p>Помогаем тем, кто не умеет говорить</p>
        </div>
      </div>

      <div className={styles.right}>
        {step === "role" && (
          <>
            <div className={styles.back} onClick={() => router.push(from)}>
              &lt; Назад
            </div>
            <div className={styles.reg}>Регистрация</div>
            <p className={styles.subtitle}>
              Выберите, как вы хотите участвовать
            </p>
            <div className={styles.roles}>
              <div
                className={styles.role}
                onClick={() => {
                  setRole("user");
                  setStep("form");
                }}
              >
                <img src="/user-reg.svg" alt="Иконка пользователя" className={styles.icon} />
                <span className={styles.title}>Пользователь</span>
                <span className={styles.desc}>
                  Хочу помочь или подать анкету на пристрой
                </span>
              </div>
              <div
                className={styles.role}
                onClick={() => {
                  setRole("volunteer");
                  setStep("form");
                }}
              >
                <img src="/volun-reg.svg" alt="Иконка волонтера" className={styles.icon} />
                <span className={styles.title}>Волонтер</span>
                <span className={styles.desc}>
                  Готов лично участвовать в помощи и выполнять задачи
                </span>
              </div>
              <div
                className={styles.role}
                onClick={() => {
                  setRole("org");
                  setStep("form");
                }}
              >
                <img src="/org-reg.svg" alt="Иконка организации" className={styles.icon} />
                <span className={styles.title}>Организация</span>
                <span className={styles.desc}>
                  Представляю приют, фонд, передержку или другое объединение
                </span>
              </div>
            </div>
            <p className={styles.bottomText}>
              Уже есть аккаунт?{" "}
              <Link href="/login" className={styles.login}>
                Войти
              </Link>
            </p>
          </>
        )}

        {step === "form" && (
          <>
            <div className={styles.back} onClick={() => setStep("role")}>
              &lt; Назад
            </div>
            <h2>Регистрация</h2>

            <form
              className={styles.registrationForm}
              noValidate
              onSubmit={(e) => {
                e.preventDefault();
                void submitRegistration();
              }}
            >
            {role === "user" && (
              <div className={styles.oneColumn}>
                <div className={styles.fieldUser}>
                  <label>Имя</label>
                  <input
                    value={userName}
                    onChange={(e) => setUserName(e.target.value)}
                    placeholder="Имя"
                  />
                </div>
                <div className={styles.fieldUser}>
                  <label>E-mail или телефон</label>
                  <input
                    value={userContact}
                    onChange={(e) => setUserContact(e.target.value)}
                    placeholder="Введите e-mail или номер телефона"
                  />
                </div>
                <div className={styles.fieldUser}>
                  <label>Пароль</label>
                  <div className={styles.passwordWrapperUser}>
                    <input
                      type={showPassword ? "text" : "password"}
                      value={userPassword}
                      onChange={(e) => setUserPassword(e.target.value)}
                      placeholder="Не менее 8 символов"
                    />
                    <Image
                      src={showPassword ? "/eye-close.svg" : "/eye.svg"}
                      alt="eye"
                      width={20}
                      height={20}
                      className={styles.eye}
                      onClick={() => setShowPassword(!showPassword)}
                    />
                  </div>
                </div>
                <div className={styles.fieldUser}>
                  <label>Подтверждение пароля</label>
                  <input
                    type="password"
                    value={userPasswordConfirm}
                    onChange={(e) => setUserPasswordConfirm(e.target.value)}
                    placeholder="Повторите пароль"
                  />
                </div>
              </div>
            )}

            {role === "volunteer" && (
              <div className={styles.twoColumns}>
                <div className={styles.leftColumn}>
                  <div className={styles.field}>
                    <label>Имя</label>
                    <input
                      value={volunteerName}
                      onChange={(e) => setVolunteerName(e.target.value)}
                      placeholder="Имя"
                    />
                  </div>
                  <div className={styles.field}>
                    <label>E-mail или телефон</label>
                    <input
                      value={volunteerContact}
                      onChange={(e) => setVolunteerContact(e.target.value)}
                      placeholder="Введите e-mail или номер телефона"
                    />
                  </div>
                  <div className={styles.field}>
                    <label>Пароль</label>
                    <div className={styles.passwordWrapper}>
                      <input
                        type={showPassword ? "text" : "password"}
                        value={volunteerPassword}
                        onChange={(e) => setVolunteerPassword(e.target.value)}
                        placeholder="Не менее 8 символов"
                      />
                      <Image
                        src={showPassword ? "/eye-close.svg" : "/eye.svg"}
                        alt="eye"
                        width={20}
                        height={20}
                        className={styles.eye}
                        onClick={() => setShowPassword(!showPassword)}
                      />
                    </div>
                  </div>
                  <div className={styles.field}>
                    <label>Подтверждение пароля</label>
                    <input
                      type="password"
                      value={volunteerPasswordConfirm}
                      onChange={(e) => setVolunteerPasswordConfirm(e.target.value)}
                      placeholder="Повторите пароль"
                    />
                  </div>
                </div>

                <div className={styles.rightColumn}>
                  <div className={styles.field}>
                    <label>Город</label>
                    <input
                      value={volunteerCity}
                      onChange={(e) => setVolunteerCity(e.target.value)}
                      placeholder="Введите город"
                    />
                  </div>
                  <div className={styles.field1}>
                    <label>Есть личный транспорт</label>
                    <div className={styles.toggleSwitch}>
                      <input
                        type="checkbox"
                        id="hasTransport"
                        checked={hasTransport}
                        onChange={() => setHasTransport(!hasTransport)}
                      />
                      <label htmlFor="hasTransport" className={styles.switchLabel}>
                        <span
                          className={`${styles.switchSlider} ${
                            hasTransport ? styles.switchActive : styles.switchInactive
                          }`}
                        ></span>
                      </label>
                      <span className={styles.toggleText}>
                        {hasTransport}
                      </span>
                    </div>
                  </div>
                  <div className={styles.field1}>
                    <label>Могу выезжать в другой район или город</label>
                    <div className={styles.toggleSwitch}>
                      <input
                        type="checkbox"
                        id="canTravel"
                        checked={canTravel}
                        onChange={() => setCanTravel(!canTravel)}
                      />
                      <label htmlFor="canTravel" className={styles.switchLabel}>
                        <span
                          className={`${styles.switchSlider} ${
                            canTravel ? styles.switchActive : styles.switchInactive
                          }`}
                        ></span>
                      </label>
                      <span className={styles.toggleText}>
                        {canTravel}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {role === "org" && (
              <div className={styles.twoColumns}>
                <div className={styles.leftColumn}>
                  <div className={styles.field}>
                    <label>Название организации</label>
                    <input
                      value={orgFullName}
                      onChange={(e) => setOrgFullName(e.target.value)}
                      placeholder="Название организации"
                    />
                  </div>
                  <div className={styles.field}>
                    <label>E-mail или телефон</label>
                    <input
                      value={orgContact}
                      onChange={(e) => setOrgContact(e.target.value)}
                      placeholder="Введите e-mail или номер телефона"
                    />
                  </div>
                  <div className={styles.field}>
                    <label>Пароль</label>
                    <div className={styles.passwordWrapper}>
                      <input
                        type={showPassword ? "text" : "password"}
                        value={orgPassword}
                        onChange={(e) => setOrgPassword(e.target.value)}
                        placeholder="Не менее 8 символов"
                      />
                      <Image
                        src={showPassword ? "/eye-close.svg" : "/eye.svg"}
                        alt="eye"
                        width={20}
                        height={20}
                        className={styles.eye}
                        onClick={() => setShowPassword(!showPassword)}
                      />
                    </div>
                  </div>
                  <div className={styles.field}>
                    <label>Подтверждение пароля</label>
                    <input
                      type="password"
                      value={orgPasswordConfirm}
                      onChange={(e) => setOrgPasswordConfirm(e.target.value)}
                      placeholder="Повторите пароль"
                    />
                  </div>
                </div>

                <div className={styles.rightColumn}>
                  <div className={styles.field}>
                    <label>Тип организации</label>
                    <div className={styles.dropdownFilter} ref={orgTypeRef}>
                      <div
                        className={styles.dropdownHeader}
                        onClick={(e) => {
                          e.stopPropagation();
                          setIsOrgTypeOpen((prev) => !prev);
                        }}
                      >
                        {orgSpecialization || "Выберите тип организации"}
                        <span>{isOrgTypeOpen ? "▴" : "▾"}</span>
                      </div>
                      {isOrgTypeOpen && (
                        <div className={styles.dropdownList}>
                          {ORGANIZATION_TYPES.map((orgType) => (
                            <div
                              key={orgType}
                              className={styles.dropdownItem}
                              onClick={() => {
                                setOrgSpecialization(orgType);
                                setIsOrgTypeOpen(false);
                              }}
                            >
                              {orgType}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className={styles.field}>
                    <label>Город</label>
                    <input
                      value={orgWorkTerritory}
                      onChange={(e) => setOrgWorkTerritory(e.target.value)}
                      placeholder="Начните вводить город"
                    />
                  </div>
                  <div className={styles.field1}>
                    <label>Верификация</label>
                    <div className={styles.toggleSwitch}>
                      <input
                        type="checkbox"
                        id="verification"
                        checked={verification}
                        onChange={() => setVerification(!verification)}
                      />
                      <label htmlFor="verification" className={styles.switchLabel}>
                        <span
                          className={`${styles.switchSlider} ${
                            verification ? styles.switchActive : styles.switchInactive
                          }`}
                        ></span>
                      </label>
                      <span className={styles.toggleText}>
                        {verification}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <label className={styles.checkbox}>
              <input checked={agreement} onChange={(e) => setAgreement(e.target.checked)} type="checkbox" />
              <span>
                Я даю согласие на обработку персональных данных в соответствии с Политикой обработки персональных данных.
                <span className={styles.requiredMark}> *</span>
              </span>
            </label>
            {errorText && (
              <p className={styles.formError} role="alert">
                {errorText}
              </p>
            )}

            <button
              className={styles.registerBtn}
              type="submit"
              disabled={isSubmitting}
            >
              {isSubmitting
                ? "Отправка..."
                : role === "org"
                ? "Зарегистрировать организацию"
                : "Зарегистрироваться"}
            </button>
            </form>
          </>
        )}

        {step === "success" && (
          <>
            <img src="/success.svg" alt="logo" className={styles.success} />
            <h3 className={styles.successText}>Аккаунт создан!</h3>
            <p className={styles.successTextP}>
              Добро пожаловать в «Лапу помощи». Войдите, чтобы начать.
            </p>
            <div className={styles.successfield}>
              <label>E-mail или телефон</label>
              <input value={successContact} readOnly placeholder="Введите e-mail или номер телефона" />
            </div>
            <div className={styles.successfield}>
              <label>Пароль</label>
              <div className={styles.passwordWrapperSuccess}>
                <input
                  type={showPassword ? "text" : "password"}
                  value={successPassword}
                  readOnly
                  placeholder="Не менее 8 символов"
                />
                <Image
                  src={showPassword ? "/eye-close.svg" : "/eye.svg"}
                  alt="eye"
                  width={20}
                  height={20}
                  className={styles.eye}
                  onClick={() => setShowPassword(!showPassword)}
                />
              </div>
            </div>
            <button
              className={styles.loginBtn}
              onClick={handleSuccessLogin}
              disabled={isLoggingIn}
            >
              {isLoggingIn ? "Выполняем вход..." : "Войти"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
