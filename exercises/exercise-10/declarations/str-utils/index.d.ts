declare module "str-utils" {
  type StringTransformation = (str: string) => string;
  const strReverse: StringTransformation;
  const strToLower: StringTransformation;
  const strToUpper: StringTransformation;
  const strRandomize: StringTransformation;
  const strInvertCase: StringTransformation;

  export { strReverse, strToLower, strToUpper, strRandomize, strInvertCase };
}
