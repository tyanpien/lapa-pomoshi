"use client";

import { useMemo, useState } from "react";
import { useUser } from "@/shared/lib/hooks/useUser";
import { getThreadsByRole } from "@/shared/lib/messages";
import styles from "./page.module.css";

export default function MessagesPage() {
  const { role } = useUser();
  const isVolunteer = role === "volunteer";
  const threads = useMemo(() => getThreadsByRole(role), [role]);
  const [activeThreadId, setActiveThreadId] = useState(threads[0]?.id ?? 0);

  const activeThread =
    threads.find((thread) => thread.id === activeThreadId) ??
    threads[0] ?? {
      title: "",
      messages: [],
    };

  return (
    <main className={styles.page}>
      <div className={styles.container}>
        <section className={styles.chatLayout}>
          <aside className={styles.chatList}>
            {threads.map((thread) => (
              <button
                key={thread.id}
                type="button"
                className={`${styles.chatListItem} ${activeThread.id === thread.id ? styles.active : ""}`}
                onClick={() => setActiveThreadId(thread.id)}
              >
                <span className={styles.avatar} />
                <span className={styles.chatListText}>
                  <span className={styles.chatListTitle}>{thread.title}</span>
                  <span className={styles.chatListPreview}>{thread.preview}</span>
                </span>
                <span className={styles.chatListMeta}>
                  <span className={styles.chatListTime}>{thread.time}</span>
                  {thread.unread ? <span className={styles.unread}>{thread.unread}</span> : null}
                </span>
              </button>
            ))}
          </aside>

          <section className={styles.chatPanel}>
            <h1 className={styles.chatTitle}>{activeThread.title}</h1>

            <div className={styles.chatWindow}>
              <div className={styles.dateBadge}>20 апреля</div>

              {activeThread.messages.map((message) => (
                <article
                  key={message.id}
                  className={`${styles.messageRow} ${
                    message.from === "me" ? styles.messageRowMine : styles.messageRowOther
                  }`}
                >
                  {message.from === "other" ? <span className={styles.messageAvatar} /> : null}
                  <div className={styles.messageContent}>
                    <div
                      className={`${styles.messageBubble} ${
                        message.from === "me" ? styles.messageBubbleMine : styles.messageBubbleOther
                      }`}
                    >
                      {message.text}
                    </div>
                    <span className={styles.messageTime}>{message.time}</span>
                  </div>
                </article>
              ))}

              <form className={styles.messageForm}>
                <input
                  type="text"
                  placeholder={isVolunteer ? "Ответ волонтера..." : "Сообщение..."}
                  className={styles.messageInput}
                />
                <div className={styles.messageActions}>
                  <button type="button" className={styles.attachButton} aria-label="Прикрепить файл">
                    <img src="/screpka.svg" alt="прикрепить файл" />
                  </button>
                  <button type="submit" className={styles.sendButton}>
                    Отправить
                  </button>
                </div>
              </form>
            </div>
          </section>
        </section>
      </div>
    </main>
  );
}
