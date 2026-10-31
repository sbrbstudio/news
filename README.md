# SBRBSTUDIO News

这是一个用 Markdown 管理文章的本地新闻日报网站。地区结构来自根目录的
`areas.txt`，新闻分类来自 `content/categories.json`，文章位于
`content/articles/`。

## 启动网站

在 PowerShell 中执行：

```powershell
cd D:\news
node serve.mjs
```

然后打开 `http://127.0.0.1:4174`。保持 PowerShell 窗口运行；按
`Ctrl+C` 可停止服务。

修改文章、标签、封面后刷新浏览器即可。只有修改 `serve.mjs` 后，才需要
重启网站服务。

## 目录说明

```text
D:\news
├─ assets
│  ├─ covers             # 新闻封面图片
│  ├─ app.js             # 首页逻辑
│  ├─ article.js         # 文章页逻辑
│  └─ styles.css         # 全站样式
├─ content
│  ├─ categories.json    # 新闻分类标签
│  ├─ articles.json      # 已发布文章清单
│  ├─ article-template.md
│  └─ articles           # Markdown 文章
├─ index.html            # 新闻首页
├─ article.html          # 新闻正文页
├─ areas.txt             # 地区层级与折叠列表
└─ serve.mjs             # 本地预览服务
```

## 编辑地区标签

打开根目录的 `areas.txt`。每一行是一个地区层级，使用四个空格表示下一级：

```text
尖草坪区
    大东流小学
        教室
    汇丰中学
        操场
万柏林区
    公园
        活动区域
            座椅旁
```

操作规则：

- 新增地区：在对应父级下面增加一行，缩进比父级多四个空格。
- 新增同级地区：使用与同级相同的缩进。
- 修改名称：直接修改文字。
- 删除地区：删除该行，以及它下面所有更深的子级行。
- `暂无`：普通叶子标签。文章也可以直接归到它的父级，例如
  `area: "小店区"`。
- 点击展开箭头可以折叠或展开子级。
- 点击地区名称会筛选该地区及它下面的全部内容。

修改或删除地区后，应同步检查文章 front matter 中的 `area`：

```yaml
area: "万柏林区/公园/活动区域/座椅旁"
```

文章引用一个已删除的完整路径后，仍会出现在“全部”中，但地区信息可能不再
准确，因此删除或改名时应同步更新受影响文章。

## 添加、删除和修改新闻分类

新闻分类集中放在 `content/categories.json`：

```json
[
  {
    "id": "education",
    "label": "教育"
  }
]
```

- `id`：文章 front matter 使用的唯一英文键，建议只使用小写字母和连字符。
- `label`：网站导航和筛选栏中显示的中文名称。
- 新增分类：增加一个对象，刷新页面后首页导航和筛选按钮会自动出现。
- 修改分类名称：只修改 `label`，不必逐篇修改文章。
- 删除分类：先把相关文章的 `category` 改为其他有效 `id`，再删除该对象。

文章中的写法和显示名称：

```yaml
category: "education"
category_label: "教育"
```

`category_label` 是备用显示名称；网站优先读取 `categories.json` 中的 `label`。

## 添加一篇新闻

1. 复制 `content/article-template.md`。
2. 将副本放进 `content/articles/`，文件名使用英文小写和连字符，例如
   `school-open-day.md`。文件名就是文章网址标识。
3. 修改 front matter 和正文。
4. 打开 `content/articles.json`，把新文件路径加入数组：

```json
[
  "content/articles/classroom-after-school.md",
  "content/articles/school-open-day.md"
]
```

5. 刷新网站首页。

文章默认会自动出现在“最新报道”中。`published_at` 越新，排序越靠前。

让文章进入首页头条区域：

```yaml
featured: true
```

目前第一篇 `featured: true` 的文章会成为主头条，其余文章继续出现在今日焦点
和最新报道中。

## 添加或更换封面

1. 把图片放入 `assets/covers/`，例如：

```text
D:\news\assets\covers\school-open-day.jpg
```

2. 在文章 front matter 中填写相对路径：

```yaml
cover: "./assets/covers/school-open-day.jpg"
cover_alt: "学生走进校园开放日活动现场"
caption: "校园开放日的资料画面。图片来源：SBRBSTUDIO"
```

支持 JPG、PNG、WebP 和 SVG。推荐横版图片，比例约 `16:10` 或 `16:9`，
建议宽度 1600px。文件名避免中文、空格和括号。

`cover_alt` 要描述图片里真正可见的内容，方便屏幕阅读器用户理解。

## 首页随机谚语

首页底部的“今日一句”会从根目录的 `saying.txt` 随机读取一行，并提供“换一句”
按钮。文件格式为一行一句：

```text
海内存知己，天涯若比邻。
别有幽愁暗恨生，此时无声胜有声。
```

空行会被忽略；添加、删除或修改句子后刷新页面即可生效。

## 编辑或删除新闻

- 编辑正文或信息：直接修改对应的 `.md` 文件。
- 删除新闻：从 `content/articles.json` 移除对应路径，然后删除 Markdown 文件。
- 暂时不在首页显示：从 `content/articles.json` 移除路径即可。
- 建议不要直接修改文章文件名；文件名改变后需要同步更新 `articles.json`、
  外部链接和收藏地址。

## 添加文章关键词

每篇文章还可以写入搜索关键词：

```yaml
tags: [学校, 操场, 放学, 公共空间]
```

这些标签会参与搜索，并显示在文章正文末尾。标签数组使用英文逗号分隔。

## 正文格式

Markdown 正文目前支持：

- `## 小标题`
- `### 三级标题`
- 普通段落
- `**粗体**` 和 `*斜体*`
- `[链接文字](https://example.com)`
- `- 无序列表`
- `1. 有序列表`
- `> 引言`
- `---` 分隔线

## 在文章中插入图片

先把图片放进 `assets/media/`，然后在 Markdown 中单独写一行：

```markdown
![校园开放日现场](./assets/media/school-open-day.jpg "图片说明：校园开放日活动现场。")
```

圆括号内依次是相对路径和可选的图片说明。图片会自动跨栏显示；建议宽度
1600px，支持 JPG、PNG、WebP 和 SVG。

## 在文章中插入视频

先把网页兼容的视频放进 `assets/media/`，推荐 MP4（H.264/AAC）或 WebM：

```markdown
@[video](./assets/media/interview.mp4 "视频说明：一段 30 秒的采访片段。")
```

视频会显示原生播放控件，并自动跨栏。这里使用直接视频文件，不嵌入第三方
视频网站播放器。

## 在文章中插入表格

在 Markdown 中书写标准表格：

```markdown
| 时段 | 活动 | 地点 |
| --- | --- | --- |
| 09:00 | 校园参观 | 教学楼 |
| 10:30 | 家长交流 | 报告厅 |
```

第一行是表头，第二行必须保留 `---` 分隔行。手机端表格可以横向滚动。

当前内容为界面演示新闻，不代表真实事件。

## 发布到 GitHub Pages

远程仓库：

```text
https://github.com/sbrbstudio/news
```

网站正式地址预计为：

```text
https://sbrbstudio.github.io/news/
```

首次推送前，在 GitHub 打开：

```text
Settings → Pages
```

将 `Build and deployment` 的 `Source` 设为 `Deploy from a branch`，
分支选择 `main`，目录选择 `/ (root)`，然后保存。

当前电脑的项目已经可以直接进行提交和推送。以后每次修改网站后，在
PowerShell 中执行：

```powershell
cd D:\news
git status
git add -A
git commit -m "更新新闻内容"
git push
```

第一次执行 `git push` 时，Git 会要求登录 GitHub。按浏览器提示完成一次授权后，
系统通常会记住凭据。

推送成功后，GitHub Pages 通常会在 1–3 分钟内自动发布新版本，刷新正式网址
即可查看。

