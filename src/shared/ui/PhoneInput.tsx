"use client";

import { useRef } from "react";
import {
  PHONE_MASK,
  PHONE_POSITIONS,
  applyPhoneDigits,
  nextEditablePos,
  normalizePhoneDigits,
  prevEditablePos,
} from "@/shared/lib/phoneRu";

type PhoneInputProps = {
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  error?: string | null;
  disabled?: boolean;
  id?: string;
  className?: string;
  inputClassName?: string;
  errorClassName?: string;
};

export function PhoneInput({
  value,
  onChange,
  onBlur,
  error,
  disabled,
  id,
  className,
  inputClassName,
  errorClassName,
}: PhoneInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const displayValue = value.trim() ? applyPhoneDigits(value) : PHONE_MASK;
  const invalid = Boolean(error);

  const setAndCaret = (next: string, caretPos: number | null) => {
    onChange(next);
    requestAnimationFrame(() => {
      const el = inputRef.current;
      if (!el || caretPos == null) return;
      el.setSelectionRange(caretPos, caretPos);
    });
  };

  return (
    <div className={className}>
      <input
        ref={inputRef}
        id={id}
        className={inputClassName}
        value={displayValue}
        inputMode="tel"
        autoComplete="tel"
        aria-invalid={invalid}
        aria-describedby={error && id ? `${id}-error` : undefined}
        disabled={disabled}
        onFocus={() => {
          onChange(applyPhoneDigits(value || ""));
          requestAnimationFrame(() => {
            const el = inputRef.current;
            if (!el) return;
            const pos = nextEditablePos(el.value, el.selectionStart ?? 0);
            if (pos == null) return;
            el.setSelectionRange(pos, pos);
          });
        }}
        onBlur={onBlur}
        onKeyDown={(e) => {
          const el = e.currentTarget;
          const start = el.selectionStart ?? 0;
          const end = el.selectionEnd ?? 0;
          const current = applyPhoneDigits(value || "");

          if (e.key === "Backspace") {
            e.preventDefault();
            const pos = prevEditablePos(start);
            if (pos == null) return;
            const chars = current.split("");
            chars[pos] = "_";
            setAndCaret(chars.join(""), pos);
            return;
          }

          if (e.key === "Delete") {
            e.preventDefault();
            const pos = PHONE_POSITIONS.find((p) => p >= start) ?? null;
            if (pos == null) return;
            const chars = current.split("");
            chars[pos] = "_";
            setAndCaret(chars.join(""), pos);
            return;
          }

          if (e.key.length === 1 && /\d/.test(e.key) && !e.ctrlKey && !e.metaKey && !e.altKey) {
            e.preventDefault();
            const chars = current.split("");

            if (start !== end) {
              for (const pos of PHONE_POSITIONS) {
                if (pos >= start && pos < end) chars[pos] = "_";
              }
            }

            const insertPos = nextEditablePos(chars.join(""), start);
            if (insertPos == null) return;
            chars[insertPos] = e.key;
            const nextValue = chars.join("");
            const caret = nextEditablePos(nextValue, insertPos + 1) ?? insertPos + 1;
            setAndCaret(nextValue, caret);
          }
        }}
        onPaste={(e) => {
          e.preventDefault();
          const el = e.currentTarget;
          const start = el.selectionStart ?? 0;
          const end = el.selectionEnd ?? 0;
          const digits = normalizePhoneDigits(e.clipboardData.getData("text") || "");
          if (!digits) return;

          const current = applyPhoneDigits(value || "");
          const chars = current.split("");

          if (start !== end) {
            for (const pos of PHONE_POSITIONS) {
              if (pos >= start && pos < end) chars[pos] = "_";
            }
          }

          let idx = 0;
          let pos: number | null = nextEditablePos(chars.join(""), start);
          while (pos != null && idx < digits.length) {
            chars[pos] = digits[idx];
            idx++;
            pos = nextEditablePos(chars.join(""), pos + 1);
          }

          const nextValue = chars.join("");
          onChange(nextValue);
          requestAnimationFrame(() => {
            const caret = nextEditablePos(nextValue, start) ?? (PHONE_POSITIONS.at(-1) ?? 0) + 1;
            el.setSelectionRange(caret, caret);
          });
        }}
        onChange={(e) => {
          onChange(applyPhoneDigits(e.target.value));
        }}
      />
      {error ? (
        <p id={id ? `${id}-error` : undefined} className={errorClassName} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
