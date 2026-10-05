# 字体扩展性能对比

基线：v2.1.5。浏览器：151.0.7922.34。每组重复 1 次，表中为中位数。

使用本地模拟页面；浏览器耗时包含页面及测量钩子开销。完整样本、最小值和最大值见同名 JSON。

| 模式/场景 | 版本 | 脚本/ms | 样式/ms | 采样 | 选择器匹配 | 遍历节点 | 长任务 | 最长帧/ms |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| ordinary/cold-variables | disabled | 6.57 | 1.03 | 0 | 0 | 0 | 0 | 87.5 |
| ordinary/cold-variables | before | 8.46 | 2.26 | 1 | 4021 | 1000 | 0 | 24.9 |
| ordinary/cold-variables | after | 7.82 | 2.16 | 1 | 2013 | 1000 | 0 | 25 |
| ordinary/nontext | disabled | 2.02 | 3.74 | 0 | 0 | 0 | 0 | 16.6 |
| ordinary/nontext | before | 9.32 | 3.53 | 0 | 8001 | 0 | 0 | 25.1 |
| ordinary/nontext | after | 4.36 | 3.84 | 0 | 3 | 0 | 0 | 16.7 |
| appleUIMix/cold-variables | disabled | 6.04 | 0.94 | 0 | 0 | 0 | 0 | 20.8 |
| appleUIMix/cold-variables | before | 7.31 | 191.83 | 1 | 4025 | 1000 | 1 | 304.2 |
| appleUIMix/cold-variables | after | 7.62 | 175.78 | 1 | 2017 | 1000 | 1 | 283.3 |
| appleUIMix/nontext | disabled | 1.83 | 3.67 | 0 | 0 | 0 | 0 | 16.7 |
| appleUIMix/nontext | before | 9.81 | 3.63 | 0 | 8001 | 0 | 0 | 20.8 |
| appleUIMix/nontext | after | 4.08 | 3.64 | 0 | 3 | 0 | 0 | 12.5 |
