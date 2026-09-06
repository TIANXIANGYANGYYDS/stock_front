import { QuantRecordsPage, type QuantListPageProps } from './QuantRecordsPage';

export function QuantExecutionsPage(props: QuantListPageProps) {
  return <QuantRecordsPage resource="executions" {...props} />;
}

