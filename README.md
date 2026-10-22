# 拾光MV

面向影楼 / 摄影工作室的桌面端 MV 电子相册软件：导入客片 → 选模板 → 自动卡点成片 → 精修 → 批量导出。

产品设计与对标分析见 [docs/产品设计.md](docs/产品设计.md)。

## 功能

- **一键成片向导**：导入照片 → 选模板 → 选音乐 → 填文字，自动生成
- **智能选片**：人脸与闭眼检测（MediaPipe）、模糊检测、重复照片检测、曝光检查、综合评分、人脸焦点
- **音乐卡点**：节拍、重拍、能量曲线分析，场景切换落在节拍上，高潮段节奏更快
- **10 套模板**：纯白誓言、星空之约、中式喜嫁、光影写真、时尚大片、童趣乐园、宝宝成长记、旅行日记、胶片回忆、青春不散场
- **26 种转场**（GLSL）、11 种粒子特效、调色、暗角 / 颗粒 / 漏光
- **画幅**：16:9 / 9:16 / 1:1 / 4:3，同一模板自动适配
- **编辑器**：时间线拖拽排序、换版式、换照片、设焦点、按拍调时长、换转场、改字幕、撤销重做、换一换、一键换模板 / 音乐
- **导出**：720p–4K、25/30/60fps，WebCodecs 硬件 H.264 编码，后台导出队列（M3 Pro 上 1080p 约 190 帧/秒，4K 约 54 帧/秒）
- **批量出片**：一个子文件夹一个客户，自动分析、编排、排队导出
- **影楼品牌**：片尾影楼名称 / 口号 / 电话，角标水印

## 开发

```bash
npm install
npm run dev          # 开发模式
npm test             # 单元测试（节拍分析、自动编排）
npm run typecheck
npm run dist:mac     # 打包 dmg
```

端到端测试（需先 `npm run build`）：

```bash
node e2e/smoke.mjs   # 导入 → 生成 → 预览 → 导出 1080p
node e2e/gallery.mjs # 渲染所有模板的每个场景，输出到 e2e/gallery
node e2e/batch.mjs   # 批量出片
```

## 目录

```
src/main            主进程：窗口、本地文件协议、项目存储、导出队列、FFmpeg 合成音频
src/preload         渲染进程可用的 API
src/shared          项目数据类型
src/renderer/src
  engine/           WebGL2 渲染引擎（图层、遮罩、调色、转场、粒子、文字、装饰）
  templates/        版式库 styles.ts + 10 套模板
  analysis/         节拍分析（Worker）、照片分析
  arrange/          自动编排
  ui/               界面
  render-main.ts    导出窗口（逐帧渲染 + 硬件编码）
resources/music     内置曲库（公有领域 / CC0）
samples/            测试照片（codex 生成的卡通图）
```

## 素材授权

- 内置音乐：公有领域 / CC0，见 `resources/music/LICENSES.md`
- 字体：Google Fonts，SIL OFL 1.1
- 测试照片：AI 生成
