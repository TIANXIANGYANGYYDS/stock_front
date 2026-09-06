import { QuantRecordsPage, type QuantListPageProps } from './QuantRecordsPage';

export function QuantSignalsPage(props: QuantListPageProps) {
  return <QuantRecordsPage resource="signals" {...props} />;
}

