declare module "stats" {
  type Comparator<T> = (a: T, b: T) => number;
  type Indexing = <T>(arr: T[], compare: Comparator<T>) => number;
  type Element = <T>(arr: T[], compare: Comparator<T>) => T;

  const getMaxIndex: Indexing;
  const getMaxElement: Element;
  const getMinIndex: Indexing;
  const getMinElement: Element;
  const getMedianIndex: Indexing;
  const getMedianElement: Element;
  const getAverageValue: <T>(arr: T[], getValue: (el: T) => number) => number;

  export {
    getMaxIndex,
    getMaxElement,
    getMinIndex,
    getMinElement,
    getMedianIndex,
    getMedianElement,
    getAverageValue,
  };
}
