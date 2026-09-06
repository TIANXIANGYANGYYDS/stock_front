export type QuantSortDirection = 'asc' | 'desc';

export interface QuantSortState<Key extends string = string> {
  key: Key;
  direction: QuantSortDirection;
}

export type QuantSortValue = string | number | boolean | null | undefined;

const QUANT_COLLATOR = new Intl.Collator('zh-CN', {
  numeric: true,
  sensitivity: 'base',
});

function isMissing(value: QuantSortValue): boolean {
  return value === null || value === undefined || value === '' || (typeof value === 'number' && !Number.isFinite(value));
}

function compareValues(left: QuantSortValue, right: QuantSortValue): number {
  if (typeof left === 'number' && typeof right === 'number') return left - right;
  if (typeof left === 'boolean' && typeof right === 'boolean') return Number(left) - Number(right);
  return QUANT_COLLATOR.compare(String(left), String(right));
}

export function nextQuantSort<Key extends string>(
  current: QuantSortState<Key>,
  key: Key,
  defaultDirection: QuantSortDirection,
): QuantSortState<Key> {
  if (current.key !== key) return { key, direction: defaultDirection };
  return { key, direction: current.direction === 'asc' ? 'desc' : 'asc' };
}

export function sortQuantItems<T, Key extends string>(
  items: readonly T[],
  sort: QuantSortState<Key>,
  selectors: Record<Key, (item: T) => QuantSortValue>,
): T[] {
  const selector = selectors[sort.key];
  return items
    .map((item, index) => ({ item, index, value: selector(item) }))
    .sort((left, right) => {
      const leftMissing = isMissing(left.value);
      const rightMissing = isMissing(right.value);
      if (leftMissing !== rightMissing) return leftMissing ? 1 : -1;
      if (leftMissing && rightMissing) return left.index - right.index;
      const comparison = compareValues(left.value, right.value);
      if (comparison === 0) return left.index - right.index;
      return sort.direction === 'asc' ? comparison : -comparison;
    })
    .map(({ item }) => item);
}
