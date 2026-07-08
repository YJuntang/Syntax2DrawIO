import type { Point } from './builder';

export function simplifyRenderedWaypoints(points: Point[], source?: Point, target?: Point) {
  const deduped = dedupePoints(points);
  if (!source || !target || deduped.length === 0) {
    return deduped;
  }

  if (deduped.every((point) => isPointNearLine(point, source, target))) {
    return [];
  }

  return reduceCurveControlPoints(deduped, source, target);
}

export function dedupePoints(points: Point[]) {
  return points.filter((point, index) => {
    const previous = points[index - 1];
    return !previous || Math.abs(previous.x - point.x) > 0.5 || Math.abs(previous.y - point.y) > 0.5;
  });
}

function isPointNearLine(point: Point, source: Point, target: Point) {
  return Math.abs(getSignedDistanceFromLine(point, source, target)) <= 3;
}

function reduceCurveControlPoints(points: Point[], source: Point, target: Point) {
  const rankedPoints = points
    .map((point) => ({
      point,
      distance: getSignedDistanceFromLine(point, source, target),
      progress: getLineProgress(point, source, target),
    }))
    .filter(({ progress }) => progress > 0.08 && progress < 0.92);

  if (rankedPoints.length === 0) {
    return [points[Math.floor(points.length / 2)]];
  }

  const positive = rankedPoints.filter(({ distance }) => distance > 3);
  const negative = rankedPoints.filter(({ distance }) => distance < -3);

  if (positive.length > 0 && negative.length > 0) {
    return [
      getLargestDistancePoint(positive),
      getLargestDistancePoint(negative),
    ].sort((left, right) => getLineProgress(left, source, target) - getLineProgress(right, source, target));
  }

  return [getLargestDistancePoint(rankedPoints)];
}

function getLargestDistancePoint(points: Array<{ point: Point; distance: number }>) {
  return points.reduce((largest, current) => (
    Math.abs(current.distance) > Math.abs(largest.distance) ? current : largest
  )).point;
}

function getSignedDistanceFromLine(point: Point, source: Point, target: Point) {
  const deltaX = target.x - source.x;
  const deltaY = target.y - source.y;
  const length = Math.hypot(deltaX, deltaY);
  if (length <= 1) {
    return 0;
  }

  return ((deltaY * point.x) - (deltaX * point.y) + (target.x * source.y) - (target.y * source.x)) / length;
}

function getLineProgress(point: Point, source: Point, target: Point) {
  const deltaX = target.x - source.x;
  const deltaY = target.y - source.y;
  const lengthSquared = (deltaX * deltaX) + (deltaY * deltaY);
  if (lengthSquared <= 1) {
    return 0.5;
  }

  return (((point.x - source.x) * deltaX) + ((point.y - source.y) * deltaY)) / lengthSquared;
}
