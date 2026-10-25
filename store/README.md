# 商店发布资料

- LISTING.md：商店介绍、权限理由和审核步骤。
- ../PRIVACY.md：公开隐私政策。
- screenshots/overview-1280x800.png：1280×800 功能演示截图，使用示例内容；右侧为实际设置页面。截图明确标注示例，未使用用户账号或第三方帖文照片。
- RELEASE.md：GitHub 版本说明。

运行 `npm run package` 生成 `release/*-chrome-web-store.zip`，manifest.json 位于 ZIP 根目录。

`docs/ci-check.example.yml` 为可选 GitHub Actions 配置示例。初始 GitHub 登录令牌没有 workflow 权限，因此未启用该工作流；本地检查可直接运行 `npm run check`。
