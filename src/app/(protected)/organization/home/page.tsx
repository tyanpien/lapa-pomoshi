"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";
import styles from "./page.module.css";
import { ANIMAL_PLACEHOLDER_SRC, getImageUrl } from "@/shared/api/client";
import { meOrganizationApi } from "@/shared/api/endpoints/meOrganization";
import {
  addOrganizationGreeting,
  deleteOrganizationGreeting,
  getOrganizationCabinetEventName,
  getOrganizationGreetings,
  updateOrganizationGreeting,
} from "@/shared/lib/organizationCabinet";
import { getCurrentOrganizationAnimals, getOrganizationAnimalsEventName } from "@/shared/lib/organizationAnimals";
import { mergeApiFirstById } from "@/shared/lib/organizationPublicCabinet";
import { mergeApiAndLocalAnimals } from "@/shared/lib/organizationPublicWards";
import { useOrganizationPublicCabinetPayload } from "@/shared/lib/hooks/useOrganizationPublicCabinetPayload";

const initialState = {
  petName: "",
  text: "",
  photoUrl: "",
  linkedAnimalId: "",
};

export default function OrganizationHomeGreetingsPage() {
  const apiPayload = useOrganizationPublicCabinetPayload();
  const [form, setForm] = useState(initialState);
  const [localGreetings, setLocalGreetings] = useState(getOrganizationGreetings());
  const [localAnimals, setLocalAnimals] = useState(getCurrentOrganizationAnimals());
  const [isCreateModalOpen, setCreateModalOpen] = useState(false);
  const [editingGreetingId, setEditingGreetingId] = useState<number | null>(null);
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const pendingPhotoFileRef = useRef<File | null>(null);

  useEffect(() => {
    const cabinetEventName = getOrganizationCabinetEventName();
    const animalsEventName = getOrganizationAnimalsEventName();
    const sync = () => {
      setLocalGreetings(getOrganizationGreetings());
      setLocalAnimals(getCurrentOrganizationAnimals());
    };
    sync();
    window.addEventListener(cabinetEventName, sync);
    window.addEventListener(animalsEventName, sync);
    return () => {
      window.removeEventListener(cabinetEventName, sync);
      window.removeEventListener(animalsEventName, sync);
    };
  }, []);

  useEffect(() => {
    const closeMenu = () => setOpenMenuId(null);
    window.addEventListener("click", closeMenu);
    return () => window.removeEventListener("click", closeMenu);
  }, []);

  const greetings = useMemo(
    () => mergeApiFirstById(apiPayload.apiGreetings, localGreetings),
    [apiPayload.apiGreetings, localGreetings]
  );

  const animals = useMemo(
    () => mergeApiAndLocalAnimals(apiPayload.apiAnimals, localAnimals),
    [apiPayload.apiAnimals, localAnimals]
  );
  const useMeCabinet = apiPayload.dataSource === "me" && apiPayload.organizationId != null;

  const visibleGreetings = useMemo(() => {
    const query = search.trim().toLowerCase();
    return greetings.filter((item) => {
      if (!query) return true;
      return item.petName.toLowerCase().includes(query) || item.text.toLowerCase().includes(query);
    });
  }, [greetings, search]);

  const handlePhotoSelect = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    pendingPhotoFileRef.current = file;
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string") return;
      setForm((prev) => ({ ...prev, photoUrl: result }));
    };
    reader.readAsDataURL(file);
  };

  const uploadHomeStoryPhotoIfNeeded = async (storyId: number) => {
    const file = pendingPhotoFileRef.current;
    if (file) {
      await meOrganizationApi.uploadHomeStoryPhoto(storyId, file);
      pendingPhotoFileRef.current = null;
      return;
    }
    if (!form.photoUrl.startsWith("data:")) return;
    const response = await fetch(form.photoUrl);
    const blob = await response.blob();
    const dataFile = new File([blob], "photo.jpg", { type: blob.type || "image/jpeg" });
    await meOrganizationApi.uploadHomeStoryPhoto(storyId, dataFile);
  };

  const resetFormState = () => {
    pendingPhotoFileRef.current = null;
    setForm(initialState);
    setCreateModalOpen(false);
    setEditingGreetingId(null);
  };

  const animalsById = useMemo(() => {
    return new Map(animals.map((animal) => [animal.id, animal]));
  }, [animals]);

  const buildHomeStoryBody = () => {
    const body: Record<string, unknown> = {
      animal_name: form.petName.trim(),
      story: form.text.trim(),
      adopted_at: new Date().toISOString().slice(0, 10),
    };
    const photo = form.photoUrl.trim();
    if (photo && !photo.startsWith("data:")) {
      const path = photo.replace(/^\/media\//, "");
      body.photo_path = path.startsWith("http") ? photo : path;
    }
    return body;
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form.petName.trim() || !form.text.trim()) return;

    const payload = {
      petName: form.petName.trim(),
      text: form.text.trim(),
      photoUrl: form.photoUrl.trim() || undefined,
      linkedAnimalId: form.linkedAnimalId ? Number(form.linkedAnimalId) : undefined,
    };

    const finish = () => {
      resetFormState();
    };

    const hasPhotoToUpload = Boolean(pendingPhotoFileRef.current || form.photoUrl.trim().startsWith("data:"));

    if (useMeCabinet) {
      if (editingGreetingId) {
        void meOrganizationApi
          .patchHomeStory(editingGreetingId, buildHomeStoryBody())
          .then(async () => {
            if (hasPhotoToUpload) await uploadHomeStoryPhotoIfNeeded(editingGreetingId);
            window.dispatchEvent(new Event(getOrganizationCabinetEventName()));
            finish();
          })
          .catch(() => {});
      } else {
        void meOrganizationApi
          .createHomeStory(buildHomeStoryBody())
          .then(async (created) => {
            const row = created as { id?: unknown };
            const storyId = typeof row?.id === "number" ? row.id : null;
            if (storyId != null && hasPhotoToUpload) await uploadHomeStoryPhotoIfNeeded(storyId);
            window.dispatchEvent(new Event(getOrganizationCabinetEventName()));
            finish();
          })
          .catch(() => {});
      }
      return;
    }

    if (editingGreetingId) {
      updateOrganizationGreeting(editingGreetingId, payload);
    } else {
      addOrganizationGreeting(payload);
    }

    finish();
  };

  const openEditModal = (greetingId: number) => {
    if (apiPayload.apiGreetingIds.has(greetingId) && !useMeCabinet) return;
    const greeting = greetings.find((item) => item.id === greetingId);
    if (!greeting) return;

    pendingPhotoFileRef.current = null;
    setForm({
      petName: greeting.petName || "",
      text: greeting.text || "",
      photoUrl: greeting.photoUrl || "",
      linkedAnimalId: greeting.linkedAnimalId ? String(greeting.linkedAnimalId) : "",
    });
    setEditingGreetingId(greetingId);
    setCreateModalOpen(true);
    setOpenMenuId(null);
  };

  const handleDelete = (greetingId: number) => {
    if (apiPayload.apiGreetingIds.has(greetingId) && useMeCabinet) {
      const isConfirmed = window.confirm("Удалить публикацию?");
      if (!isConfirmed) return;
      void meOrganizationApi.deleteHomeStory(greetingId).then(() => {
        window.dispatchEvent(new Event(getOrganizationCabinetEventName()));
        setOpenMenuId(null);
      });
      return;
    }
    if (apiPayload.apiGreetingIds.has(greetingId)) return;
    const isConfirmed = window.confirm("Удалить публикацию?");
    if (!isConfirmed) return;
    deleteOrganizationGreeting(greetingId);
    setOpenMenuId(null);
  };

  const showGreetingMenu = (id: number) => {
    if (useMeCabinet) return true;
    return !apiPayload.apiGreetingIds.has(id);
  };

  return (
    <main className={styles.page}>
      <div className={styles.container}>
        <div className={styles.pageTop}>
          <div className={styles.topRow}>
            <h1 className={styles.title}>Привет из дома</h1>
            <button
              className={styles.addBtn}
              type="button"
              onClick={() => {
                setForm(initialState);
                setEditingGreetingId(null);
                setCreateModalOpen(true);
              }}
            >
              + Добавить публикацию
            </button>
          </div>
          <div className={styles.filters}>
            <input
              className={styles.searchInput}
              placeholder="Найти"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
        </div>

        {visibleGreetings.length === 0 ? (
          <div className={styles.emptyState}>Публикаций пока нет.</div>
        ) : (
          <section className={styles.list}>
            {visibleGreetings.map((item) => (
              <article key={item.id} className={styles.requestCard}>
                <div className={styles.cover}>
                  <img
                    src={item.photoUrl?.trim() ? getImageUrl(item.photoUrl) : ANIMAL_PLACEHOLDER_SRC}
                    alt={item.petName}
                  />
                </div>

                <div className={styles.requestBody}>
                  <div className={styles.cardActions}>
                    {showGreetingMenu(item.id) ? (
                      <>
                        <button
                          className={styles.menuButton}
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            setOpenMenuId((prev) => (prev === item.id ? null : item.id));
                          }}
                        >
                          ⋮
                        </button>
                        {openMenuId === item.id ? (
                          <div className={styles.menuDropdown} onClick={(event) => event.stopPropagation()}>
                            <button type="button" onClick={() => openEditModal(item.id)}>
                              Редактировать
                            </button>
                            <button type="button" onClick={() => handleDelete(item.id)}>
                              Удалить публикацию
                            </button>
                          </div>
                        ) : null}
                      </>
                    ) : null}
                  </div>
                  <h3 className={styles.requestName}>{item.petName}</h3>
                  {item.linkedAnimalId && animalsById.get(item.linkedAnimalId) ? (
                    <div className={styles.tags}>
                      <span>Животное: {animalsById.get(item.linkedAnimalId)?.name}</span>
                    </div>
                  ) : null}
                  <p className={styles.organizationLine}>{item.text}</p>
                  <p className={styles.metaLine}>
                    {new Date(item.createdAt).toLocaleDateString("ru-RU", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                    })}
                  </p>
                </div>
              </article>
            ))}
          </section>
        )}
      </div>

      {isCreateModalOpen ? (
        <div className={styles.modalOverlay} onClick={() => setCreateModalOpen(false)}>
          <div className={styles.modal} onClick={(event) => event.stopPropagation()}>
            <h2 className={styles.modalTitle}>{editingGreetingId ? "Редактировать публикацию" : "Добавить публикацию"}</h2>

            <form onSubmit={handleSubmit} className={styles.form}>
              <div className={styles.formGrid}>
                <label className={styles.label}>
                  Имя питомца
                  <input
                    className={styles.input}
                    value={form.petName}
                    onChange={(e) => setForm((prev) => ({ ...prev, petName: e.target.value }))}
                    required
                  />
                </label>

                <label className={styles.label}>
                  Прикрепить фото
                  <input className={styles.input} type="file" accept="image/*" onChange={handlePhotoSelect} />
                </label>

                <label className={styles.label}>
                  Привязать к животному (необязательно)
                  <select
                    className={styles.select}
                    value={form.linkedAnimalId}
                    onChange={(e) => setForm((prev) => ({ ...prev, linkedAnimalId: e.target.value }))}
                  >
                    <option value="">Без привязки</option>
                    {animals.map((animal) => (
                      <option key={animal.id} value={animal.id}>
                        {animal.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label className={styles.label}>
                Текст
                <textarea
                  className={styles.textarea}
                  value={form.text}
                  onChange={(e) => setForm((prev) => ({ ...prev, text: e.target.value }))}
                  required
                />
              </label>

              <div className={styles.actions}>
                <button type="submit" className={styles.primaryButton}>
                  {editingGreetingId ? "Сохранить" : "Опубликовать"}
                </button>
                <button
                  type="button"
                  className={styles.secondaryButton}
                  onClick={() => {
                    pendingPhotoFileRef.current = null;
                    setForm(initialState);
                  }}
                >
                  Очистить форму
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </main>
  );
}
