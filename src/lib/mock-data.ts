export type CourseStatus = "completed" | "today" | "locked";
export type Visibility = "public" | "teacher_only";

export type Student = {
  id: string;
  name: string;
  italianName: string;
  avatar: string;
  level: string;
};

export type Course = {
  id: string;
  day: number;
  titleIt: string;
  titleZh: string;
  intro: string;
  unlockDate: string;
  status: CourseStatus;
  audioTitle: string;
  duration: string;
  text: string;
  vocabulary: { word: string; meaning: string }[];
};

export type Comment = {
  id: string;
  studentName: string;
  content: string;
  time: string;
};

export type Assignment = {
  id: string;
  courseId: string;
  studentId: string;
  visibility: Visibility;
  submittedAt: string;
  version: number;
  reflection: string;
  likes: number;
  comments: Comment[];
  aiStatus: "ready" | "pending";
};

export const students: Student[] = [
  { id: "s1", name: "林小满", italianName: "Marta", avatar: "林", level: "A2" },
  { id: "s2", name: "周予安", italianName: "Luca", avatar: "周", level: "A1+" },
  { id: "s3", name: "陈晴", italianName: "Chiara", avatar: "陈", level: "B1" },
];

export const currentStudentId = "s1";

export const courses: Course[] = [
  {
    id: "giorno-1",
    day: 1,
    titleIt: "Un nuovo inizio",
    titleZh: "一个新的开始",
    intro: "听示范录音，慢慢读出第一段开场文字。",
    unlockDate: "2026-07-01",
    status: "completed",
    audioTitle: "好好老师示范 · Giorno 1",
    duration: "01:48",
    text: "Oggi comincia un piccolo viaggio. Ogni parola letta con calma ci porta più vicino alla lingua italiana.",
    vocabulary: [
      { word: "viaggio", meaning: "旅程" },
      { word: "calma", meaning: "平静、从容" },
      { word: "vicino", meaning: "靠近的" },
    ],
  },
  {
    id: "giorno-2",
    day: 2,
    titleIt: "La finestra aperta",
    titleZh: "打开的窗",
    intro: "练习清楚读出元音，并记录一句喜欢的句子。",
    unlockDate: "2026-07-02",
    status: "completed",
    audioTitle: "好好老师示范 · Giorno 2",
    duration: "02:06",
    text: "Apro la finestra e ascolto la città. Le voci del mattino sembrano leggere insieme a me.",
    vocabulary: [
      { word: "finestra", meaning: "窗户" },
      { word: "ascolto", meaning: "我听" },
      { word: "mattino", meaning: "早晨" },
    ],
  },
  {
    id: "giorno-3",
    day: 3,
    titleIt: "Una parola gentile",
    titleZh: "一句温柔的话",
    intro: "注意 doppie 双辅音，提交一次跟读录音。",
    unlockDate: "2026-07-03",
    status: "completed",
    audioTitle: "好好老师示范 · Giorno 3",
    duration: "01:55",
    text: "Una parola gentile può cambiare il ritmo della giornata e rendere più leggero il cuore.",
    vocabulary: [
      { word: "gentile", meaning: "温柔的、有礼貌的" },
      { word: "ritmo", meaning: "节奏" },
      { word: "leggero", meaning: "轻盈的" },
    ],
  },
  {
    id: "giorno-4",
    day: 4,
    titleIt: "Il profumo del pane",
    titleZh: "面包的香气",
    intro: "今日解锁：练习描述生活中的气味和画面。",
    unlockDate: "2026-07-04",
    status: "today",
    audioTitle: "好好老师示范 · Giorno 4",
    duration: "02:18",
    text: "Davanti al forno, il profumo del pane caldo mi ricorda le strade tranquille di un paese italiano.",
    vocabulary: [
      { word: "forno", meaning: "烤炉、面包店" },
      { word: "profumo", meaning: "香气" },
      { word: "tranquille", meaning: "安静的" },
    ],
  },
  {
    id: "giorno-5",
    day: 5,
    titleIt: "La piazza di sera",
    titleZh: "傍晚的广场",
    intro: "尚未解锁，可先查看标题和开放时间。",
    unlockDate: "2026-07-05",
    status: "locked",
    audioTitle: "好好老师示范 · Giorno 5",
    duration: "02:10",
    text: "La piazza di sera si illumina piano, mentre le persone parlano e camminano senza fretta.",
    vocabulary: [
      { word: "piazza", meaning: "广场" },
      { word: "illumina", meaning: "照亮" },
      { word: "senza fretta", meaning: "不着急" },
    ],
  },
  {
    id: "giorno-6",
    day: 6,
    titleIt: "Lettera a un'amica",
    titleZh: "写给朋友的信",
    intro: "尚未解锁，可先查看标题和开放时间。",
    unlockDate: "2026-07-06",
    status: "locked",
    audioTitle: "好好老师示范 · Giorno 6",
    duration: "02:24",
    text: "Cara amica, oggi ho letto una pagina semplice, ma dentro c'era una luce nuova.",
    vocabulary: [
      { word: "cara", meaning: "亲爱的" },
      { word: "pagina", meaning: "一页" },
      { word: "luce", meaning: "光" },
    ],
  },
  {
    id: "giorno-7",
    day: 7,
    titleIt: "Rileggere piano",
    titleZh: "慢慢重读",
    intro: "尚未解锁，可先查看标题和开放时间。",
    unlockDate: "2026-07-07",
    status: "locked",
    audioTitle: "好好老师示范 · Giorno 7",
    duration: "01:58",
    text: "Rileggere piano significa ascoltare meglio: la frase torna, respira, e diventa più nostra.",
    vocabulary: [
      { word: "rileggere", meaning: "重读" },
      { word: "respira", meaning: "呼吸" },
      { word: "nostra", meaning: "我们的" },
    ],
  },
];

export const assignments: Assignment[] = [
  {
    id: "a1",
    courseId: "giorno-4",
    studentId: "s1",
    visibility: "public",
    submittedAt: "今天 08:42",
    version: 2,
    reflection: "Il profumo del pane caldo mi ricorda la colazione con la mia famiglia. Questa frase mi fa sentire tranquilla.",
    likes: 12,
    comments: [
      { id: "c1", studentName: "Luca", content: "你的节奏很稳，profumo 读得很清楚。", time: "09:10" },
      { id: "c2", studentName: "Chiara", content: "Mi piace molto la tua voce calma!", time: "09:28" },
    ],
    aiStatus: "ready",
  },
  {
    id: "a2",
    courseId: "giorno-4",
    studentId: "s2",
    visibility: "public",
    submittedAt: "今天 09:05",
    version: 1,
    reflection: "Leggendo questo testo, ho pensato a una piccola panetteria vicino a casa mia.",
    likes: 8,
    comments: [
      { id: "c3", studentName: "Marta", content: "tranquille 的尾音很好听！", time: "09:33" },
    ],
    aiStatus: "ready",
  },
  {
    id: "a3",
    courseId: "giorno-3",
    studentId: "s3",
    visibility: "teacher_only",
    submittedAt: "昨天 21:16",
    version: 1,
    reflection: "今天先交给老师看，想再练一次 doppie。",
    likes: 0,
    comments: [],
    aiStatus: "pending",
  },
];

export const aiFeedback = {
  assignmentId: "a1",
  completeness: "原文完整度较高，大部分内容已经清楚读出。",
  missedWords: ["ricorda"],
  unclearWords: ["profumo", "paese"],
  extraWords: ["一个轻微重复的 davanti"],
  suggestion: "建议重新练习 davanti al forno 和 paese italiano。",
  tips: [
    "先单独练 profumo 三次，注意 fu 的轻短过渡。",
    "读 paese 时让重音落在 e 上：pa-E-se。",
    "第二句可以稍微放慢，让画面感更清楚。",
  ],
};

export const weeklyMeeting = {
  title: "Settimana 1 · 慢慢读，也慢慢听见自己",
  date: "2026-07-07",
  time: "20:00 - 21:15",
  link: "https://meeting.example.com/haohao-week-1",
  meetingId: "884 210 778",
  password: "ciao",
  questions: [
    "Quale testo ti è piaciuto di più questa settimana?",
    "Quale frase vuoi ricordare?",
    "Quale parola nuova hai imparato?",
    "Hai incontrato qualche difficoltà durante la lettura?",
  ],
  preparation: "请提前选一段本周最喜欢的句子，并准备 1 分钟中文或意大利语分享。",
  replay: "回放占位：Settimana 1 交流会",
  summary: "本周共同练习慢速朗读、双辅音和句尾收束。",
};

export function getStudent(id: string) {
  return students.find((student) => student.id === id) ?? students[0];
}

export function getCourse(id: string) {
  return courses.find((course) => course.id === id) ?? courses[0];
}

export function getAssignment(id: string) {
  return assignments.find((assignment) => assignment.id === id) ?? assignments[0];
}

export const progress = {
  totalDays: 21,
  unlocked: 4,
  completed: 3,
  unfinished: 1,
  submitted: 4,
  resubmitted: 1,
  streak: 4,
};
