export function formatUmlAnnotation(annotation: string) {
  const stereotype = annotation.match(/^<<(.+)>>$/);
  return stereotype ? `«${stereotype[1]}»` : annotation;
}
