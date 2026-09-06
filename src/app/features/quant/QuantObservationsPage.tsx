import { QuantRecordsPage, type QuantListPageProps } from './QuantRecordsPage';

export function QuantObservationsPage(props: QuantListPageProps) {
  return <QuantRecordsPage resource="observations" {...props} />;
}

