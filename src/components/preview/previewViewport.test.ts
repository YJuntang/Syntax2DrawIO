import { expect, test } from 'vitest';
import {
  clampPreviewZoom,
  DEFAULT_PREVIEW_VIEWPORT,
  fitPreviewViewport,
  PREVIEW_FIT_PADDING,
  remapPreviewViewportToContent,
  resetPreviewViewport,
  zoomPreviewViewportAtPoint,
} from './previewViewport';

test('clamps preview zoom to configured min/max', () => {
  expect(clampPreviewZoom(0.01)).toBe(0.2);
  expect(clampPreviewZoom(1.25)).toBe(1.25);
  expect(clampPreviewZoom(9)).toBe(4);
});

test('fits preview content into the viewport with padding', () => {
  const next = fitPreviewViewport({
    ...DEFAULT_PREVIEW_VIEWPORT,
    contentWidth: 1000,
    contentHeight: 500,
    viewportWidth: 800,
    viewportHeight: 600,
  });

  expect(next.zoom).toBeCloseTo((800 - (PREVIEW_FIT_PADDING * 2)) / 1000, 4);
  expect(next.panX).toBeGreaterThanOrEqual(PREVIEW_FIT_PADDING - 1);
  expect(next.panY).toBeGreaterThan(0);
});

test('zooms around the anchor point without drifting focus', () => {
  const base = {
    ...DEFAULT_PREVIEW_VIEWPORT,
    zoom: 1,
    panX: 100,
    panY: 50,
  };

  const next = zoomPreviewViewportAtPoint(base, 2, 300, 200);
  const worldXBefore = (300 - base.panX) / base.zoom;
  const worldXAfter = (300 - next.panX) / next.zoom;
  const worldYBefore = (200 - base.panY) / base.zoom;
  const worldYAfter = (200 - next.panY) / next.zoom;

  expect(worldXAfter).toBeCloseTo(worldXBefore, 5);
  expect(worldYAfter).toBeCloseTo(worldYBefore, 5);
});

test('preserves the visible center when content size changes', () => {
  const next = remapPreviewViewportToContent(
    {
      ...DEFAULT_PREVIEW_VIEWPORT,
      zoom: 1.5,
      panX: -50,
      panY: -20,
      hasInteracted: true,
      contentWidth: 800,
      contentHeight: 400,
      viewportWidth: 600,
      viewportHeight: 400,
    },
    1600,
    800
  );

  expect(next.contentWidth).toBe(1600);
  expect(next.contentHeight).toBe(800);
  expect(next.panX).toBeLessThan(-50);
  expect(next.panY).toBeLessThan(-20);
});

test('reset returns to 100 percent and centers the content', () => {
  const next = resetPreviewViewport({
    ...DEFAULT_PREVIEW_VIEWPORT,
    zoom: 2,
    panX: -300,
    panY: -120,
    hasInteracted: true,
    contentWidth: 300,
    contentHeight: 200,
    viewportWidth: 700,
    viewportHeight: 500,
  });

  expect(next.zoom).toBe(1);
  expect(next.panX).toBe(200);
  expect(next.panY).toBe(150);
  expect(next.hasInteracted).toBe(false);
});
