// Used only by the isolated H5 layout test. Never imported by the application.
const avatar = '/static/images/society-raven.png';
const society = { _id: 'society-a', name: '回车键诗社', school: '回车键大学', region: '上海', foundedAt: '2001-02-01',
  motto: '以诗友芳邻，无问西与东', description: '未名湖畔的诗歌共同体，民谣与诗的跨界现场是其传统。\n\n每周一起读诗，在校园里，为一句诗停留三秒。',
  avatarUrl: avatar, memberCount: 278, workCount: 897, eventCount: 4, callCount: 2, recruitment: 'open', following: true };
const events = [
  { _id: 'event-a', societyId: society._id, societyName: society.name, title: '秋分读诗会·九月的果实', category: '线下读诗会', statusLabel: '报名中', startTime: '2026-11-26T11:00:00Z', location: '回车键图书馆 403A', coverImage: avatar },
  { _id: 'event-b', societyId: society._id, societyName: society.name, title: '从意象到意象：新诗的翻译与被翻译', category: '讲座', statusLabel: '即将截止', location: '回车键图书馆 403A', coverImage: avatar },
  { _id: 'event-c', societyId: society._id, societyName: society.name, title: '格律新声：格律写作工作坊', category: '沙龙', statusLabel: '报名中', location: '回车键图书馆 403A', coverImage: avatar }
];
const calls = [{ _id: 'call-a', societyId: society._id, societyName: '回车键诗社 · HOLA诗社', title: '「秋分·城市与记忆」联合征稿', statusLabel: '征稿中', audience: 'all', deadline: '2026-11-10T15:59:00Z' }];
const signature = '/scripts/fixtures/society-signature.png';
const works = [
  { _id: 'poem-a', societyId: society._id, _openid: 'alice', authorName: '可以锕', authorAvatar: avatar, authorSignature: signature, content: '当我听到河哗哗作响\n岸上的声音自然就隐去了\n我转身淌入河水\n想趁分流前，牵住你的手', displayContent: '当我听到河哗哗作响\n岸上的声音自然就隐去了\n我转身淌入河水\n想趁分流前，牵住你的手', isPoem: true, backgroundColor: '#f1d5bf', textColor: '#594438', createTime: '2026-11-01', votes: 16, isVoted: true, commentCount: 3 },
  { _id: 'poem-b', societyId: society._id, _openid: 'bob', authorName: '小河', authorAvatar: '/static/images/avatar.png', content: '夜里有一盏灯\n照着晚归的人\n也照着等待的人', displayContent: '夜里有一盏灯\n照着晚归的人\n也照着等待的人', isPoem: true, backgroundColor: '#7e8969', textColor: '#ffffff', createTime: '2026-10-30' },
  { _id: 'poem-c', societyId: society._id, _openid: 'alice', authorName: '可以锕', authorAvatar: avatar, authorSignature: signature, content: '我们在树下写信\n把秋天寄给远方', displayContent: '我们在树下写信\n把秋天寄给远方', isPoem: true, backgroundColor: '#89463c', textColor: '#ffffff', createTime: '2026-10-29' }
];
const members = [{ userId: 'alice', nickName: '可以锕', avatarUrl: avatar, role: 'owner', joinedAt: '2026-09-01' }, { userId: 'bob', nickName: '小河', avatarUrl: '/static/images/avatar.png', role: 'member', joinedAt: '2026-10-01' }];
const requests = [{ _id: 'join-a', societyId: society._id, societyName: society.name, userId: 'reader', nickName: '某某某', avatarUrl: avatar, reason: '本校同学，喜欢写诗，希望和大家一起读诗、交流。', createdAt: '2026-11-01', revision: 1, status: 'pending' }];
const news = [{ _id: 'news-a', title: '以诗友芳邻，无问西与东', content: '欢迎来到回车键诗社。\n\n新的学期，一起读诗，一起写诗。', pinned: true, createdAt: '2026-11-01' }];
const application = { ...society, _id: 'application-a', phone: '13800000000', contactName: '可以锕', status: 'pending', revision: 1, submittedAt: '2026-11-01', proofFiles: [avatar], proofUrls: [avatar] };
module.exports = { society, events, calls, works, members, requests, news, application };
