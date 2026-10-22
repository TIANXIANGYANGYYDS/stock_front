import { Clock3 } from 'lucide-react';
import type { SentimentMeta } from './sentiment-contract';
import { clockTime } from './sentiment-model';
import { awaitingClose, finalizationReason, isFinal, isRetained, retentionReason } from './sentiment-publication';

export function SentimentPublication({ meta }: { meta: SentimentMeta }) {
  if (!isRetained(meta) && !awaitingClose(meta) && !meta.retention_reason) return null;
  if (isFinal(meta)) return null;
  const title = meta.session === 'lunch' ? isRetained(meta) ? '午休 · 保留观察' : '午休 · 数据待恢复' : meta.session === 'closing_auction' ? '收盘竞价 · 等待定稿'
    : awaitingClose(meta) ? '已收盘 · 等待定稿' : '保留观察';
  return <div className="sent-close-notice" role="status"><Clock3 size={16} /><div><strong>{title}</strong>
    <p>{isRetained(meta) ? `当前展示服务端保留的 ${clockTime(meta.as_of)} 完整观察，非最终收盘结果。` : `当前观察截至 ${clockTime(meta.as_of)}，尚未正式定稿。`}{meta.retention_reason && `${retentionReason(meta.retention_reason)}。`}</p>
    {!!meta.finalization?.pending_reasons.length && <p>待定稿：{meta.finalization.pending_reasons.map(finalizationReason).join('；')}。</p>}
  </div></div>;
}
