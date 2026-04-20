"use client";

import { useState } from "react";
import styles from "./page.module.css";
import Link from "next/link";

export default function HomePage() {
  const [activeFilter, setActiveFilter] = useState("Все");

  const animals = [
    {
      id: 1,
      name: "Муся",
      type: "Кошка",
      breed: "Метис",
      age: "2 года",
      organization: "Приют Доброе сердце",
      image: "/cat.png",
      badge: "Готова к пристрою",
    },
    {
      id: 2,
      name: "Барсик",
      type: "Кот",
      breed: "Британский",
      age: "3 года",
      organization: "Приют Лапка",
      image: "/cat.png",
      badge: "Ищет дом",
    },
    {
      id: 3,
      name: "Рекс",
      type: "Собака",
      breed: "Овчарка",
      age: "1.5 года",
      organization: "Приют Верный друг",
      image: "/dog.jpg",
      badge: "Ласковый",
    },
    {
      id: 4,
      name: "Жучка",
      type: "Собака",
      breed: "Дворняга",
      age: "4 года",
      organization: "Приют Надежда",
      image: "/dog.jpg",
      badge: "Спокойная",
    },
    {
      id: 5,
      name: "Мурка",
      type: "Кошка",
      breed: "Сиамская",
      age: "1 год",
      organization: "Приют Теплый дом",
      image: "/cat.png",
      badge: "Игривая",
    },
    {
      id: 6,
      name: "Шарик",
      type: "Собака",
      breed: "Лабрадор",
      age: "2 года",
      organization: "Приют Дружба",
      image: "/dog.jpg",
      badge: "Дружелюбный",
    },
  ];

  const filteredAnimals = animals.filter((animal) => {
    if (activeFilter === "Все") return true;
    if (activeFilter === "Кошки") return animal.type === "Кошка" || animal.type === "Кот";
    if (activeFilter === "Собаки") return animal.type === "Собака";
    return true;
  });
  return (
    <main className={styles.page}>

      {/* главная */}
      <section className={styles.hero}>
        <div className={styles.container}>

          <div className={styles.heroLeft}>
            <h1>
              Соединяем тех, кто ждёт, с теми, кто готов помочь
            </h1>

            <p>
              Платформа для волонтеров, приютов и всех,
              кто хочет сделать что-то важное — рядом с домом или онлайн
            </p>

            <div className={styles.heroButtons}>
              <Link href="/catalog/animals" className={styles.primary}>
                Найти питомца
              </Link>

              <Link href="/volunteer" className={styles.secondary}>
                Стать волонтером
              </Link>
            </div>
          </div>

          <div className={styles.heroRight}>
            <img src="/hero.png" alt="hero" />
          </div>

        </div>
      </section>

      {/* срочно нужна помощь */}
      <section className={styles.urgent}>
        <div className={styles.container}>

          <div className={styles.header}>
            <h2>Срочно нужна помощь</h2>
          </div>

          <div className={styles.urgentGrid}>
            <div className={styles.bigCard}>
              <div className={styles.bigImageWrapper}>
                <span className={styles.smallFilter1}>срочно</span>
                <Link href="/animal/1" className={styles.bigImage}>
                  <img src="/cat.png" alt="Кот Пушок" />
                </Link>
                <div className={styles.progressOnImage}>
                  <div className={styles.progressBarWrapper}>
                    <div className={styles.progressBarFill} style={{ width: '63%' }}></div>
                    <span className={styles.progressText}>5000 из 15000</span>
                  </div>
                </div>
              </div>

              <div className={styles.bigInfo}>
                <span className={styles.orgName}>Название организации</span>
                <h3>Кот Пушок</h3>
                <p>Нужна операция</p>

                <div className={styles.bigActions}>
                  <Link href="/help" className={styles.helpBtn}>
                    Помочь
                  </Link>
                  <Link href="/animal/1" className={styles.moreBtn}>
                    Подробнее
                  </Link>
                </div>
              </div>
            </div>

            <div className={styles.smallGrid}>
              <div className={styles.smallCard}>
                <span className={styles.smallFilter1}>срочно</span>
                <Link href="/animal/2" className={styles.smallImage}>
                  <img src="/a1.png" alt="Животное" />
                </Link>
                <span className={styles.smallFilter}>Волонтер</span>
              </div>

              <div className={styles.smallCard}>
                <span className={styles.smallFilter1}>срочно</span>
                <Link href="/animal/3" className={styles.smallImage}>
                  <img src="/a2.png" alt="Животное" />
                </Link>
                <span className={styles.smallFilter}>Передержка</span>
              </div>

              <div className={styles.smallCard}>
                <span className={styles.smallFilter1}>срочно</span>
                <Link href="/animal/4" className={styles.smallImage}>
                  <img src="/a3.png" alt="Животное" />
                </Link>
                <span className={styles.smallFilter}>Сбор</span>
              </div>

              <div className={styles.smallCard}>
                <span className={styles.smallFilter1}>срочно</span>
                <Link href="/animal/5" className={styles.smallImage}>
                  <img src="/a4.png" alt="Животное" />
                </Link>
                <span className={styles.smallFilter}>Передержка</span>
              </div>
            </div>
          </div>
        </div>
        <Link href="/urgent" className={styles.viewAllBtn}>
          Смотреть все срочные
        </Link>
      </section>


      {/* как вы можете помочь */}
      <section className={styles.helpSection}>
        <div className={styles.container}>
          <h2 className={styles.sectionTitle}>
            Как вы можете помочь
          </h2>

          <div className={styles.helpGrid}>
            <div className={styles.helpCard}>
              <div className={styles.helpCardContent}>
                <img src="/help1.svg" alt="" className={styles.helpVolunteer}/>
                <h3>Волонтерство</h3>
                <p>
                  Помогайте приютам с задачами рядом с домом —
                  перевозка, уход, фото, выгул
                </p>
                <a href="/help" className={styles.helpLink}>
                  Хочу помогать →
                </a>
              </div>
            </div>

            <div className={styles.helpCard}>
              <div className={styles.helpCardContent}>
                <img src="/help2.svg" alt="" className={styles.helpPhoto}/>
                <h3>Передержка</h3>
                <p>
                  Временно приютите питомца, пока он ищет
                  постоянного дома
                </p>
                <a href="/help" className={styles.helpLink}>
                  Предложить дом →
                </a>
              </div>
            </div>

            <div className={styles.helpCard}>
              <div className={styles.helpCardContent}>
                <img src="/help3.svg" alt="" className={styles.helpPhoto}/>
                <h3>Приютить</h3>
                <p>
                  Найдите питомца, который подойдет именно вам,
                  и заберите его домой навсегда
                </p>
                <a href="/catalog/animals" className={styles.helpLink}>
                  Смотреть животных →
                </a>
              </div>
            </div>

            <div className={styles.helpCard}>
              <div className={styles.helpCardContent}>
                <img src="/help4.svg" alt="" className={styles.helpThings}/>
                <h3>Помочь вещами</h3>
                <p>
                  Корм, лекарства, наполнители или финансовый
                  сбор — каждый вклад важен
                </p>
                <a href="/help" className={styles.helpLink}>
                  Помочь →
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ищут дом */}
      <section className={styles.homeSection}>
        <div className={styles.container}>
          <div className={styles.homeHeader}>
            <h2>Ищут дом</h2>
            <div className={styles.filters}>
              <button
                className={activeFilter === "Все" ? styles.active : ""}
                onClick={() => setActiveFilter("Все")}
              >
                Все
              </button>
              <button
                className={activeFilter === "Кошки" ? styles.active : ""}
                onClick={() => setActiveFilter("Кошки")}
              >
                Кошки
              </button>
              <button
                className={activeFilter === "Собаки" ? styles.active : ""}
                onClick={() => setActiveFilter("Собаки")}
              >
                Собаки
              </button>
            </div>
          </div>

          <div className={styles.homeGrid}>
            {filteredAnimals.map((animal) => (
              <div key={animal.id} className={styles.animalCard}>
                <div className={styles.imageWrapper}>
                  <img src={animal.image} alt={animal.name} />
                  <span className={styles.badge}>{animal.badge}</span>
                </div>

                <div className={styles.cardBody}>
                  <h3>{animal.name}</h3>
                  <div className={styles.tags}>
                    <span>{animal.type}</span>
                    <span>{animal.breed}</span>
                    <span>{animal.age}</span>
                  </div>

                  <p className={styles.org}>
                    <img src="/org.svg" alt="" className={styles.orgIcon} />
                    {animal.organization}
                  </p>

                  <Link href={`/animal/${animal.id}`} className={styles.link}>
                    Познакомиться →
                  </Link>
                </div>
              </div>
            ))}
          </div>

          {filteredAnimals.length === 0 && (
            <div className={styles.noResults}>
              <p>Животных этого типа пока нет</p>
            </div>
          )}

          <div className={styles.center}>
            <Link href="/catalog/animals" className={styles.showAll}>
              Смотреть все
            </Link>
          </div>
        </div>
      </section>

      {/* организации на платформе */}
      <section className={styles.orgSection}>
        <div className={styles.container}>

          <div className={styles.orgHeader}>
            <h2>Организации на платформе</h2>


          </div>

          <div className={styles.orgGrid}>

            {[1, 2, 3].map((item) => (
              <div key={item} className={styles.orgCard}>

                <div className={styles.orgTop}>
                  <div className={styles.orgLogo}></div>
                  <h3>Название</h3>
                </div>

                <p>Описание</p>

                <a href="/organization/1" className={styles.orgLink}>
                  Подробнее →
                </a>

              </div>
            ))}
          </div>
        </div>

        <a href="/catalog/organizations" className={styles.showAllRight}>
          Смотреть все →
        </a>
      </section>

      {/* ближайшие мероприятия*/}
      <section className={styles.eventsSection}>
        <div className={styles.container}>

          <div className={styles.eventsHeader}>
            <h2>Ближайшие мероприятия</h2>

            <a href="/events" className={styles.showAllRight}>
              Смотреть все →
            </a>
          </div>

          <div className={styles.eventsGrid}>

            {[1, 2, 3].map((item) => (
              <div key={item} className={styles.eventCard}>
                <img src="/event.png" alt="" />

                <div className={styles.eventBody}>
                  <h3>Название мероприятия</h3>

                  <p className={styles.eventMeta}>
                    12 мая • Рига
                  </p>

                  <a href="/events/1" className={styles.eventLink}>
                    Подробнее →
                  </a>
                </div>
              </div>
            ))}

          </div>

        </div>
      </section>


      {/* регистрация */}
      <section className={styles.ctaSection}>
        <div className={styles.container}>

          <div className={styles.ctaBox}>
            <h2>Присоединяйтесь к помощи уже сегодня</h2>

            <p>
              Волонтерство, передержка, помощь вещами или финансовая поддержка - выберите то, что вам ближе.
            </p>

            <div className={styles.ctaButtons}>
              <a href="/register" className={styles.primaryReg}>
                Зарегистрироваться
              </a>

              <a href="/help" className={styles.secondaryHelp}>
                Хочу помогать
              </a>
            </div>
          </div>

        </div>
      </section>
    </main>
  );
}
