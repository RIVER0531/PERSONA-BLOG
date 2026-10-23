import type { GardenDatabase } from '../types/garden';

export const SEED_GARDEN_DATABASE: GardenDatabase = {
  version: 1,
  lastUpdated: '2026-10-23T08:00:00.000Z',
  profile: {
    gardenName: '栖迟园',
    gardenSubtitle: '林知夏的数字生活花园 · Personal Digital Garden',
    ownerName: '林知夏',
    ownerTitle: '独立写作者 · 慢行旅人 · 器物与胶片爱好者',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=600&q=80',
    signature: '衡门之下，可以栖迟；泌之洋洋，可以乐饥。把易逝的日常，种成长期生长的花园。',
    bio: '常居江南，偶尔进山。喜欢在纸页与光影之间记录微小而确切的瞬间。这里不追求算法与流量，只是一座缓慢生长、随时可以回来翻阅的私人生活档案室。',
    heroTitle: '在缓慢生长的文字与光影里，照见时间留下的年轮。',
    heroIntro:
      '欢迎来到我的数字花园。这里存放着我写下的长文手记、午后闪过的吉光片羽、走过的山川湖海，以及陪伴我度过四季的书籍、唱片与日常器物。',
    heroImage: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1400&q=80',
    heroQuote: '“植物从不着急开花，它们只是安静地把根扎进温暖的泥土里。”',
    seasonNote: '丙午年 · 霜降将至 · 桂花落尽，宜温酒夜读',
    currentLocation: '杭州 · 西溪南麓',
    currentReading: '《草木有趣：跟着二十四节气过日子》',
    currentListening: '坂本龙一 《async》 & 岸部真明指弹吉他',
    aboutContent: `
      <h2>一、为什么要建造这座数字花园</h2>
      <p>在社交媒体与短视频将时间切割成碎片的年代，我们的记忆似乎也随之变得轻飘。那些三年前写下的微博、五年前拍下的胶片、某次旅途中在火车上记下的只言片语，往往散落在不同平台的角落，甚至随着账号迁移或平台关停而悄然消失。</p>
      <p>因此，我决定为自己搭建这座名为<strong>「栖迟园」</strong>的个人空间。它不是为了迎合读者或搜索引擎而存在的媒体，而是一本真正属于我自己的、会随岁月不断生长的生活总集。</p>
      <blockquote>“衡门之下，可以栖迟。” —— 在简朴而安静的地方游息，不为外界的喧嚣所裹挟，认真对待自己度过的每一天。</blockquote>
      <h2>二、这里记录些什么</h2>
      <ul>
        <li><strong>长文手记（Articles）</strong>：记录旅行游记、阅读书评、器物长测，以及阶段性的人生复盘。</li>
        <li><strong>日常瞬间（Moments）</strong>：像夹在书页里的干花一样，随手保存一句话、一张窗台的照片或某个傍晚的云。</li>
        <li><strong>光影相册（Gallery）</strong>：按主题与季节整理的摄影集，留存中画幅与定焦镜头下的温度。</li>
        <li><strong>远行足迹（Travel）</strong>：标记走过的城市与山野，把地理坐标与当时的故事串联起来。</li>
        <li><strong>兴趣收藏（Collections）</strong>：整理长期使用的数码器物、反复翻阅的书籍、深夜看过的电影与黑胶唱片。</li>
      </ul>
      <h2>三、生活原则与偏爱</h2>
      <p>偏爱原木、亚麻、粗陶与纸张的质感；买少一点，但买能够陪伴五年以上的好物；每年至少有两次离开熟悉城市的慢行；保持手写日记与长文阅读的习惯。</p>
    `,
    interests: [
      '胶片与定焦摄影',
      '手冲咖啡与岩茶',
      '机械键盘与桌面器物',
      '山野徒步与古建寻访',
      '独立出版物与旧书店',
      '黑胶唱片收藏',
    ],
    socialLinks: [
      { label: '个人邮箱', url: 'mailto:zhixia@qichigarden.local', handle: 'zhixia@qichigarden.local' },
      { label: 'RSS 订阅', url: '/sitemap.xml', handle: '全站文章订阅源' },
      { label: 'GitHub', url: 'https://github.com', handle: '@linzhixia' },
    ],
    milestones: [
      {
        year: '2026',
        title: '建成「栖迟园」独立数字生活空间',
        description: '将过去五年的日记、摄影与器物收藏完整迁入自建花园，实现数据完全自主与长期归档。',
      },
      {
        year: '2025',
        title: '完成京都至濑户内海秋日漫行',
        description: '携一台定焦相机独行二十日，整理成三万字《秋日手记》与两册胶片影集。',
      },
      {
        year: '2024',
        title: '旅居大理喜洲与沙溪古镇',
        description: '在苍山脚下租下一座带院子的老木屋，度过了一个只听雨声、读书与烘焙的夏天。',
      },
      {
        year: '2022',
        title: '开始践行极简器物与慢记录生活',
        description: '告别信息流焦虑，重拾长文写作，开始系统整理每年的读书、观影与远行档案。',
      },
    ],
    homeModules: {
      showFeaturedArticles: true,
      showMoments: true,
      showGallery: true,
      showTravel: true,
      showCollections: true,
      showAlmanac: true,
    },
  },
  articles: [
    {
      id: 'art-kyoto-kamogawa',
      title: '在京都鸭川畔，重新学会无所事事的下午',
      slug: 'afternoon-by-the-kamogawa-river',
      excerpt:
        '没有紧锣密鼓的景点打卡，只带一册文库本和一杯热焙茶，从出町柳走到三条大桥。原来旅行最珍贵的部分，是允许自己浪费一整个下午的阳光。',
      coverImage:
        'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?auto=format&fit=crop&w=1400&q=80',
      content: `
        <p>十月中旬的京都，枫叶才刚刚在枝头染上一层极淡的赭石色。我刻意避开了清水寺与岚山的人潮，在出町柳站附近的一家百年果子铺买了两枚刚出炉的豆饼，顺着石阶走进鸭川三角洲。</p>
        <h2>一、跳乌龟石与河岸的节奏</h2>
        <p>高野川与贺茂川在这里汇合。河水清澈而平缓，水底的鹅卵石在秋日斜阳下泛着温润的光。几个放学的小学生背着沉甸甸的书包，轻巧地在乌龟形状的踏脚石上跳跃；不远处的草坪上，有人在吹萨克斯风，曲调断断续续，却一点也不惹人心烦。</p>
        <blockquote>在城市里生活久了，我们总是习惯把每一段空白的时间填满，仿佛停下来就是一种罪过。但在鸭川边，所有人都理直气壮地“无所事事”。</blockquote>
        <figure>
          <img src="https://images.unsplash.com/photo-1503899036084-c55cdd92da26?auto=format&fit=crop&w=1200&q=80" alt="京都街巷的秋日斜阳" />
          <figcaption>傍晚时分穿过木屋町通的暖光，空气里有淡淡的烘焙茶香。</figcaption>
        </figure>
        <h2>二、旧书店里的纸张气息</h2>
        <p>沿着河岸往南漫步，拐进寺町通的一家古本屋。木质书架一直延伸到天花板，老板是一位戴着圆框眼镜的老人，正用毛刷轻轻拂去画册封面的灰尘。我在角落里翻到一本昭和五十年出版的《草木染手帖》，内页夹着早已被压平的植物标本。</p>
        <h3>那些值得慢下来的瞬间</h3>
        <ul>
          <li>坐在河岸长椅上看鸢鸟在头顶盘旋，直到手里的热茶慢慢变温。</li>
          <li>走进没有招牌的街角咖啡馆，听主理人手摇磨豆机的沙沙声。</li>
          <li>在夜色降临时合上笔记本，不看手机地图，凭直觉走回住处。</li>
        </ul>
        <h2>三、把松弛感带回日常</h2>
        <p>真正让人眷恋的或许并非京都本身，而是我们在旅途中终于卸下了“必须高效”的盔甲。回到江南的小院后，我也试着在每个周六的下午关掉通知，泡一壶三年陈的寿眉，像坐在鸭川河畔那样，认真地看一会儿窗外树影的移动。</p>
      `,
      category: '远行漫记',
      tags: ['京都', '慢生活', '旅行随笔', '鸭川'],
      status: 'public',
      isPinned: true,
      isFeatured: true,
      location: '日本 · 京都鸭川',
      weather: '秋晴微风 · 19℃',
      createdAt: '2026-10-16T14:30:00.000Z',
      updatedAt: '2026-10-17T09:15:00.000Z',
    },
    {
      id: 'art-desk-instruments',
      title: '器物志：陪伴我三年的桌面书写与静电容键盘',
      slug: 'three-years-with-my-desk-instruments',
      excerpt:
        '好的工具应当像老朋友一样，在日复一日的摩挲中产生包浆与默契。记录我书桌上那些经受住时间考验的器物：胡桃木镇纸、黄铜钢笔与静电容键盘。',
      coverImage:
        'https://images.unsplash.com/photo-1499750310107-5fef28a66643?auto=format&fit=crop&w=1400&q=80',
      content: `
        <p>早些年我也曾热衷于追逐最新款的数码产品，每隔几个月便想更换桌面的配列。直到三年前搬进现在这间朝南的书房，我开始实行“一进一出”的原则：只有当一件器物真正融入每天的创作流程，它才值得留在桌面。</p>
        <h2>一、触感的延伸：为什么偏爱静电容与木质</h2>
        <p>对于每天要写下数千字的人来说，指尖的反馈直接决定了思考的流淌速度。我最终留下的是雪白无刻版本的静电容键盘。45克的压力克数恰到好处，既没有青轴的喧闹，也没有薄膜的粘滞，敲击声如同雨滴落在厚实的纸面。</p>
        <blockquote>器物的最高境界不是炫耀参数，而是在你专注思考时彻底“隐形”，在你停笔凝神时又给予温润的触觉安慰。</blockquote>
        <h2>二、纸笔与屏幕的共生</h2>
        <p>尽管绝大部分成稿都在电脑上完成，我依然保留着在巴川纸笔记本上列提纲的习惯。黄铜笔杆随着三年来的握持，表面已经褪去了最初刺眼的金属光泽，沉淀出柔和的琥珀色泽。</p>
        <h3>目前书桌的常驻清单</h3>
        <ol>
          <li><strong>北美黑胡桃木实木桌面</strong>：每年入冬前涂抹一次蜂蜡油，木纹愈发温润。</li>
          <li><strong>HHKB Professional Hybrid Type-S</strong>：安静、克制、几乎不需要离开主键区。</li>
          <li><strong>手作粗陶咖啡杯</strong>：来自景德镇朋友柴烧窑口，握感厚实。</li>
        </ol>
      `,
      category: '器物与生活',
      tags: ['桌面器物', '机械键盘', '书写工具', '极简生活'],
      status: 'public',
      isPinned: false,
      isFeatured: true,
      location: '杭州 · 书房',
      weather: '阴转多云 · 21℃',
      createdAt: '2026-09-28T20:10:00.000Z',
      updatedAt: '2026-09-29T11:00:00.000Z',
    },
    {
      id: 'art-dali-rainy-season',
      title: '大理喜洲的雨季：把日子泡在一杯手冲里',
      slug: 'rainy-season-in-xizhou-dali',
      excerpt:
        '七月的大理，云层总是压得很低。在喜洲田野边的小院里听雨落瓦当，看绿油油的稻浪翻滚，时间在这里有了一套截然不同的度量衡。',
      coverImage:
        'https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=1400&q=80',
      content: `
        <p>很多人喜欢大理冬天的灿烂阳光，但我却偏爱七八月的雨季。每天午后三点，苍山顶上便会准时聚起浓重的铅灰色云团，紧接着是一场痛快淋漓的阵雨，把青石板路洗得发亮。</p>
        <h2>一、瓦檐下的听雨时刻</h2>
        <p>小院正对着一大片正在抽穗的稻田。雨点打在芭蕉叶和老瓦片上，发出深浅不一的白噪音。我通常在这时候烧一壶山泉水，称取二十克云南保山日晒豆，看着热水注入粉层时缓缓鼓起的“汉堡包”，满屋都是发酵果香与焦糖的暖意。</p>
        <h2>二、集市里的菌子与鲜花</h2>
        <p>雨停之后的傍晚最适合去逛农贸市集。背着竹篓的阿嬢把刚从山里捡来的见手青、松茸和鸡枞摆在芭蕉叶上，泥土的芬芳扑面而来。花五块钱买一大把带着露水的洋甘菊和尤加利叶，插在喝完的玻璃牛奶瓶里，整个房间就有了生机。</p>
      `,
      category: '山居随笔',
      tags: ['大理', '喜洲', '手冲咖啡', '雨季'],
      status: 'public',
      isPinned: false,
      isFeatured: true,
      location: '云南 · 大理喜洲',
      weather: '阵雨初晴 · 23℃',
      createdAt: '2026-08-12T16:45:00.000Z',
      updatedAt: '2026-08-12T16:45:00.000Z',
    },
    {
      id: 'art-digital-garden-notes',
      title: '数字花园建造手记：为什么我不再追逐算法与信息流',
      slug: 'why-i-built-a-personal-digital-garden',
      excerpt:
        '博客不是按时间倒序掩埋旧文的流水线，而是一座可以反复修剪、彼此连接的花园。谈谈我对个人数字资产、长期主义与慢写作的理解。',
      coverImage:
        'https://images.unsplash.com/photo-1455390582262-044cdead277a?auto=format&fit=crop&w=1400&q=80',
      content: `
        <p>“数字花园（Digital Garden）”这个概念最吸引我的地方，在于它打破了传统社交媒体“即发即忘”的宿命。在花园里，每一篇文章、每一条瞬间、每一处足迹都不是孤岛，而是随着年份推移不断丰满的记忆脉络。</p>
        <h2>一、对抗数字失忆症</h2>
        <p>当我们把所有生活记录托管给算法平台时，我们往往为了点赞而修饰表达。而在完全属于自己的空间里，我可以诚实地写下当下的困惑，可以把半成品放在草稿箱慢慢打磨，也可以将私密的心事设为仅自己可见。</p>
        <h2>二、数据自主与长期可读</h2>
        <p>十年之后，流行的前端框架或许会更替，但文字、照片与结构化的数据备份将始终完整留存。这也是我坚持为这座花园配备完整导出与备份机制的原因。</p>
      `,
      category: '思考与记录',
      tags: ['数字花园', '慢写作', '独立博客', '长期主义'],
      status: 'public',
      isPinned: false,
      isFeatured: false,
      location: '杭州 · 西溪',
      weather: '晴朗 · 24℃',
      createdAt: '2026-06-05T11:20:00.000Z',
      updatedAt: '2026-06-06T09:00:00.000Z',
    },
    {
      id: 'art-private-winter-reflection',
      title: '冬日私人书单与年末深夜自省（仅园主可见）',
      slug: 'private-winter-reflections',
      excerpt:
        '这是一篇设为「私人」状态的年度复盘手札，记录了今年在创作、家庭与财务上的真实得失，仅在管理员登录后可见。',
      coverImage:
        'https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&w=1200&q=80',
      content: `
        <p>这篇手记设为<strong>私人状态</strong>，对外公开访问时会自动由服务端过滤隐藏。在这里我可以毫无保留地整理今年的私人目标与内心波动。</p>
        <h2>一、学会与不确定性共处</h2>
        <p>今年最大的收获是不再强求所有计划都按部就班。允许自己在春天偷懒，也允许自己在秋天重新出发。</p>
        <h2>二、明年给自己的三个小约定</h2>
        <ul>
          <li>每周至少给父母打一次超过半小时的电话。</li>
          <li>坚持把每年拍下的照片洗印成一册实体摄影集。</li>
          <li>读完书架上那套一直没拆封的《河合隼雄著作集》。</li>
        </ul>
      `,
      category: '私密手札',
      tags: ['年度自省', '私人笔记'],
      status: 'private',
      isPinned: false,
      isFeatured: false,
      location: '杭州 · 书房',
      weather: '夜雨 · 12℃',
      createdAt: '2026-10-19T23:10:00.000Z',
      updatedAt: '2026-10-19T23:10:00.000Z',
    },
    {
      id: 'art-draft-autumn-tea',
      title: '【草稿】深秋武夷山寻茶记：岩骨花香里的焙火慢功',
      slug: 'draft-wuyi-tea-journey',
      excerpt:
        '正在整理上周去武夷山三坑两涧拜访制茶师的录音与胶片，待配图整理完毕后正式发布。',
      coverImage:
        'https://images.unsplash.com/photo-1544787219-7f47ccb76574?auto=format&fit=crop&w=1200&q=80',
      content: `
        <p>（草稿整理中……）</p>
        <h2>一、清晨的慧苑坑</h2>
        <p>雾气还没有散尽，青石板路上满是青苔。老茶农说，好茶是天、地、人共同耐心的结果……</p>
      `,
      category: '器物与生活',
      tags: ['乌龙茶', '武夷山', '草稿'],
      status: 'draft',
      isPinned: false,
      isFeatured: false,
      location: '福建 · 武夷山',
      weather: '晨雾 · 16℃',
      createdAt: '2026-10-22T18:00:00.000Z',
      updatedAt: '2026-10-22T18:00:00.000Z',
    },
  ],
  moments: [
    {
      id: 'mom-1',
      content:
        '霜降前的最后一个晴天。把晒过一整天太阳的亚麻床单收进屋里，整间卧室都是阳光和晒干植物的味道。幸福有时候真的很具体。',
      images: [
        'https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=900&q=80',
      ],
      tags: ['日常', '节气', '阳光'],
      mood: '松弛而满足',
      weather: '秋晴 · 20℃',
      location: '杭州 · 小院',
      status: 'public',
      createdAt: '2026-10-22T16:20:00.000Z',
    },
    {
      id: 'mom-2',
      content:
        '新到了一袋埃塞俄比亚古吉的浅烘豆子，用 91℃ 的水慢冲，尾段竟然有很清晰的佛手柑和白桃香气。配着窗外的落叶读完了《山之四季》的第三章。',
      images: [
        'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=900&q=80',
        'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=900&q=80',
      ],
      tags: ['手冲咖啡', '阅读', '午后'],
      mood: '安静专注',
      weather: '微风 · 18℃',
      location: '书房窗边',
      status: 'public',
      createdAt: '2026-10-18T15:05:00.000Z',
    },
    {
      id: 'mom-3',
      content:
        '去植物园散步，捡到几颗刚落下的橡果和一片形状完整的银杏叶。带回来放在胡桃木笔盘里，算是把秋天请进了书桌。',
      images: [
        'https://images.unsplash.com/photo-1507652313519-d4e9174996dd?auto=format&fit=crop&w=900&q=80',
      ],
      tags: ['散步', '植物园', '拾秋'],
      mood: '欢喜',
      weather: '多云 · 17℃',
      location: '杭州植物园',
      status: 'public',
      createdAt: '2026-10-11T17:40:00.000Z',
    },
    {
      id: 'mom-4',
      content:
        '偶尔也会有完全写不出东西的夜晚。不勉强自己，煮了一小锅热牛奶加肉桂粉，听了一整张比尔·埃文斯的爵士钢琴。明天太阳照常升起。',
      images: [],
      tags: ['夜读', '爵士乐', '随想'],
      mood: '平静',
      weather: '夜凉 · 14℃',
      location: '家中',
      status: 'public',
      createdAt: '2026-09-30T22:50:00.000Z',
    },
    {
      id: 'mom-5-private',
      content:
        '【私人瞬间】记一下爷爷老宅院子里那棵百年桂花树的移栽养护方案，下个月回老家时记得联系林场的陈师傅。',
      images: [],
      tags: ['备忘', '家人'],
      mood: '记挂',
      weather: '晴',
      location: '私人备忘',
      status: 'private',
      createdAt: '2026-10-20T09:00:00.000Z',
    },
  ],
  albums: [
    {
      id: 'alb-kyoto-autumn',
      title: '鸭川与古寺的秋日切片',
      description: '带着 35mm 定焦镜头在京都漫步的十天。不追逐著名景点，只记录清晨的苔庭、傍晚的河岸与街角温柔的暖帘。',
      coverImage:
        'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?auto=format&fit=crop&w=1000&q=80',
      category: '旅行摄影',
      location: '日本 · 京都',
      date: '2026-10-15',
      status: 'public',
      createdAt: '2026-10-15T12:00:00.000Z',
      photos: [
        {
          id: 'ph-1',
          url: 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?auto=format&fit=crop&w=1400&q=80',
          title: '岚山清晨的薄雾与远山',
          caption: '早上六点半的渡月桥畔，只有流水声与清冽的空气。',
          takenAt: '2026-10-12',
          camera: 'Fujifilm X100VI',
          lens: '23mm f/2 (等效 35mm)',
          location: '京都 · 岚山',
        },
        {
          id: 'ph-2',
          url: 'https://images.unsplash.com/photo-1503899036084-c55cdd92da26?auto=format&fit=crop&w=1400&q=80',
          title: '木屋町通的傍晚暖灯',
          caption: '天色将暗未暗之时，纸灯笼亮起的瞬间最让人心动。',
          takenAt: '2026-10-13',
          camera: 'Fujifilm X100VI',
          lens: '23mm f/2',
          location: '京都 · 先斗町',
        },
        {
          id: 'ph-3',
          url: 'https://images.unsplash.com/photo-1528164344705-475426879c0d?auto=format&fit=crop&w=1400&q=80',
          title: '古寺庭院的青苔与石灯笼',
          caption: '雨后的青苔仿佛会呼吸，呈现出深浅交织的鼠尾草绿与祖母绿。',
          takenAt: '2026-10-14',
          camera: 'Leica M10-P',
          lens: 'Summicron 50mm f/2',
          location: '京都 · 南禅寺',
        },
      ],
    },
    {
      id: 'alb-dali-clouds',
      title: '苍山洱海与喜洲稻浪',
      description: '在大理旅居的那个夏天，每天醒来第一件事就是看苍山上的云今天是什么形状。',
      coverImage:
        'https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=1000&q=80',
      category: '山野自然',
      location: '云南 · 大理',
      date: '2026-08-10',
      status: 'public',
      createdAt: '2026-08-10T10:00:00.000Z',
      photos: [
        {
          id: 'ph-4',
          url: 'https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=1400&q=80',
          title: '山谷里的晨光与薄雾',
          caption: '雨季间隙的清晨，阳光穿过云层照亮整片山谷。',
          takenAt: '2026-08-05',
          camera: 'Ricoh GR IIIx',
          lens: '40mm f/2.8',
          location: '大理 · 喜洲',
        },
        {
          id: 'ph-5',
          url: 'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?auto=format&fit=crop&w=1400&q=80',
          title: '沙溪古镇外的林间漫步',
          caption: '没有商业喧嚣的午后，只有松针落地的气息。',
          takenAt: '2026-08-08',
          camera: 'Ricoh GR IIIx',
          lens: '40mm f/2.8',
          location: '大理 · 沙溪',
        },
      ],
    },
    {
      id: 'alb-desk-still-life',
      title: '书房四季 · 器物静物集',
      description: '记录日常陪伴我的纸笔、陶器、咖啡器具与窗台植物的光影变化。',
      coverImage:
        'https://images.unsplash.com/photo-1499750310107-5fef28a66643?auto=format&fit=crop&w=1000&q=80',
      category: '日常静物',
      location: '杭州 · 栖迟书房',
      date: '2026-09-25',
      status: 'public',
      createdAt: '2026-09-25T14:00:00.000Z',
      photos: [
        {
          id: 'ph-6',
          url: 'https://images.unsplash.com/photo-1499750310107-5fef28a66643?auto=format&fit=crop&w=1400&q=80',
          title: '午后三点的胡桃木书桌',
          caption: '百叶窗把秋日的阳光切成温柔的平行线。',
          takenAt: '2026-09-20',
          camera: 'Fujifilm GFX 50S II',
          lens: 'GF 50mm f/3.5',
          location: '书房',
        },
        {
          id: 'ph-7',
          url: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=1400&q=80',
          title: '手冲壶与粗陶分享杯',
          caption: '每天早晨开启写作前的固定仪式。',
          takenAt: '2026-09-22',
          camera: 'Fujifilm GFX 50S II',
          lens: 'GF 50mm f/3.5',
          location: '书房茶席',
        },
      ],
    },
  ],
  travels: [
    {
      id: 'trv-kyoto',
      destination: '京都 · 鸭川与洛北古寺',
      region: '关西地区',
      country: '日本',
      coordinates: { x: 78, y: 42, lat: 35.0116, lng: 135.7681 },
      startDate: '2026-10-10',
      endDate: '2026-10-18',
      summary: '在初秋的微风里沿着鸭川漫步，探访大原三千院的青苔与寺町通的旧书店。',
      story:
        '这是第三次来到京都，却是最从容的一次。住在出町柳附近的一栋百年町屋，每天早晨被乌鸦的叫声和隔壁豆腐店的水声唤醒。没有列出任何必去的打卡清单，只是顺着河流的方向行走，在哲学之道的独立书店里买到了绝版的手工造纸图录。',
      coverImage:
        'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?auto=format&fit=crop&w=1000&q=80',
      photos: [
        'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?auto=format&fit=crop&w=900&q=80',
        'https://images.unsplash.com/photo-1503899036084-c55cdd92da26?auto=format&fit=crop&w=900&q=80',
      ],
      relatedArticleId: 'art-kyoto-kamogawa',
      relatedAlbumId: 'alb-kyoto-autumn',
      tags: ['古寺', '旧书店', '鸭川', '秋行'],
      status: 'public',
      createdAt: '2026-10-16T00:00:00.000Z',
    },
    {
      id: 'trv-dali',
      destination: '大理 · 喜洲稻田与沙溪古镇',
      region: '滇西北',
      country: '中国',
      coordinates: { x: 46, y: 62, lat: 25.6065, lng: 100.2676 },
      startDate: '2026-08-01',
      endDate: '2026-08-20',
      summary: '在雨季的苍山脚下小住二十日，看稻浪由翠绿渐变为金黄，逛晨间菌子市集。',
      story:
        '在喜洲染衣巷租下一间看得见稻田的二层木楼。每天上午写稿，下午听雨，傍晚骑着单车沿着海舌生态公园吹风。后来又乘大巴翻越山路去沙溪住了五天，在玉津桥上看清晨的马帮走过薄雾。',
      coverImage:
        'https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=1000&q=80',
      photos: [
        'https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=900&q=80',
        'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?auto=format&fit=crop&w=900&q=80',
      ],
      relatedArticleId: 'art-dali-rainy-season',
      relatedAlbumId: 'alb-dali-clouds',
      tags: ['旅居', '喜洲', '沙溪', '雨季'],
      status: 'public',
      createdAt: '2026-08-15T00:00:00.000Z',
    },
    {
      id: 'trv-altay',
      destination: '阿勒泰 · 禾木与喀纳斯深秋',
      region: '新疆北疆',
      country: '中国',
      coordinates: { x: 26, y: 24, lat: 48.55, lng: 87.43 },
      startDate: '2025-09-22',
      endDate: '2025-10-03',
      summary: '在北疆的白桦林全部变成金黄色的时候，住进图瓦人的小木屋，看炊烟与晨雾交织。',
      story:
        '九月底的禾木已经需要穿上厚羊毛衫。清晨爬上哈登平台，看着整座村庄笼罩在乳白色的晨雾里，马群安静地在河谷饮水。夜晚完全没有光污染，抬头便是横跨天际的清晰银河。',
      coverImage:
        'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1000&q=80',
      photos: [
        'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=900&q=80',
      ],
      tags: ['北疆', '白桦林', '徒步', '秋色'],
      status: 'public',
      createdAt: '2025-10-03T00:00:00.000Z',
    },
    {
      id: 'trv-chiangmai',
      destination: '清迈 · 素贴山麓的手作村落',
      region: '泰北',
      country: '泰国',
      coordinates: { x: 42, y: 78, lat: 18.7883, lng: 98.9853 },
      startDate: '2025-01-15',
      endDate: '2025-01-28',
      summary: '避开寒冬，在泰北的阳光、陶艺工坊与森林咖啡馆里度过温暖的半个月。',
      story:
        '在 Baan Kang Wat 艺术村认识了一位做柴烧陶器的主理人，每天坐在大树下喝冰滴咖啡，逛周末的农夫市集，买到了手工织造的蓝染棉麻衬衫。',
      coverImage:
        'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1000&q=80',
      photos: [
        'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=900&q=80',
      ],
      tags: ['清迈', '手作市集', '冬日旅居'],
      status: 'public',
      createdAt: '2025-01-28T00:00:00.000Z',
    },
  ],
  collections: [
    {
      id: 'col-gear-x100vi',
      title: 'Fujifilm X100VI 旁轴数码相机',
      creator: '富士胶片 Fujifilm',
      category: 'gear',
      categoryLabel: '数码与器物',
      coverImage:
        'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=800&q=80',
      rating: 5,
      review:
        '银黑复古机身配固定的等效 35mm 镜头，让我彻底告别了更换镜头的焦虑。内置的 Classic Neg 与 Reala Ace 胶片模拟色彩温润自然，几乎不需要繁琐后期就能还原肉眼所见的空气感。',
      experienceNote: '已陪伴拍摄 8,400 余张照片 · 搭配黄铜快门按钮与牛皮腕带',
      specsOrMeta: '4020万像素 · 等效35mm F2 · 机身防抖',
      tags: ['随身相机', '35mm定焦', '胶片模拟'],
      recordedDate: '2026-04-12',
      status: 'public',
      favorite: true,
      createdAt: '2026-04-12T00:00:00.000Z',
    },
    {
      id: 'col-gear-hhkb',
      title: 'HHKB Professional Hybrid Type-S 雪白无刻',
      creator: 'PFU Limited',
      category: 'gear',
      categoryLabel: '数码与器物',
      coverImage:
        'https://images.unsplash.com/photo-1587829741301-dc798b83add3?auto=format&fit=crop&w=800&q=80',
      rating: 5,
      review:
        '长文写作的最佳伴侣。静电容结构带来的柔和触底反馈，即便连续码字三个小时手指也不会疲惫。无刻键帽让桌面视觉极度纯净。',
      experienceNote: '主力写作键盘 · 已连续使用 3 年',
      specsOrMeta: '静电容 45g · 60配列 · 蓝牙多设备',
      tags: ['静电容', '写作工具', '桌面美学'],
      recordedDate: '2026-09-28',
      status: 'public',
      favorite: true,
      createdAt: '2026-09-28T00:00:00.000Z',
    },
    {
      id: 'col-film-perfect-days',
      title: '完美的日子 Perfect Days',
      creator: '维姆·文德斯 / 役所广司',
      category: 'film',
      categoryLabel: '光影电影',
      coverImage:
        'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=800&q=80',
      rating: 5,
      review:
        '平山先生每天清晨推开门仰望天空的微笑、用老式奥林巴斯胶片机拍下的树影（Komorebi）、车里流淌的卡带老歌。真正的诗意不在远方，而在对重复日常的郑重对待。',
      experienceNote: '在一个下雨的周五深夜独自看完，内心久久平静。',
      specsOrMeta: '2023 · 日本/德国 · 124分钟',
      tags: ['日常诗意', '东京', '木漏日', '年度十佳'],
      recordedDate: '2026-05-20',
      status: 'public',
      favorite: true,
      createdAt: '2026-05-20T00:00:00.000Z',
    },
    {
      id: 'col-film-little-forest',
      title: '小森林 夏秋篇 & 冬春篇',
      creator: '森淳一 / 桥本爱',
      category: 'film',
      categoryLabel: '光影电影',
      coverImage:
        'https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=800&q=80',
      rating: 5,
      review:
        '每当觉得生活节奏太快时就会重温的一部电影。顺应节气耕作、采摘胡颓子煮果酱、在雪夜烤面包。认真做好一顿饭，就是对生命最好的诚意。',
      experienceNote: '已重温四遍 · 启发了我自己的厨房记录',
      specsOrMeta: '2014-2015 · 日本 · 四季篇章',
      tags: ['山居生活', '节气料理', '治愈'],
      recordedDate: '2025-11-10',
      status: 'public',
      favorite: true,
      createdAt: '2025-11-10T00:00:00.000Z',
    },
    {
      id: 'col-book-walden',
      title: '瓦尔登湖（仲泽 Scenery 评注珍藏本）',
      creator: '亨利·戴维·梭罗',
      category: 'book',
      categoryLabel: '枕边书册',
      coverImage:
        'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=800&q=80',
      rating: 5,
      review:
        '“我步入丛林，因为我希望生活得有意义，我希望活得深刻，并汲取生命中所有的精华。” 每次翻开，都能在梭罗清澈而坚定的文字里洗去浮躁。',
      experienceNote: '床头常备书，书页空白处记满了三年来的铅笔批注',
      specsOrMeta: '自然文学 · 散文经典',
      tags: ['自然主义', '独处', '经典重读'],
      recordedDate: '2026-03-14',
      status: 'public',
      favorite: true,
      createdAt: '2026-03-14T00:00:00.000Z',
    },
    {
      id: 'col-book-plants',
      title: '草木有趣：跟着二十四节气过日子',
      creator: '殷若衿',
      category: 'book',
      categoryLabel: '枕边书册',
      coverImage:
        'https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&w=800&q=80',
      rating: 4,
      review:
        '从立春的迎春花到冬至的蜡梅，作者用细腻的博物学视角与传统生活美学，把江南的草木风物写得活色生香。',
      experienceNote: '今年秋天的案头伴读书籍',
      specsOrMeta: '生活美学 · 二十四节气',
      tags: ['植物博物', '节气', '江南风物'],
      recordedDate: '2026-10-02',
      status: 'public',
      favorite: false,
      createdAt: '2026-10-02T00:00:00.000Z',
    },
    {
      id: 'col-music-async',
      title: 'async（日版双黑胶 LP 唱片）',
      creator: '坂本龙一 Ryuichi Sakamoto',
      category: 'music',
      categoryLabel: '黑胶与音乐',
      coverImage:
        'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=800&q=80',
      rating: 5,
      review:
        '教授大病初愈后与世界重新对话的杰作。合成器的长音、雨声采样、踏入水洼的脚步声与塔可夫斯基的诗句交织在一起，像是时间本身的呼吸。',
      experienceNote: '深夜写作时最常放在唱机上的一张唱片，偏爱《andata》与《ZURE》',
      specsOrMeta: '2017 · 氛围音乐 / 现代古典 · 180g 黑胶',
      tags: ['坂本龙一', '黑胶唱片', '氛围音乐'],
      recordedDate: '2026-07-19',
      status: 'public',
      favorite: true,
      createdAt: '2026-07-19T00:00:00.000Z',
    },
    {
      id: 'col-site-solar',
      title: 'LOW←TECH MAGAZINE 太阳能网站',
      creator: 'Kris De Decker',
      category: 'site',
      categoryLabel: '网站与工具',
      coverImage:
        'https://images.unsplash.com/photo-1457369804613-52c61a468e7d?auto=format&fit=crop&w=800&q=80',
      rating: 5,
      review:
        '一个完全由巴塞罗那阳台上的太阳能电池板供电运行的独立网站。抖动处理的复古图片、极致的轻量设计，完美诠释了技术应当服务于自然与可持续性。',
      experienceNote: '我设计「栖迟园」时的重要精神灵感来源之一',
      specsOrMeta: '独立出版 · 可持续网页设计',
      externalLink: 'https://solar.lowtechmagazine.com',
      tags: ['独立网站', '有机设计', '慢科技'],
      recordedDate: '2026-06-01',
      status: 'public',
      favorite: true,
      createdAt: '2026-06-01T00:00:00.000Z',
    },
  ],
  customCategories: {
    articleCategories: ['远行漫记', '器物与生活', '山居随笔', '思考与记录', '私密手札', '生活杂记'],
    collectionCategories: [
      { id: 'gear', label: '数码与器物' },
      { id: 'film', label: '光影电影' },
      { id: 'book', label: '枕边书册' },
      { id: 'music', label: '黑胶与音乐' },
      { id: 'site', label: '网站与工具' },
    ],
  },
};
