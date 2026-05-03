export type ChatMessage = {
  id: number;
  text: string;
  time: string;
  from: "me" | "other";
};

export type ChatThread = {
  id: number;
  title: string;
  preview: string;
  time: string;
  unread?: number;
  messages: ChatMessage[];
};

const userThreads: ChatThread[] = [
  {
    id: 1,
    title: "Фонд «Верный друг»",
    preview: "Давайте в субботу в 10...",
    time: "15:10",
    messages: [
      {
        id: 1,
        from: "other",
        text: "Добрый день! Мы посмотрели вашу анкету, всё отлично. Вы нам подходите! Когда вам будет удобно подъехать в приют, чтобы лично познакомиться с Мусей?",
        time: "15:00",
      },
      {
        id: 2,
        from: "me",
        text: "Здравствуйте! Очень рада это слышать! Могу приехать завтра после 18:00 или в субботу в первой половине дня.",
        time: "15:10",
      },
      {
        id: 3,
        from: "other",
        text: "Давайте в субботу в 11:00. Наш адрес: ул. Ленина, 45, предварительно позвоните от ворот. Ждём вас!",
        time: "15:10",
      },
    ],
  },
  {
    id: 2,
    title: "Центр спасения «Хвост...»",
    preview: "Давайте в субботу в 10...",
    time: "15:10",
    unread: 3,
    messages: [],
  },
  {
    id: 3,
    title: "Фонд «Верный друг»",
    preview: "Давайте в субботу в 10...",
    time: "15:10",
    messages: [],
  },
];

const volunteerThreads: ChatThread[] = [
  {
    id: 1,
    title: "Анна Смирнова",
    preview: "Могу приехать завтра после 18:00...",
    time: "15:10",
    messages: [
      {
        id: 1,
        from: "other",
        text: "Добрый день! Мы посмотрели вашу анкету, всё отлично. Вы нам подходите! Когда вам будет удобно подъехать в приют, чтобы лично познакомиться с Мусей?",
        time: "14:45",
      },
      {
        id: 2,
        from: "me",
        text: "Здравствуйте! Очень рада это слышать! Могу приехать завтра после 18:00 или в субботу в первой половине дня.",
        time: "15:00",
      },
      {
        id: 3,
        from: "other",
        text: "Давайте в субботу в 11:00. Наш адрес: ул. Ленина, 45, предварительно позвоните от ворот. Ждём вас!",
        time: "15:10",
      },
    ],
  },
  {
    id: 2,
    title: "Ирина Петрова",
    preview: "Уточните, пожалуйста, адрес...",
    time: "14:20",
    unread: 2,
    messages: [],
  },
  {
    id: 3,
    title: "Мария Иванова",
    preview: "Спасибо, буду на месте...",
    time: "13:00",
    messages: [],
  },
];

export const getThreadsByRole = (role: string | undefined): ChatThread[] => {
  if (role === "volunteer") return volunteerThreads;
  return userThreads;
};
