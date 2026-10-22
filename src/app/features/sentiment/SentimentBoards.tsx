import { ChevronRight } from 'lucide-react';
import type { BoardStats, BoardType } from './sentiment-contract';
import { displayNumber, emotionColor, emotionTitle, pct } from './sentiment-live-model';

export function SentimentBoards({ boards, selected, onFilter, onEvidence }: {
  boards: BoardStats[]; selected: BoardType | ''; onFilter: (board: BoardType) => void; onEvidence: (board: BoardType) => void;
}) {
  return <section className="sent-boards" aria-label="分板块观察">
    <div className="sent-section-head"><div><h2>分板块观察</h2><p>各板块独立统计与情绪 · 点击板块筛选下方梯队</p></div><span className="sent-muted">{boards.length ? `${boards.length} 个板块` : '历史快照'}</span></div>
    {!boards.length ? <p className="sent-panel-note">该历史快照未保存分板块明细，市场与题材统计仍可查看。</p> : <div className="sent-board-grid">{boards.map(board => <article className={`sent-board-card${selected === board.board_type ? ' is-selected' : ''}`} key={board.board_type}>
      <button type="button" className="sent-board-filter" aria-label={`筛选${board.name}`} aria-pressed={selected === board.board_type} onClick={() => onFilter(board.board_type)}>
        <span className="sent-board-card-heading"><strong>{board.name}</strong><span className={`sent-emotion-tag is-${emotionColor(board.emotion)}`}>{emotionTitle(board.emotion)}</span></span>
        <span className="sent-board-counts"><span>涨停 <b className="is-rise">{displayNumber(board.values.limit_up)}</b></span><span>跌停 <b className="is-fall">{displayNumber(board.values.limit_down)}</b></span><span>高度 <b>{displayNumber(board.values.height)}</b><small> 板</small></span></span>
        <span className="sent-board-feedback">昨涨停反馈 <b className={(board.feedback.yesterday_limit_up?.return_median ?? 0) < 0 ? 'is-fall' : 'is-rise'}>{pct(board.feedback.yesterday_limit_up?.return_median, 2, true)}</b></span>
      </button>
      <div className="sent-board-card-footer"><span title={`有效 ${displayNumber(board.values.eligible)} / 应观测 ${displayNumber(board.values.expected)}`}>覆盖 {pct(board.values.coverage)}</span><button type="button" aria-label={`${board.name}判断依据`} onClick={() => onEvidence(board.board_type)}>依据<ChevronRight size={12} /></button></div>
    </article>)}</div>}
  </section>;
}
