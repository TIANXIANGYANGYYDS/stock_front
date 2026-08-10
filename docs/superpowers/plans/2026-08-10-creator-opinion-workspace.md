# 博主观点工作区实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** 新增独立的“博主观点”工作区，展示真实博主作品、完整观点、验证结果和带有效样本提示的准确率排行。

**Architecture:** 保持 src/app/lib/api.ts 为唯一后端适配层，将排行、筛选、正文选择和验证合并放入纯函数模块。CreatorInsightsView 负责独立请求状态和选择协调，三个子组件仅渲染映射后的稳定类型。

**Tech Stack:** React 18、TypeScript、Vite、Vitest、jsdom、Lucide React、现有 terminal.css 视觉系统。

## Global Constraints

- 所有观点、准确率、实际评分和验证理由只使用 Stock_Project 真实字段。
- 前端不重新计算 accuracy_score，不生成买卖建议，不补造正文或验证结果。
- 作品默认请求 is_a_share_relevant=true 和 status=finished。
- 博主内容按真实发布时间筛选，不受股票最新交易日截断。
- score 为有限数字的验证记录才计入有效评分样本。
- accuracy_score 为空时显示“数据积累中”，不得显示为 0 分。
- 有准确率但有效样本少于 5 条时显示“样本较少”。
- 看多使用红色、看空使用绿色，但所有状态必须同时提供文字和图标。
- 不新增第三方依赖。
- 保持现有三个工作区行为不变。

---

## File Structure

- Modify: src/app/lib/api.ts — 原始 creator 字段、稳定 UI 类型、映射器和五个只读请求函数。
- Create: src/app/lib/creator-api.test.ts — creator 映射和请求契约测试。
- Create: src/app/features/creators/creator-opinion-state.ts — 排行、样本、状态、时间范围、过滤、去重、正文选择和验证合并纯函数。
- Create: src/app/features/creators/creator-opinion-state.test.ts — 纯状态规则测试。
- Create: src/app/features/creators/CreatorRankingPanel.tsx — 左侧博主评分榜。
- Create: src/app/features/creators/CreatorWorkStream.tsx — 中间作品流、筛选摘要和加载更多。
- Create: src/app/features/creators/CreatorWorkDetail.tsx — 右侧详情、观点分析和原始内容。
- Create: src/app/features/creators/CreatorPanels.test.tsx — 三个展示组件的交互和空值测试。
- Create: src/app/features/creators/CreatorInsightsView.tsx — 工作区请求、筛选、分页、选择和详情缓存。
- Create: src/app/features/creators/CreatorInsightsView.test.tsx — 独立加载、筛选联动、详情请求和错误隔离测试。
- Modify: src/app/components/TerminalHeader.tsx — 第四个一级导航。
- Modify: src/app/components/TerminalHeader.test.tsx — 导航可访问性和点击测试。
- Modify: src/app/App.tsx — creators 工作区路由。
- Modify: src/app/App.test.tsx — 新工作区挂载测试。
- Modify: src/styles/terminal.css — 三栏、抽屉、移动端和状态视觉。
- Modify: README.md — 能力和 creator API 清单。

---

### Task 1: Creator API contract and mappers

**Files:**
- Modify: src/app/lib/api.ts
- Create: src/app/lib/creator-api.test.ts

**Interfaces:**
- Produces: CreatorAccount, CreatorOpinion, CreatorWorkSummary, CreatorWorkDetail, VerifiedCreatorOpinion, CreatorOpinionAnalysis, CreatorWorkFilters, CreatorWorkResponse.
- Produces: mapCreatorAccount(raw), mapCreatorWorkSummary(raw), mapCreatorWorkDetail(raw), mapCreatorOpinionAnalysis(raw).
- Produces: getCreatorAccounts(), getCreatorWorks(filters), getCreatorWorkDetail(workKey), getCreatorOpinionAnalyses(), getCreatorOpinionAnalysis(creatorId).

- [ ] **Step 1: Write failing mapper tests**

Create creator-api.test.ts with representative list, detail and analysis payloads. Assert that null accuracy remains null, unknown enum strings survive, arrays default to empty, and detail fields are preserved.

    import { describe, expect, it, vi, afterEach } from 'vitest';
    import {
      getCreatorWorkDetail,
      getCreatorWorks,
      mapCreatorOpinionAnalysis,
      mapCreatorWorkDetail,
      mapCreatorWorkSummary,
    } from './api';

    describe('creator API mapping', () => {
      it('maps list opinions without inventing a detail summary', () => {
        const work = mapCreatorWorkSummary({
          work_key: 'weibo:1',
          creator_id: 'hero',
          creator_name: '天津股侠',
          platform: 'weibo',
          title: '商业航天观点',
          published_at_beijing: '2026-08-09T16:48:06+08:00',
          a_share_opinions: [{
            opinion_id: 'weibo:1:1',
            target_type: 'sector',
            target_name: '商业航天',
            direction: 'bullish',
            stance_score: 40,
            claim: '商业航天明天可能冲高',
            confidence: 0.8,
            verifiable: true,
          }],
        });
        expect(work.summary).toBeUndefined();
        expect(work.opinions[0]).toMatchObject({
          targetName: '商业航天',
          direction: 'bullish',
          stanceScore: 40,
        });
      });

      it('preserves null accuracy and numeric verification scores', () => {
        const analysis = mapCreatorOpinionAnalysis({
          creator_id: 'hero',
          creator_name: '天津股侠',
          accuracy_score: null,
          verified_opinions: [
            { opinion_id: 'a', verdict: 'corroborated', score: 1 },
            { opinion_id: 'b', verdict: 'unverified', score: null },
          ],
          pending_opinions: [],
        });
        expect(analysis.accuracyScore).toBeNull();
        expect(analysis.verifiedOpinions.map((item) => item.score)).toEqual([1, null]);
      });
    });

- [ ] **Step 2: Run mapper tests and verify failure**

Run: npm test -- src/app/lib/creator-api.test.ts

Expected: FAIL because creator types and mapper functions are not exported.

- [ ] **Step 3: Add raw creator contracts and stable UI types**

Add raw interfaces next to existing Stock_Project raw interfaces. Add stable exports with these exact fields:

    export interface CreatorOpinion {
      opinionId: string;
      workKey: string;
      marketScope: string;
      targetType: string;
      targetId: string | null;
      targetName: string;
      direction: string;
      stanceScore: number | null;
      claim: string;
      horizon: string;
      validFrom: string;
      validUntil: string;
      metric: string;
      conditions: string[];
      confidence: number | null;
      verifiable: boolean | null;
      sourceQuote: string;
      verificationDate: string;
    }

    export interface CreatorWorkSummary {
      workKey: string;
      creatorId: string;
      creatorName: string;
      accountId: string;
      platform: string;
      title: string;
      contentType: string;
      publishedAt: string;
      canonicalUrl: string;
      status: string;
      isAShareRelevant: boolean;
      opinions: CreatorOpinion[];
      summary?: string;
    }

    export interface CreatorWorkFilters {
      creatorId?: string;
      platform?: string;
      keyword?: string;
      startTime?: string;
      endTime?: string;
      page?: number;
      pageSize?: number;
    }

- [ ] **Step 4: Implement defensive mapper functions**

Use toText, toNullableNumber, toStringArray and explicit null preservation. mapCreatorWorkSummary must not invent analysis.summary. mapCreatorWorkDetail may read raw.analysis.summary and full text fields.

    export function mapCreatorOpinion(raw: RawCreatorOpinion): CreatorOpinion {
      return {
        opinionId: toText(raw.opinion_id),
        workKey: toText(raw.work_key),
        marketScope: toText(raw.market_scope),
        targetType: toText(raw.target_type),
        targetId: toText(raw.target_id) || null,
        targetName: toText(raw.target_name, '未指定标的'),
        direction: toText(raw.direction, 'unknown'),
        stanceScore: toNullableNumber(raw.stance_score),
        claim: toText(raw.claim),
        horizon: toText(raw.horizon),
        validFrom: toText(raw.valid_from),
        validUntil: toText(raw.valid_until),
        metric: toText(raw.metric),
        conditions: toStringArray(raw.conditions),
        confidence: toNullableNumber(raw.confidence),
        verifiable: typeof raw.verifiable === 'boolean' ? raw.verifiable : null,
        sourceQuote: toText(raw.source_quote),
        verificationDate: toText(raw.verification_date),
      };
    }

- [ ] **Step 5: Write failing request contract tests**

Mock global fetch. Assert list queries include is_a_share_relevant=true, status=finished, encoded filters and pagination. Assert colon-containing path keys use encodeURIComponent and detail responses unwrap data.

    it('encodes filters and creator work keys', async () => {
      const fetchMock = vi.fn()
        .mockResolvedValueOnce(new Response(JSON.stringify({
          items: [], total: 0, page: 2, page_size: 24,
        }), { status: 200 }))
        .mockResolvedValueOnce(new Response(JSON.stringify({
          data: { work_key: 'douyin:7', a_share_opinions: [] },
        }), { status: 200 }));
      vi.stubGlobal('fetch', fetchMock);

      await getCreatorWorks({ creatorId: 'hero', page: 2, pageSize: 24 });
      await getCreatorWorkDetail('douyin:7');

      expect(String(fetchMock.mock.calls[0][0])).toContain('creator_id=hero');
      expect(String(fetchMock.mock.calls[0][0])).toContain('is_a_share_relevant=true');
      expect(String(fetchMock.mock.calls[1][0])).toContain('/creator-works/douyin%3A7');
    });

- [ ] **Step 6: Implement creator request functions**

Use requestJson and map responses at the boundary. getCreatorWorks returns mapped items and numeric pagination. getCreatorOpinionAnalysis returns null on a 404 and rethrows other failures.

    export async function getCreatorWorks(
      filters: CreatorWorkFilters = {},
    ): Promise<CreatorWorkResponse> {
      const response = await requestJson<PagedResponse<RawCreatorWork>>(
        '/api/v1/creator-works',
        {
          creator_id: filters.creatorId,
          platform: filters.platform,
          keyword: filters.keyword,
          start_time: filters.startTime,
          end_time: filters.endTime,
          page: filters.page ?? 1,
          page_size: filters.pageSize ?? 24,
          is_a_share_relevant: true,
          status: 'finished',
        },
      );
      return {
        items: (response.items ?? []).map(mapCreatorWorkSummary),
        total: toNumber(response.total, 0),
        page: toNumber(response.page, filters.page ?? 1),
        pageSize: toNumber(response.page_size, filters.pageSize ?? 24),
      };
    }

- [ ] **Step 7: Run creator API tests**

Run: npm test -- src/app/lib/creator-api.test.ts

Expected: all creator mapper and request contract tests PASS.

- [ ] **Step 8: Commit API increment**

    git add src/app/lib/api.ts src/app/lib/creator-api.test.ts
    git commit -m "feat: add creator opinion API adapter"

---

### Task 2: Pure creator ranking and display state

**Files:**
- Create: src/app/features/creators/creator-opinion-state.ts
- Create: src/app/features/creators/creator-opinion-state.test.ts

**Interfaces:**
- Consumes: CreatorOpinionAnalysis, CreatorWorkSummary, CreatorOpinion, VerifiedCreatorOpinion from Task 1.
- Produces: CreatorTimeWindow, CreatorDirectionFilter, CreatorRankingItem, CreatorSourceText.
- Produces: buildCreatorRankingItems, verificationPresentation, creatorTimeRange, filterWorksByDirection, appendUniqueWorks, chooseCreatorSourceText, mergeOpinionVerification.

- [ ] **Step 1: Write failing state tests**

Cover null rankings, score-based effective samples, tie breaking, small-sample flags, verdict labels, 24-hour range, direction filtering, append de-duplication, source priority and opinion verification merge.

    it('sorts by backend accuracy and uses only numeric scores as samples', () => {
      const rows = buildCreatorRankingItems([
        analysis('a', 100, [{ score: 1 }, { score: null }]),
        analysis('b', 74.46, Array.from({ length: 20 }, () => ({ score: 1 }))),
        analysis('c', null, []),
      ]);
      expect(rows.map((row) => row.creatorId)).toEqual(['a', 'b', 'c']);
      expect(rows[0]).toMatchObject({ effectiveSamples: 1, smallSample: true, rank: 1 });
      expect(rows[2]).toMatchObject({ accuracyScore: null, rank: null });
    });

    it('uses source text before extraction, ASR, and OCR', () => {
      expect(chooseCreatorSourceText({
        sourceText: '原文',
        extractedText: '提取',
        asrText: '语音',
        ocrText: '字幕',
      })).toEqual({ label: '原始正文', text: '原文' });
    });

- [ ] **Step 2: Run state tests and verify failure**

Run: npm test -- src/app/features/creators/creator-opinion-state.test.ts

Expected: FAIL because the state module does not exist.

- [ ] **Step 3: Implement ranking and verification helpers**

    export function effectiveSampleCount(analysis: CreatorOpinionAnalysis): number {
      return analysis.verifiedOpinions.filter(
        (item) => item.score !== null && Number.isFinite(item.score),
      ).length;
    }

    export function verificationPresentation(verdict: string | null) {
      const labels = {
        corroborated: { label: '命中', tone: 'positive' },
        partially_corroborated: { label: '部分命中', tone: 'partial' },
        contradicted: { label: '观点相反', tone: 'negative' },
        not_triggered: { label: '条件未触发', tone: 'muted' },
        unverified: { label: '证据不足', tone: 'muted' },
      } as const;
      return verdict && verdict in labels
        ? labels[verdict as keyof typeof labels]
        : { label: verdict ? '待识别状态' : '等待验证', tone: 'pending' };
    }

buildCreatorRankingItems must preserve backend accuracy, sort nulls last, apply the tie breaker, assign numeric ranks only to scored rows, and mark smallSample when effectiveSamples is below 5.

- [ ] **Step 4: Implement time, filter, de-duplication and merge helpers**

creatorTimeRange receives a fixed Date in tests and returns ISO start/end strings for 24h, 3d and 7d. all returns an empty object. filterWorksByDirection matches any nested opinion. appendUniqueWorks keeps original order and replaces an existing key with the newer mapped item. mergeOpinionVerification indexes verified and pending records by opinionId.

- [ ] **Step 5: Run state tests**

Run: npm test -- src/app/features/creators/creator-opinion-state.test.ts

Expected: all state tests PASS.

- [ ] **Step 6: Commit state increment**

    git add src/app/features/creators/creator-opinion-state.ts src/app/features/creators/creator-opinion-state.test.ts
    git commit -m "feat: add creator opinion state rules"

---

### Task 3: Presentational three-column panels

**Files:**
- Create: src/app/features/creators/CreatorRankingPanel.tsx
- Create: src/app/features/creators/CreatorWorkStream.tsx
- Create: src/app/features/creators/CreatorWorkDetail.tsx
- Create: src/app/features/creators/CreatorPanels.test.tsx

**Interfaces:**
- Consumes: stable API types and state helpers from Tasks 1 and 2.
- Produces: three controlled components with no fetch calls.

- [ ] **Step 1: Write failing panel tests**

Render each panel with fixed props. Assert null accuracy renders “数据积累中”, a one-sample 100 score renders “样本较少”, work cards expose direction text, callbacks fire, and detail tabs switch between analysis and source content.

    it('renders honest ranking evidence and selects a creator', async () => {
      const onSelect = vi.fn();
      await render(<CreatorRankingPanel
        items={[scoredRow, accumulatingRow]}
        selectedCreatorId=""
        loading={false}
        error={null}
        onSelect={onSelect}
        onRetry={vi.fn()}
      />);
      expect(document.body.textContent).toContain('样本较少');
      expect(document.body.textContent).toContain('数据积累中');
      click(button('天津股侠'));
      expect(onSelect).toHaveBeenCalledWith('hero');
    });

- [ ] **Step 2: Run panel tests and verify failure**

Run: npm test -- src/app/features/creators/CreatorPanels.test.tsx

Expected: FAIL because the three components do not exist.

- [ ] **Step 3: Implement CreatorRankingPanel**

Props must include items, selectedCreatorId, loading, error, onSelect and onRetry. Use buttons with aria-pressed. Render scored and accumulating groups separately. Show rank, accuracy, effective samples, pending count and small-sample badge.

- [ ] **Step 4: Implement CreatorWorkStream**

Props must include items, selectedWorkKey, loading, loadingMore, error, total, hasMore, directionFilter, onSelect, onLoadMore, onClearFilters and onRetry. Render title, creator, platform, published time, first opinion claim, opinion count, and at most three direction chips. Use text and ArrowUpRight, ArrowDownRight or Minus icons.

- [ ] **Step 5: Implement CreatorWorkDetail**

Props must include work, creatorAnalysis, loading, error, onRetry and onClose. Maintain only the local analysis/source tab state. Join work.opinions to verified and pending records by opinionId. Render AI summary only from detail data. Render source label and text from chooseCreatorSourceText. External links use target="_blank" and rel="noreferrer noopener".

- [ ] **Step 6: Run panel tests**

Run: npm test -- src/app/features/creators/CreatorPanels.test.tsx

Expected: all presentational component tests PASS.

- [ ] **Step 7: Commit panel increment**

    git add src/app/features/creators/CreatorRankingPanel.tsx src/app/features/creators/CreatorWorkStream.tsx src/app/features/creators/CreatorWorkDetail.tsx src/app/features/creators/CreatorPanels.test.tsx
    git commit -m "feat: add creator opinion panels"

---

### Task 4: Creator workspace orchestration

**Files:**
- Create: src/app/features/creators/CreatorInsightsView.tsx
- Create: src/app/features/creators/CreatorInsightsView.test.tsx

**Interfaces:**
- Consumes: all API functions from Task 1, state helpers from Task 2, and panels from Task 3.
- Produces: CreatorInsightsView with independent ranking, works and detail states.

- [ ] **Step 1: Write failing workspace tests**

Mock getCreatorAccounts, getCreatorOpinionAnalyses, getCreatorWorks and getCreatorWorkDetail. Verify initial calls happen independently, first work selection loads detail, creator selection reloads page 1, direction filtering stays local, load-more appends, and a ranking failure does not hide successful works.

    it('keeps the work stream usable when ranking fails', async () => {
      api.getCreatorAccounts.mockResolvedValue([]);
      api.getCreatorOpinionAnalyses.mockRejectedValue(new Error('排行离线'));
      api.getCreatorWorks.mockResolvedValue({
        items: [workSummary], total: 1, page: 1, pageSize: 24,
      });
      api.getCreatorWorkDetail.mockResolvedValue(workDetail);

      await render(<CreatorInsightsView />);

      expect(document.body.textContent).toContain('排行离线');
      expect(document.body.textContent).toContain(workSummary.title);
      expect(document.body.textContent).toContain(workDetail.summary);
    });

- [ ] **Step 2: Run workspace tests and verify failure**

Run: npm test -- src/app/features/creators/CreatorInsightsView.test.tsx

Expected: FAIL because CreatorInsightsView does not exist.

- [ ] **Step 3: Implement initial parallel loading and overview**

On mount, call account, analysis and first works requests without awaiting one another. Store independent loading and error states. Derive overview values from accounts, the unfiltered work response total, analyses with non-null accuracy, and all pending arrays.

- [ ] **Step 4: Implement controlled filters and pagination**

State fields: search, debouncedSearch, platform, timeWindow, direction, selectedCreatorId, page. Use creatorTimeRange with the current Date. Server filters trigger a fresh page-1 request; direction filters mapped items locally. Loading more requests page + 1 and merges with appendUniqueWorks.

- [ ] **Step 5: Implement selection, detail cache and stale-response defense**

Select the first visible work when no selection exists. Use a Map keyed by workKey for detail cache. Each async effect captures a cancelled boolean and ignores obsolete completion. A detail failure only updates detailError. Clearing a creator that no longer owns the current selection resets the selection.

- [ ] **Step 6: Compose heading, overview, filter bar and panels**

Use the existing view-heading, eyebrow, terminal-panel and terminal-empty conventions. Add search, time, platform and direction controls. The heading copy must state that viewpoints are AI-extracted and historical accuracy is not investment advice.

- [ ] **Step 7: Run workspace tests**

Run: npm test -- src/app/features/creators/CreatorInsightsView.test.tsx

Expected: all orchestration and error-isolation tests PASS.

- [ ] **Step 8: Commit workspace increment**

    git add src/app/features/creators/CreatorInsightsView.tsx src/app/features/creators/CreatorInsightsView.test.tsx
    git commit -m "feat: orchestrate creator opinion workspace"

---

### Task 5: Navigation, responsive terminal styling, documentation and verification

**Files:**
- Modify: src/app/components/TerminalHeader.tsx
- Modify: src/app/components/TerminalHeader.test.tsx
- Modify: src/app/App.tsx
- Modify: src/app/App.test.tsx
- Modify: src/styles/terminal.css
- Modify: README.md

**Interfaces:**
- Consumes: CreatorInsightsView from Task 4.
- Produces: accessible fourth workspace at WorkspaceView value creators.

- [ ] **Step 1: Write failing navigation and App tests**

Extend TerminalHeader.test.tsx to assert “博主观点” is a button and clicking it calls onViewChange('creators'). Update the mocked TerminalHeader in App.test.tsx to expose a button that invokes onViewChange('creators'), mock CreatorInsightsView, click, and assert it mounts.

    it('opens the creator workspace from the fourth navigation item', async () => {
      const onViewChange = vi.fn();
      renderHeader({ onViewChange });
      click(button('博主观点'));
      expect(onViewChange).toHaveBeenCalledWith('creators');
    });

- [ ] **Step 2: Run navigation tests and verify failure**

Run: npm test -- src/app/components/TerminalHeader.test.tsx src/app/App.test.tsx

Expected: FAIL because creators is not a WorkspaceView and no navigation item exists.

- [ ] **Step 3: Wire the fourth workspace**

Add UsersRound or MessagesSquare to TerminalHeader. Extend WorkspaceView to 'decision' | 'market' | 'news' | 'creators'. Import CreatorInsightsView in App and render it for activeView === 'creators' after the existing date gate. Do not pass tradeDate because creator content is realtime.

- [ ] **Step 4: Add desktop, tablet and mobile CSS**

Add creator-prefixed classes only. Desktop uses:

    .creator-workspace-grid {
      display: grid;
      grid-template-columns: 300px minmax(440px, 1fr) 440px;
      gap: 12px;
      min-height: 0;
    }

At widths below 1280px, hide the inline detail column and show a fixed right drawer when a detail is selected. At widths below 760px, use a single column, expose the page-local ranking/work tab controls, and make the detail drawer full-screen. Preserve keyboard focus rings and ensure all long text uses overflow-wrap:anywhere.

- [ ] **Step 5: Update README**

Add the fourth workspace to the product description and capability list. Add the three creator endpoint families to the backend interface list. State that creator content is realtime and not cut off by latest_trade_date, while existing market data remains date-gated.

- [ ] **Step 6: Run focused creator and navigation tests**

Run: npm test -- src/app/lib/creator-api.test.ts src/app/features/creators/creator-opinion-state.test.ts src/app/features/creators/CreatorPanels.test.tsx src/app/features/creators/CreatorInsightsView.test.tsx src/app/components/TerminalHeader.test.tsx src/app/App.test.tsx

Expected: all focused tests PASS with zero unhandled React act warnings.

- [ ] **Step 7: Run complete regression tests**

Run: npm test

Expected: all test files PASS with zero failed tests.

- [ ] **Step 8: Run production build**

Run: npm run build

Expected: Vite exits 0 and writes dist assets without TypeScript or bundling errors.

- [ ] **Step 9: Smoke-test the live backend contract**

Run these read-only PowerShell requests and confirm non-empty items plus a detail summary:

    $base = 'http://39.106.202.228:8100/api/v1'
    Invoke-RestMethod "$base/creator-accounts"
    Invoke-RestMethod "$base/creator-opinion-analyses?page=1&page_size=5"
    Invoke-RestMethod "$base/creator-works?is_a_share_relevant=true&status=finished&page=1&page_size=5"

Expected: account, analysis and A-share work collections return successfully.

- [ ] **Step 10: Inspect the rendered layouts**

Start npm run dev and inspect:

- 1440px: three columns visible without horizontal overflow.
- 1024px: ranking and work stream remain visible; detail opens in a right drawer.
- 390px: page-local ranking/work switch is usable; detail fills the viewport.
- A null score reads “数据积累中”.
- A score with fewer than 5 numeric samples reads “样本较少”.
- The detail source tab labels the actual source field.

- [ ] **Step 11: Commit integration**

    git add src/app/components/TerminalHeader.tsx src/app/components/TerminalHeader.test.tsx src/app/App.tsx src/app/App.test.tsx src/styles/terminal.css README.md
    git commit -m "feat: integrate creator opinion workspace"

---

## Plan Self-Review

- Spec coverage: API contract, ranking trust rules, filters, three panels, independent errors, responsive layouts, accessibility, documentation and verification each map to a task.
- Placeholder scan: no deferred implementation or unspecified error handling remains.
- Type consistency: CreatorOpinionAnalysis, CreatorWorkSummary, CreatorWorkDetail and creator API function names are identical across all tasks.
- Scope: the plan adds one cohesive workspace and does not change unrelated market calculations.
