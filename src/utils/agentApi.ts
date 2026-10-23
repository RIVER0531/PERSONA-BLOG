import type { GardenDatabase } from '../types/garden';

/**
 * Automatically converts Markdown or plain text written by ChatGPT / AI agents
 * into clean semantic HTML for the blog reader, while preserving existing HTML if already formatted.
 */
export function convertMarkdownOrTextToHtml(raw: string): string {
  if (!raw || !raw.trim()) return '<p></p>';
  const trimmed = raw.trim();

  // If it already looks like structured HTML (contains <p>, <h2>, <h3>, <ul>, <blockquote>, <div>), keep as is
  if (/<(p|h[1-6]|ul|ol|blockquote|div|figure|img)\b/i.test(trimmed)) {
    return trimmed;
  }

  const formatInline = (text: string): string => {
    return text
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(
        /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
        '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>'
      );
  };

  const lines = trimmed.split(/\r?\n/);
  const htmlBlocks: string[] = [];
  let currentList: string[] = [];
  let currentParagraph: string[] = [];

  const flushList = () => {
    if (currentList.length > 0) {
      htmlBlocks.push(
        `<ul>${currentList.map((item) => `<li>${formatInline(item)}</li>`).join('')}</ul>`
      );
      currentList = [];
    }
  };

  const flushParagraph = () => {
    if (currentParagraph.length > 0) {
      htmlBlocks.push(`<p>${formatInline(currentParagraph.join(' '))}</p>`);
      currentParagraph = [];
    }
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      flushList();
      flushParagraph();
      continue;
    }

    // Markdown image: ![alt](url)
    const imgMatch = line.match(/^!\[([^\]]*)\]\((https?:\/\/[^\s)]+|\/uploads\/[^\s)]+)\)$/);
    if (imgMatch) {
      flushList();
      flushParagraph();
      const alt = imgMatch[1] || '插图';
      const url = imgMatch[2];
      htmlBlocks.push(
        `<figure><img src="${url}" alt="${alt}" /><figcaption>${alt}</figcaption></figure>`
      );
      continue;
    }

    // Headings
    if (line.startsWith('### ')) {
      flushList();
      flushParagraph();
      htmlBlocks.push(`<h3>${formatInline(line.slice(4).trim())}</h3>`);
      continue;
    }
    if (line.startsWith('## ')) {
      flushList();
      flushParagraph();
      htmlBlocks.push(`<h2>${formatInline(line.slice(3).trim())}</h2>`);
      continue;
    }
    if (line.startsWith('# ')) {
      flushList();
      flushParagraph();
      htmlBlocks.push(`<h2>${formatInline(line.slice(2).trim())}</h2>`);
      continue;
    }

    // Blockquote
    if (line.startsWith('> ')) {
      flushList();
      flushParagraph();
      htmlBlocks.push(`<blockquote>${formatInline(line.slice(2).trim())}</blockquote>`);
      continue;
    }

    // Unordered list item
    if (/^[-*+]\s+/.test(line)) {
      flushParagraph();
      currentList.push(line.replace(/^[-*+]\s+/, '').trim());
      continue;
    }

    // Standard paragraph line
    flushList();
    currentParagraph.push(line);
  }

  flushList();
  flushParagraph();

  return htmlBlocks.join('\n');
}

/**
 * Generates a concise overview of the current blog database for ChatGPT / AI agents
 * so the agent knows existing IDs, categories, titles, and site settings before editing.
 */
export function buildAgentOverview(db: GardenDatabase, baseUrl: string) {
  return {
    siteUrl: baseUrl,
    lastUpdated: db.lastUpdated,
    profile: {
      gardenName: db.profile.gardenName,
      gardenSubtitle: db.profile.gardenSubtitle ?? '',
      footerText: db.profile.footerText ?? '',
      ownerName: db.profile.ownerName,
      ownerTitle: db.profile.ownerTitle,
      signature: db.profile.signature,
      bio: db.profile.bio,
      heroTitle: db.profile.heroTitle,
      heroIntro: db.profile.heroIntro,
      heroQuote: db.profile.heroQuote,
      seasonNote: db.profile.seasonNote,
      currentLocation: db.profile.currentLocation,
      currentReading: db.profile.currentReading,
      currentListening: db.profile.currentListening,
      interests: db.profile.interests,
      homeModules: db.profile.homeModules,
      sectionTitles: db.profile.sectionTitles || {},
    },
    categories: db.customCategories,
    articles: db.articles.map((a) => ({
      id: a.id,
      title: a.title,
      category: a.category,
      tags: a.tags,
      status: a.status,
      isPinned: a.isPinned,
      isFeatured: a.isFeatured,
      excerpt: a.excerpt,
      createdAt: a.createdAt,
      updatedAt: a.updatedAt,
    })),
    moments: db.moments.map((m) => ({
      id: m.id,
      content: m.content,
      mood: m.mood,
      location: m.location,
      tags: m.tags,
      status: m.status,
      createdAt: m.createdAt,
    })),
    albums: db.albums.map((al) => ({
      id: al.id,
      title: al.title,
      category: al.category,
      location: al.location,
      date: al.date,
      photoCount: al.photos.length,
      status: al.status,
    })),
    travels: db.travels.map((t) => ({
      id: t.id,
      destination: t.destination,
      region: t.region,
      country: t.country,
      startDate: t.startDate,
      endDate: t.endDate,
      summary: t.summary,
      status: t.status,
    })),
    collections: db.collections.map((c) => ({
      id: c.id,
      title: c.title,
      creator: c.creator,
      category: c.category,
      categoryLabel: c.categoryLabel,
      rating: c.rating,
      review: c.review,
      status: c.status,
    })),
  };
}

/**
 * Generates an OpenAPI 3.1.0 specification so ChatGPT (Custom GPT Actions)
 * can import all blog management capabilities via URL or JSON paste.
 */
export function buildOpenApiSpec(baseUrl: string, gardenName: string) {
  const cleanUrl = baseUrl.replace(/\/+$/, '');
  return {
    openapi: '3.1.0',
    info: {
      title: `${gardenName || '个人数字花园'} · AI 内容总编接管 API`,
      description:
        '用于供 ChatGPT / AI Agent 全权接管个人数字博客的内容创作与管理，支持直接撰写与修改长文手记（自动支持 Markdown 转富文本）、发布日常瞬间、管理相册、点亮旅行足迹、收录兴趣藏品以及修改全站标题与配置。',
      version: '2.0.0',
    },
    servers: [
      {
        url: cleanUrl,
        description: '个人数字博客正式生产环境 API 服务器',
      },
    ],
    components: {
      securitySchemes: {
        BearerAuth: {
          type: 'http',
          scheme: 'bearer',
          description: '在后台「ChatGPT / AI 接入」页面获取的专属永久 API Key (gdn_live_...)',
        },
      },
    },
    security: [{ BearerAuth: [] }],
    paths: {
      '/api/agent/overview': {
        get: {
          operationId: 'getGardenOverview',
          summary: '获取全站结构化概览（站点设置、分类、已有文章/瞬间/足迹/收藏列表及ID）',
          description:
            '在执行修改或续写前调用此接口，了解当前站点名称、分类列表以及已有内容的 ID。',
          responses: {
            '200': {
              description: '成功返回全站概览数据',
              content: {
                'application/json': {
                  schema: { type: 'object' },
                },
              },
            },
          },
        },
      },
      '/api/agent/execute': {
        post: {
          operationId: 'executeAgentBatchAction',
          summary: 'AI 全能一键代管接口（支持单次或批量发文、发瞬间、改配置、加足迹、加收藏）',
          description:
            '最推荐使用的全能接口。可以在一次请求中同时完成修改站点文案、发布新文章（支持 Markdown）、发布瞬间、添加旅行足迹或兴趣收藏。',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    updateProfile: {
                      type: 'object',
                      description: '可选：修改站点名称、顶部副标题、底部文字、首页标题、个人资料或关于页正文',
                      properties: {
                        gardenName: { type: 'string', description: '顶部站点名称' },
                        gardenSubtitle: {
                          type: 'string',
                          description: '顶部站点副标题（传空字符串则隐藏）',
                        },
                        footerText: {
                          type: 'string',
                          description: '网页底部自定义文字（传空字符串则隐藏）',
                        },
                        ownerName: { type: 'string', description: '博主名字' },
                        ownerTitle: { type: 'string', description: '博主头衔/简介标签' },
                        signature: { type: 'string', description: '个人签名' },
                        bio: { type: 'string', description: '个人简介段落' },
                        heroTitle: { type: 'string', description: '首页主视觉大标题' },
                        heroIntro: { type: 'string', description: '首页欢迎导语' },
                        heroQuote: { type: 'string', description: '首页引用寄语' },
                        seasonNote: { type: 'string', description: '首页顶部节气与状态栏' },
                        currentLocation: { type: 'string', description: '常居坐标' },
                        currentReading: { type: 'string', description: '最近在读' },
                        currentListening: { type: 'string', description: '最近在听' },
                        aboutContent: {
                          type: 'string',
                          description: '关于页面正文（支持直接传 Markdown 或 HTML）',
                        },
                      },
                    },
                    createArticle: {
                      type: 'object',
                      description: '可选：创建并发布一篇新文章',
                      required: ['title', 'content'],
                      properties: {
                        title: { type: 'string', description: '文章标题' },
                        content: {
                          type: 'string',
                          description: '文章正文，支持直接写 Markdown（如 ## 小标题、**加粗**、> 引用）或 HTML',
                        },
                        excerpt: { type: 'string', description: '文章摘要（不传则自动截取生成）' },
                        category: { type: 'string', description: '文章分类名称' },
                        tags: {
                          type: 'array',
                          items: { type: 'string' },
                          description: '文章标签数组',
                        },
                        coverImage: { type: 'string', description: '封面图 URL（可选）' },
                        location: { type: 'string', description: '写作地点（可选）' },
                        weather: { type: 'string', description: '当时天气（可选）' },
                        status: {
                          type: 'string',
                          enum: ['public', 'private', 'draft'],
                          description: '可见状态：public 公开，private 私人，draft 草稿',
                        },
                        isPinned: { type: 'boolean', description: '是否置顶' },
                        isFeatured: { type: 'boolean', description: '是否首页精选' },
                      },
                    },
                    createMoment: {
                      type: 'object',
                      description: '可选：发布一条日常短动态/瞬间',
                      required: ['content'],
                      properties: {
                        content: { type: 'string', description: '瞬间文字内容' },
                        mood: { type: 'string', description: '心情或状态词' },
                        location: { type: 'string', description: '地点（可选）' },
                        tags: { type: 'array', items: { type: 'string' } },
                        images: { type: 'array', items: { type: 'string' } },
                        status: { type: 'string', enum: ['public', 'private'] },
                      },
                    },
                    createTravel: {
                      type: 'object',
                      description: '可选：新增一处旅行足迹',
                      required: ['destination'],
                      properties: {
                        destination: { type: 'string', description: '目的地名称' },
                        region: { type: 'string', description: '省份或区域' },
                        country: { type: 'string', description: '国家' },
                        startDate: { type: 'string', description: '出发日期 YYYY-MM-DD' },
                        endDate: { type: 'string', description: '返程日期 YYYY-MM-DD' },
                        summary: { type: 'string', description: '一句话旅途印象' },
                        story: { type: 'string', description: '详细行旅故事' },
                        tags: { type: 'array', items: { type: 'string' } },
                        status: { type: 'string', enum: ['public', 'private'] },
                      },
                    },
                    createCollection: {
                      type: 'object',
                      description: '可选：新增一项兴趣收藏（数码、电影、书籍、音乐、网站等）',
                      required: ['title'],
                      properties: {
                        title: { type: 'string', description: '藏品名称' },
                        creator: { type: 'string', description: '作者/导演/品牌/音乐人' },
                        category: {
                          type: 'string',
                          description: '分类代号，如 gear(数码器物), film(电影), book(书籍), music(音乐), site(网站)',
                        },
                        categoryLabel: { type: 'string', description: '分类中文名' },
                        rating: { type: 'integer', minimum: 1, maximum: 5, description: '评分1-5星' },
                        review: { type: 'string', description: '评价与感想' },
                        experienceNote: { type: 'string', description: '长期体验批注' },
                        specsOrMeta: { type: 'string', description: '规格或年份信息' },
                        externalLink: { type: 'string', description: '外部链接（可选）' },
                        tags: { type: 'array', items: { type: 'string' } },
                        status: { type: 'string', enum: ['public', 'private'] },
                      },
                    },
                  },
                },
              },
            },
          },
          responses: {
            '200': {
              description: '执行成功并返回操作结果',
              content: {
                'application/json': {
                  schema: { type: 'object' },
                },
              },
            },
          },
        },
      },
      '/api/articles': {
        post: {
          operationId: 'createArticle',
          summary: '撰写并发布新文章（支持 Markdown 或 HTML）',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['title', 'content'],
                  properties: {
                    title: { type: 'string', description: '文章标题' },
                    content: { type: 'string', description: '正文内容（支持 Markdown 或 HTML）' },
                    excerpt: { type: 'string', description: '摘要（选填，不填自动生成）' },
                    category: { type: 'string', description: '分类名称' },
                    tags: { type: 'array', items: { type: 'string' } },
                    coverImage: { type: 'string' },
                    location: { type: 'string' },
                    weather: { type: 'string' },
                    status: { type: 'string', enum: ['public', 'private', 'draft'] },
                    isPinned: { type: 'boolean' },
                    isFeatured: { type: 'boolean' },
                  },
                },
              },
            },
          },
          responses: { '201': { description: '创建成功' } },
        },
      },
      '/api/articles/{id}': {
        get: {
          operationId: 'getArticleById',
          summary: '获取指定文章的完整正文与详情',
          parameters: [
            { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
          ],
          responses: { '200': { description: '返回文章详情' } },
        },
        put: {
          operationId: 'updateArticle',
          summary: '修改或润色已有文章（支持 Markdown 或 HTML）',
          parameters: [
            { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    title: { type: 'string' },
                    content: { type: 'string' },
                    excerpt: { type: 'string' },
                    category: { type: 'string' },
                    tags: { type: 'array', items: { type: 'string' } },
                    status: { type: 'string', enum: ['public', 'private', 'draft'] },
                    isPinned: { type: 'boolean' },
                    isFeatured: { type: 'boolean' },
                  },
                },
              },
            },
          },
          responses: { '200': { description: '更新成功' } },
        },
        delete: {
          operationId: 'deleteArticle',
          summary: '删除指定文章',
          parameters: [
            { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
          ],
          responses: { '200': { description: '删除成功' } },
        },
      },
      '/api/moments': {
        post: {
          operationId: 'createMoment',
          summary: '发布一条日常瞬间动态',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['content'],
                  properties: {
                    content: { type: 'string', description: '瞬间内容' },
                    mood: { type: 'string', description: '心情状态' },
                    location: { type: 'string', description: '所在地点' },
                    weather: { type: 'string', description: '天气' },
                    tags: { type: 'array', items: { type: 'string' } },
                    images: { type: 'array', items: { type: 'string' } },
                    status: { type: 'string', enum: ['public', 'private'] },
                  },
                },
              },
            },
          },
          responses: { '201': { description: '发布成功' } },
        },
      },
      '/api/moments/{id}': {
        put: {
          operationId: 'updateMoment',
          summary: '修改指定日常瞬间',
          parameters: [
            { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
          ],
          requestBody: {
            required: true,
            content: { 'application/json': { schema: { type: 'object' } } },
          },
          responses: { '200': { description: '更新成功' } },
        },
        delete: {
          operationId: 'deleteMoment',
          summary: '删除指定日常瞬间',
          parameters: [
            { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
          ],
          responses: { '200': { description: '删除成功' } },
        },
      },
      '/api/travel': {
        post: {
          operationId: 'createTravelFootprint',
          summary: '点亮并记录新的旅行足迹',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['destination'],
                  properties: {
                    destination: { type: 'string' },
                    region: { type: 'string' },
                    country: { type: 'string' },
                    startDate: { type: 'string' },
                    endDate: { type: 'string' },
                    summary: { type: 'string' },
                    story: { type: 'string' },
                    tags: { type: 'array', items: { type: 'string' } },
                    status: { type: 'string', enum: ['public', 'private'] },
                  },
                },
              },
            },
          },
          responses: { '201': { description: '创建成功' } },
        },
      },
      '/api/collections': {
        post: {
          operationId: 'createCollectionItem',
          summary: '新增兴趣收藏（器物、电影、书籍、音乐等）',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['title'],
                  properties: {
                    title: { type: 'string' },
                    creator: { type: 'string' },
                    category: { type: 'string' },
                    categoryLabel: { type: 'string' },
                    rating: { type: 'integer', minimum: 1, maximum: 5 },
                    review: { type: 'string' },
                    experienceNote: { type: 'string' },
                    specsOrMeta: { type: 'string' },
                    externalLink: { type: 'string' },
                    tags: { type: 'array', items: { type: 'string' } },
                    status: { type: 'string', enum: ['public', 'private'] },
                  },
                },
              },
            },
          },
          responses: { '201': { description: '创建成功' } },
        },
      },
      '/api/profile': {
        put: {
          operationId: 'updateSiteProfile',
          summary: '修改全站名称、顶部副标题、底部自定义文字、首页文案及关于页内容',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    gardenName: { type: 'string' },
                    gardenSubtitle: { type: 'string' },
                    footerText: { type: 'string' },
                    ownerName: { type: 'string' },
                    ownerTitle: { type: 'string' },
                    signature: { type: 'string' },
                    bio: { type: 'string' },
                    heroTitle: { type: 'string' },
                    heroIntro: { type: 'string' },
                    heroQuote: { type: 'string' },
                    seasonNote: { type: 'string' },
                    aboutContent: { type: 'string' },
                    sectionTitles: { type: 'object' },
                  },
                },
              },
            },
          },
          responses: { '200': { description: '更新成功' } },
        },
      },
    },
  };
}

/**
 * Generates a ready-to-paste System Prompt for ChatGPT so the user can hand over
 * all writing and site management with zero friction.
 */
export function buildChatGptSystemPrompt(
  baseUrl: string,
  apiKey: string,
  gardenName: string
): string {
  const cleanUrl = baseUrl.replace(/\/+$/, '');
  return `你是我的个人数字博客「${gardenName || '竹林'}」（站点地址：${cleanUrl}）的专属主笔与内容总编。
由于我平时懒得自己排版和写长文，我只向你口述想法、关键词、日常片段或修改要求，由你替我润色成自然、温暖、有质感的文字，并直接调用博客 API 写入我的网站。

【你的权限与接口凭证】
- 博客 API 根地址：${cleanUrl}
- OpenAPI 规范地址：${cleanUrl}/openapi.json
- 认证方式（Header）：Authorization: Bearer ${apiKey} （或 x-api-key: ${apiKey}）

【你的工作流程】
1. 当我要求查看现有内容、修改旧文章或调整网站配置时，先调用 GET ${cleanUrl}/api/agent/overview 获取当前站点配置、分类和已有文章/瞬间的 ID。
2. 当我给你一句话或几个关键词让你写文章、发日常瞬间、记旅行足迹、加收藏或改网站文案时：
   - 请直接帮我扩写或润色为自然松弛、真诚细腻、不带 AI 套话的文字。
   - 文章正文（content）支持直接使用 Markdown 语法（如 ## 小标题、**加粗**、> 引用、段落换行），服务器会自动转换为精美排版并自动生成摘要。
   - 优先调用全能接口 POST ${cleanUrl}/api/agent/execute 或对应模块的 REST 接口直接发布。
3. 每次发布或修改完成后，简洁告诉我你写了什么标题、归入了哪个分类，并提供网站链接让我直接预览。`;
}
