# 三页拆分设计（运行 / 指标 / 越野）

日期：2026-10-27

## 目标

把现在的单页站点拆成三个页面，顶部加页面导航：

| 路由 | 页面 | 内容 |
| --- | --- | --- |
| `/` | 01 运行 | 现在的全部内容：标题面板、年份/城市侧栏、路线热力地图、逐日日历、年度 SVG 网格 / 活动表格 |
| `/metrics` | 02 指标 | 2026-10-26 新加的两组面板：生理趋势（VO2max、月里程、有氧训练效应、爬升/最高海拔、训练负荷、平均心率）与训练状态（训练状态、恢复力、HRV、短期与长期负荷、海拔适应） |
| `/trail` | 03 越野 | 越野跑内容：上���三维地形图、中部比赛与路线缩略图、下部统计指标 |

比赛数据全部来自 <https://itra.run/RunnerSpace/gao.hao.4683832>。

## 关键约束与已验证事实

- **原始运动文件（GPX/FIT/TCX）一律不动**，新脚本只读 `src/static/activities.json`。
- `src/utils/const.ts` 内含公开的 Mapbox token，**不得修改**（push protection 会拒绝重建该 blob）。新增常量放独立文件。
- ITRA 页面没有赛道 GPS：`/Races/RaceMap` 只返回标记点。路线几何只能来自本仓库 Garmin 活动的 `summary_polyline`。
- Mapbox 地形数据可用：token 能取 `https://api.mapbox.com/v4/mapbox.mapbox-terrain-dem-v1.json`（200）与 `.../{z}/{x}/{y}.pngraw`（200，PNG）。`mapbox-gl@2.8.2` 自带 `unpackMapbox` 解码，并支持 `map.addSource('mapbox-dem', {type:'raster-dem', url:'mapbox://mapbox.mapbox-terrain-dem-v1', tileSize:512, maxzoom:14})` + `map.setTerrain({source:'mapbox-dem', exaggeration})`；线/面图层会自动贴地（`isLayerDraped`）。
- ITRA 的 `GET /RunnerSpace/GetLatestRaceResultByYear?runnerId=4683832&raceyear=&categoryId=` 直接返回服务端渲染好的 HTML 片段，42 场比赛全在里面，不需要登录或 CSRF token。
- 路线匹配现状（按同日 + 距离容差）：42 场里 35 场能精确匹配到同日 Garmin 活动；另外几场跨日（2024-11-02 对应 11-01 的 49.2 km、2024-05-25 对应 05-26 的 29.4 km、2022-08-20 对应 08-21 的 15.2 km）可以放宽到 ±2 天命中；剩下 3 场（2026-03-28 Trail of Chengdu 60K、2025-10-25 四姑娘山 30K、2025-06-22 茂县九顶山 37K、2025-03-29 成都Trail 60K）活动库里没有对应记录。

## 数据管线

新增 `run_page/itra_sync.py`，产出 `src/static/itra_races.json`：

```jsonc
{
  "updatedAt": "2026-10-27",
  "races": [
    {
      "date": "2026-10-18",
      "name": "Heming Tao Super Mountain Trail - 23KM",
      "raceYearId": "125881",
      "url": "https://itra.run/Races/RaceDetails/125881",
      "category": "Half Marathon",
      "country": "CHN",
      "distanceKm": 22,
      "elevationM": 1160,
      "itraPoints": 2,
      "genderRank": 3, "genderTotal": 238,
      "generalRank": 3, "generalTotal": 351,
      "ageGroupRank": 1,
      "participants": 351, "finishers": 336, "dnf": 15,
      "time": "2:33:02",
      "score": null,
      "scoreLabel": "DNF",
      "badges": ["National League"],
      "route": { "runId": 12345, "match": "same-day", "polyline": "..." }
    }
  ]
}
```

- **路线匹配**（在 Python 里做，规则确定、可测）：
  1. 同日 + 距离落在 `[itra*0.9, itra*1.4 + 2]` km → `match: "same-day"`；
  2. 否则 ±2 天内 + 同一距离区间 → `match: "near-day"`；
  3. 都没有 → `route: null`，卡片只显示 ITRA 数据，不画缩略图。
- **路线简化**：Douglas-Peucker，容差 0.00005°（≈5 m），每条路线最多 500 点，再用 `polyline.encode(..., precision=5)` 存字符串。42 条约 150 KB。
- **坐标约定**：Garmin 的 polyline 与 `src/utils/utils.ts` 里 `decodePath` 一致（反 lat/lon，不做 GCJ-02 偏移），与首页地图显示完全一致。
- **CI 接线**：`run_data_sync.yml` 增加 `run_type: itra`，跑完 `git add src/static/itra_races.json` 提交。**不把该文件加进 cache 路径**——缓存会在 checkout 之后覆盖已提交产物（历史踩过的坑）。

## 前端结构

```
src/main.tsx                 路由：/ 、/metrics 、/trail 、*
src/components/Header        顶部导航（新增）
src/pages/index.tsx          01 运行（移除两个指标面板）
src/pages/metrics.tsx        02 指标（新增）
src/pages/trail.tsx          03 越野（新增）
src/components/TrailMap      三维地形图（新增）
src/components/TrailRaces    比赛卡片 + 路线缩略图（新增）
src/components/TrailStats    统计指标（新增）
src/utils/trail.ts           纯函数（新增）
test/trail.test.mjs          单元测试（新增）
```

### 顶部导航

`Header` 里加一行页面导航，用 `react-router-dom` 的 `NavLink`，当前页高亮：

```
01 运行   02 指标   03 越野
```

窄屏时这行换到 logo 下面（`flex-wrap`），不遮挡内容。外部链接（Blog / About）保持在最右。

### 02 指标页

`PhysiologyTrends` + `TrainingStatus` 整体搬过来。两者都吃 `activities` 与 `year`，指标页顶部加一排年份 chip（Total / 2026 / … / 2018），默认 `Total`，切换只影响这两个面板。年份切换状态放在指标页内部，不与首页共享。

### 03 越野跑页

**上部：三维地形图**（`TrailMap`）

- `mapbox://styles/mapbox/dark-v11` 打底，与站点暗夜风一致。
- `raster-dem` 地形源 `mapbox://mapbox.mapbox-terrain-dem-v1`，`setTerrain({exaggeration: 1.35})`，相机 `pitch: 55`。
- 叠一层 `hillshade`（同一 DEM 源）做细节阴影，配色偏冷蓝，与 `--accent` 一致。
- `map.setFog()` 让远处山体融进背景。
- 所有比赛路线作为 `line` 图层贴地；选中的那一场加粗成发光核心线 + 光晕线（沿用首页 `ROUTE_COLORS`）。
- 起点/终点 marker。相机初始框住全部路线，`flyTo` 到选中的比赛。

**中部：比赛与路线缩略图**（`TrailRaces`）

- 卡片网格：赛事名、日期、分类、距离/爬升、ITRA 积分、性别排名/总排名、用时、参赛与完赛人数。
- 路线缩略图用内联 SVG：从 polyline 解码后按自身 bbox 等比投影成 path，套用页面的蓝色发光描边。
- 顶部筛选：年份 chip + 分类 chip。
- 点卡片 → 地图 flyTo 那条路线并高亮；再点地图上的路线 → 展开卡片详情。

**下部：统计指标**（`TrailStats`）

- 指标块：比赛场次、总距离、总爬升、ITRA 总积分、平均距离、平均爬升、完赛率、最好名次。
- 年度分布柱状图（每年场次）与分类分布（Vertical/10K/Half/Marathon/50K）。
- 全部由 `src/utils/trail.ts` 的纯函数从 `itra_races.json` 算出。

## 测试

`test/trail.test.mjs`（`node --test`）覆盖：

1. `parseItraRaces` 把 JSON 变成带默认值与派生字段的比赛列表；
2. `matchRaceToActivity` 的同日 / 跨日 / 无匹配三种结果；
3. `summariseRaces` 的场次、距离、爬升、积分、完赛率、年度与分类分布；
4. `routeThumbnail` 把坐标投影成 bbox 内的 SVG path。

## 验证

- `node --test "test/**/*.test.mjs"`
- `npx tsc --noEmit`
- `npx vite build`
- `npx eslint --ext .ts,.tsx src`
- 无头浏览器逐页截图：顶部导航高亮、指标页两组面板、越野页三维地形图 / 卡片网格 / 统计面板。

## 不做的事

- 不动首页已有面板的样式与交互，只做搬家。
- 不改 `src/utils/const.ts`。
- 不给越野页加登录、评论、筛选后端等额外能力。
- 不删除或改写任何原始运动文件。
