import { QuantRecordsPage, type QuantListPageProps } from './QuantRecordsPage';

export function QuantHoldingsPage(props: QuantListPageProps) {
  return <QuantRecordsPage resource="holdings" {...props} />;
}

