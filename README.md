# Deutscher Satzanalysator — 部署指南

## 项目结构

```
satzanalysator/
├── index.html        # 前端页面（唯一的 HTML 文件）
├── vercel.json       # Vercel 部署配置
├── api/
│   └── analyze.js    # Edge Function：代理 DeepSeek API 请求
└── README.md
```

## 一键部署到 Vercel

### 方法一：GitHub + Vercel（推荐）

1. 在 GitHub 创建新仓库（可以是 private）
2. 把这三个文件上传到仓库：`index.html`、`vercel.json`、`api/analyze.js`
3. 登录 [vercel.com](https://vercel.com)，点击 **Add New Project**
4. 选择刚才的 GitHub 仓库，点击 **Deploy**
5. 部署完成后得到形如 `https://your-project.vercel.app` 的网址

### 方法二：Vercel CLI（本地操作）

```bash
# 安装 Vercel CLI
npm i -g vercel

# 在项目目录执行
cd satzanalysator
vercel

# 按提示操作，完成后得到部署网址
```

## API Key 策略

**用户自带 Key 模式**（已内置）：
- 用户在页面的"API 设置"中填入自己的 DeepSeek Key
- Key 只保存在用户浏览器的 localStorage，**不经过你的服务器存储**
- 代理函数只负责转发，不记录任何 Key 或内容
- 新用户到 [platform.deepseek.com](https://platform.deepseek.com) 注册，无需信用卡，赠送 500 万免费 token

**为什么用代理函数？**
浏览器直接调用 `api.deepseek.com` 会被浏览器的跨域安全策略（CORS）拦截。
代理函数运行在 Vercel 的服务器端，不受 CORS 限制，起到中转作用。

## 本地开发

直接双击 `index.html` 在浏览器打开即可（会自动检测本地环境，直连 DeepSeek）。

## 费用估算

- Vercel：免费套餐完全够用（每月 100GB 带宽，100 万次 Edge Function 调用）
- DeepSeek API：由用户自己承担，每次分析约 0.001 元人民币
