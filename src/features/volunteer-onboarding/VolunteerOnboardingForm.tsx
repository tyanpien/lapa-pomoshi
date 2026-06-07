"use client";

import type { ChangeEvent, Dispatch, SetStateAction } from "react";
import {
  WEEKDAY_EDIT_LABELS,
  WEEKDAY_KEYS,
  type WeekdayKey,
} from "@/shared/lib/volunteerAvailabilityGrid";
import {
  VOLUNTEER_ANIMAL_KIND_OPTIONS,
  type StoredVolunteerDetails,
  type VolunteerAnimalKindTag,
  type VolunteerHelpFrequency,
} from "@/shared/lib/volunteerProfileStorage";
import volStyles from "@/app/(protected)/volunteer/profile/page.module.css";

const HELP_FREQUENCY_OPTIONS: VolunteerHelpFrequency[] = ["Разовая помощь", "Регулярная помощь"];

type VolunteerOnboardingFormProps = {
  details: StoredVolunteerDetails;
  setDetails: Dispatch<SetStateAction<StoredVolunteerDetails>>;
  competencyOptions: string[];
  experienceOptions: string[];
  helpFormatOptions: string[];
  submitError: string | null;
  isSubmitting: boolean;
  onSubmit: () => void;
  onCancel?: () => void;
  submitLabel?: string;
};

export function VolunteerOnboardingForm({
  details,
  setDetails,
  competencyOptions,
  experienceOptions,
  helpFormatOptions,
  submitError,
  isSubmitting,
  onSubmit,
  onCancel,
  submitLabel = "Стать волонтёром",
}: VolunteerOnboardingFormProps) {
  const handleDetailsFieldChange =
    (field:
      | "experience"
      | "location"
      | "travelRadius"
      | "competenciesOther"
      | "helpFormatsOther"
      | "aboutMe") =>
    (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setDetails((prev) => ({
        ...prev,
        [field]: event.target.value,
      }));
    };

  const setDayTimeRange = (day: WeekdayKey, field: "from" | "to", value: string) => {
    setDetails((prev) => ({
      ...prev,
      availabilityAroundClock: false,
      availabilityDayRanges: {
        ...prev.availabilityDayRanges,
        [day]: {
          ...prev.availabilityDayRanges[day],
          [field]: value,
        },
      },
    }));
  };

  const toggleMultiValue = (field: "competencies" | "helpFormats", value: string) => {
    setDetails((prev) => ({
      ...prev,
      [field]: prev[field].includes(value)
        ? prev[field].filter((item) => item !== value)
        : [...prev[field], value],
    }));
  };

  const toggleAnimalKind = (kind: VolunteerAnimalKindTag) => {
    setDetails((prev) => ({
      ...prev,
      animalKinds: prev.animalKinds.includes(kind)
        ? prev.animalKinds.filter((item) => item !== kind)
        : [...prev.animalKinds, kind],
    }));
  };

  return (
    <div className={volStyles.modalFormInner}>
      <div className={volStyles.detailsFormColumns}>
        <div>
          <fieldset className={volStyles.radioFieldset}>
            <legend className={volStyles.fieldLabel}>Предпочтительный формат помощи</legend>
            <div className={volStyles.radioList}>
              {HELP_FREQUENCY_OPTIONS.map((option) => (
                <label className={volStyles.optionLabel} key={option}>
                  <input
                    type="radio"
                    name="help-frequency-onboarding"
                    checked={details.helpFrequency === option}
                    onChange={() => setDetails((p) => ({ ...p, helpFrequency: option }))}
                  />
                  <span>{option}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <label className={volStyles.field}>
            <span className={volStyles.fieldLabel}>О себе</span>
            <textarea
              value={details.aboutMe}
              onChange={handleDetailsFieldChange("aboutMe")}
              placeholder="Опыт, интересы, с чем готов помогать животным"
              rows={5}
              className={volStyles.aboutTextarea}
            />
          </label>

          <fieldset className={volStyles.radioFieldset}>
            <legend className={volStyles.fieldLabel}>С кем готов работать</legend>
            <div className={volStyles.radioList}>
              {VOLUNTEER_ANIMAL_KIND_OPTIONS.map((kind) => (
                <label className={volStyles.optionLabel} key={kind}>
                  <input
                    type="checkbox"
                    checked={details.animalKinds.includes(kind)}
                    onChange={() => toggleAnimalKind(kind)}
                  />
                  <span>{kind}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <label className={volStyles.field}>
            <span className={volStyles.fieldLabel}>
              Компетенции <span aria-hidden="true">*</span>
            </span>
            <div className={volStyles.optionGridSingle}>
              {competencyOptions.map((option) => (
                <label className={volStyles.optionLabel} key={option}>
                  <input
                    type="checkbox"
                    checked={details.competencies.includes(option)}
                    onChange={() => toggleMultiValue("competencies", option)}
                  />
                  <span>{option}</span>
                </label>
              ))}
            </div>
            {details.competencies.includes("Другое") && (
              <input
                value={details.competenciesOther}
                onChange={handleDetailsFieldChange("competenciesOther")}
                placeholder="Укажите свой вариант"
              />
            )}
          </label>

          <label className={volStyles.field}>
            <span className={volStyles.fieldLabel}>Чем могу помочь</span>
            <div className={volStyles.optionGrid}>
              {helpFormatOptions.map((option) => (
                <label className={volStyles.optionLabel} key={option}>
                  <input
                    type="checkbox"
                    checked={details.helpFormats.includes(option)}
                    onChange={() => toggleMultiValue("helpFormats", option)}
                  />
                  <span>{option}</span>
                </label>
              ))}
            </div>
            {details.helpFormats.includes("Другое") && (
              <input
                value={details.helpFormatsOther}
                onChange={handleDetailsFieldChange("helpFormatsOther")}
                placeholder="Укажите свой вариант"
              />
            )}
          </label>
        </div>

        <div>
          <div className={volStyles.field}>
            <span className={volStyles.fieldLabel}>Доступность</span>
            <div className={volStyles.availabilityDayListWrap}>
              <ul className={volStyles.availabilityDayList}>
                {WEEKDAY_KEYS.map((day) => {
                  const range = details.availabilityDayRanges[day];
                  const disabled = details.availabilityAroundClock;
                  return (
                    <li key={day} className={volStyles.availabilityDayRow}>
                      <span className={volStyles.availabilityDayName}>{WEEKDAY_EDIT_LABELS[day]}</span>
                      <div className={volStyles.availabilityTimePair}>
                        <input
                          type="time"
                          className={volStyles.availabilityTimeInput}
                          value={range.from}
                          disabled={disabled}
                          onChange={(event) => setDayTimeRange(day, "from", event.target.value)}
                          aria-label={`${WEEKDAY_EDIT_LABELS[day]}, с`}
                        />
                        <span className={volStyles.availabilityTimeDash} aria-hidden>
                          –
                        </span>
                        <input
                          type="time"
                          className={volStyles.availabilityTimeInput}
                          value={range.to}
                          disabled={disabled}
                          onChange={(event) => setDayTimeRange(day, "to", event.target.value)}
                          aria-label={`${WEEKDAY_EDIT_LABELS[day]}, до`}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
            <label className={`${volStyles.optionLabel} ${volStyles.availabilityAroundClockRow}`}>
              <input
                type="checkbox"
                checked={details.availabilityAroundClock}
                onChange={() =>
                  setDetails((prev) => ({
                    ...prev,
                    availabilityAroundClock: !prev.availabilityAroundClock,
                  }))
                }
              />
              <span>Круглосуточно</span>
            </label>
            <label className={`${volStyles.optionLabel} ${volStyles.travelOutOfTownRow}`}>
              <input
                type="checkbox"
                checked={details.travelOutOfTown}
                onChange={() =>
                  setDetails((prev) => ({
                    ...prev,
                    travelOutOfTown: !prev.travelOutOfTown,
                  }))
                }
              />
              <span>Готов выезжать за город</span>
            </label>
          </div>

          <label className={`${volStyles.optionLabel} ${volStyles.nightOutingRow}`}>
            <input
              type="checkbox"
              checked={details.nightOutings}
              onChange={() =>
                setDetails((p) => ({
                  ...p,
                  nightOutings: !p.nightOutings,
                }))
              }
            />
            <span>Готов к срочным ночным выездам</span>
          </label>

          <label className={volStyles.field}>
            <span className={volStyles.fieldLabel}>
              Опыт <span aria-hidden="true">*</span>
            </span>
            <select
              value={details.experience}
              onChange={(event) =>
                setDetails((prev) => ({
                  ...prev,
                  experience: event.target.value,
                }))
              }
              className={volStyles.selectField}
            >
              <option value="">Выберите уровень</option>
              {experienceOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>

          <label className={volStyles.field}>
            <span className={volStyles.fieldLabel}>
              Локация <span aria-hidden="true">*</span>
            </span>
            <input
              value={details.location}
              onChange={handleDetailsFieldChange("location")}
              placeholder="Город / район"
              required
            />
          </label>

          <label className={volStyles.field}>
            <span className={volStyles.fieldLabel}>Радиус выезда</span>
            <input
              value={details.travelRadius}
              onChange={handleDetailsFieldChange("travelRadius")}
              placeholder="До 10 км / по всему городу"
            />
          </label>
        </div>
      </div>

      {submitError ? (
        <p role="alert" style={{ marginBottom: "0.75rem", color: "#b3261e", fontSize: "0.9rem" }}>
          {submitError}
        </p>
      ) : null}

      <div className={volStyles.modalActions}>
        <button
          type="button"
          className={volStyles.modalPrimaryButton}
          disabled={isSubmitting}
          onClick={onSubmit}
        >
          {isSubmitting ? "Сохранение…" : submitLabel}
        </button>
        {onCancel ? (
          <button
            type="button"
            className={volStyles.modalSecondaryButton}
            disabled={isSubmitting}
            onClick={onCancel}
          >
            Отмена
          </button>
        ) : null}
      </div>
    </div>
  );
}
