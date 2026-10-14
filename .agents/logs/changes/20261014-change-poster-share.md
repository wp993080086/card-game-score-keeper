# 修复分享战绩图裂图

- 日期：2026-10-14
- 任务：分享战绩图时图片显示为裂图
- 内容：
  - 画布不再用 `left: -9999px`。部分真机不绘制这块区域，`canvasToTempFilePath` 导出的是坏图
  - 改为留在渲染树里，用 `translateX(-120vw)` 挪出屏幕
  - 导出带上画布像素宽高和 `destWidth`/`destHeight`，格式 png
  - 分享前把临时文件拷到用户目录，避免分享面板读不到 `http://tmp`
- 结果：`npm run build:weixin` 通过。真机分享需用户再试一次
