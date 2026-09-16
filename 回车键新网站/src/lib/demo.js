import { dayKey } from "./poems";

export const demoUser = {
  nickName: "林间",
  poemId: "DEMO",
  bio: "把日子写短，把回声留长。\n偶尔写诗，常常望向窗外。",
  region: "杭州",
  avatarUrl: "",
  signatureUrl: "",
  following: 12,
  followers: 38,
};

const poems = [
  [
    "把日子写成诗",
    "把日子写短\n把回声留长\n\n在每一个寻常的傍晚\n给没说出口的话\n留下一行\n\n风从窗边经过\n没有带走什么\n只是替我\n翻了下一页",
    "林间",
    ["日常", "生活"],
  ],
  [
    "雨停以后",
    "雨停以后\n树叶还在下雨\n\n一只鸟\n把天空重新叫亮\n\n我们沿着湿漉漉的小路\n慢慢走回\n没有说完的昨天",
    "白水",
    ["自然"],
  ],
  [
    "留白",
    "总要留一点空白\n给迟到的春天\n\n给没有寄出的信\n给窗台上\n还不肯开花的植物\n\n也给你\n一个不用回答的\n下午",
    "林间",
    ["生活"],
  ],
  [
    "晚风来信",
    "晚风没有地址\n却敲了每一扇窗\n\n我把灯调暗一点\n让月亮\n也有地方坐",
    "陈渡",
    ["夜晚", "自然"],
  ],
  [
    "小小的事物",
    "我喜欢小小的事物\n一枚纽扣\n一盏灯\n一声很轻的晚安\n\n它们不解释世界\n只在世界太大的时候\n替我\n围出一点温暖",
    "南枝",
    ["日常"],
  ],
  [
    "九月的某一天",
    "日历又薄了一页\n树影长了一寸\n\n我在一杯茶里\n看见夏天\n慢慢沉下去\n\n而你说\n秋天适合重新开始",
    "林间",
    ["四季"],
  ],
  [
    "路过一片海",
    "路过一片海\n我没有带走贝壳\n\n只是从此\n每当我安静下来\n\n身体里\n就有潮汐",
    "屿",
    ["远方"],
  ],
  [
    "一盏灯的距离",
    "夜深以后\n对面的窗还亮着\n\n我们互不相识\n却用一盏灯的距离\n\n陪彼此\n再坐一会儿",
    "白水",
    ["夜晚"],
  ],
  [
    "等春天",
    "种下一粒种子\n就开始学会\n不催促\n\n有些答案\n需要整整一个冬天\n\n才能\n绿起来",
    "林间",
    ["四季", "自然"],
  ],
  [
    "无题",
    "如果词语也有影子\n我愿意站在\n你的名字下面\n\n躲一场\n很久以前的雨",
    "陈渡",
    ["关系"],
  ],
  [
    "慢慢",
    "慢慢地走\n才能听见\n鞋底和落叶的交谈\n\n慢慢地老\n才能把一条路\n走成故乡",
    "南枝",
    ["生活"],
  ],
  [
    "回车",
    "有时候\n停下来\n\n不是因为\n没有话说\n\n只是想让\n下一句话\n\n有一个\n新的开始",
    "林间",
    ["日常"],
  ],
  [
    "远行的人",
    "车站把人们\n折成不同的方向\n\n我把一句保重\n放进你的口袋\n\n等你走远\n它才开始发烫",
    "屿",
    ["远方", "关系"],
  ],
  [
    "窗",
    "窗是墙壁\n留给世界的信\n\n清晨拆开\n是鸟鸣\n\n夜里拆开\n是你",
    "白水",
    ["日常"],
  ],
  [
    "旧书店",
    "在一本旧书里\n找到一片旧叶子\n\n有人曾把秋天\n放在这里\n\n而我隔了很久\n才替他\n翻过这一季",
    "林间",
    ["四季"],
  ],
  [
    "空山",
    "山把名字藏进雾里\n溪水一路寻找\n\n我只在石头上坐了片刻\n就被青苔\n认作故人",
    "南枝",
    ["自然"],
  ],
  ["散步集", "", "林间", ["日常"]],
  [
    "风的形状",
    "风没有形状\n直到遇见\n一面晾着的床单\n\n思念也是\n直到你\n推开门",
    "陈渡",
    ["关系"],
  ],
];

// Original sample writing for interface review; never presented as App user data.
export const demoPosts = poems.map(([title, content, authorName, tags], i) => ({
  _id: `sample-${i + 1}`,
  title,
  content,
  authorName,
  tags,
  isPoem: true,
  isOriginal: true,
  createTime: new Date(Date.now() - i * 3 * 86400000).toISOString(),
  ...(i === 16
    ? {
        isSeries: true,
        seriesPoems: [
          {
            subtitle: "一 · 清晨",
            content: "出门时\n露水还没醒\n\n我把脚步\n放轻了一点",
          },
          {
            subtitle: "二 · 黄昏",
            content: "回来的时候\n影子比我先到家\n\n它坐在门口\n等了一整个下午",
          },
        ],
      }
    : {}),
}));

export function demoActivity(year) {
  const counts = {};
  for (const post of demoPosts.filter(
    (p) => p.authorName === demoUser.nickName,
  )) {
    const key = dayKey(post.createTime);
    if (key.startsWith(String(year))) counts[key] = (counts[key] || 0) + 1;
  }
  return counts;
}
