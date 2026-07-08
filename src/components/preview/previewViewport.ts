export const PREVIEW_MIN_ZOOM = 0.2;
export const PREVIEW_MAX_ZOOM = 4;
export const PREVIEW_ZOOM_STEP = 0.1;
export const PREVIEW_FIT_PADDING = 32;

export interface PreviewViewport {
  zoom: number;
  panX: number;
  panY: number;
  hasInteracted: boolean;
  contentWidth: number;
  contentHeight: number;
  viewportWidth: number;
  viewportHeight: number;
}

export const DEFAULT_PREVIEW_VIEWPORT: PreviewViewport = {
  zoom: 1,
  panX: 0,
  panY: 0,
  hasInteracted: false,
  contentWidth: 0,
  contentHeight: 0,
  viewportWidth: 0,
  viewportHeight: 0,
};

export function clampPreviewZoom(zoom: number) {
  return Math.min(PREVIEW_MAX_ZOOM, Math.max(PREVIEW_MIN_ZOOM, zoom));
}

export function setPreviewViewportSize(
  viewport: PreviewViewport,
  viewportWidth: number,
  viewportHeight: number
): PreviewViewport {
  return {
    ...viewport,
    viewportWidth,
    viewportHeight,
  };
}

export function setPreviewContentSize(
  viewport: PreviewViewport,
  contentWidth: number,
  contentHeight: number
): PreviewViewport {
  return {
    ...viewport,
    contentWidth,
    contentHeight,
  };
}

export function panPreviewViewportBy(viewport: PreviewViewport, deltaX: number, deltaY: number): PreviewViewport {
  return {
    ...viewport,
    panX: viewport.panX + deltaX,
    panY: viewport.panY + deltaY,
    hasInteracted: true,
  };
}

export function zoomPreviewViewportAtPoint(
  viewport: PreviewViewport,
  nextZoom: number,
  anchorX: number,
  anchorY: number
): PreviewViewport {
  const zoom = clampPreviewZoom(nextZoom);
  if (Math.abs(zoom - viewport.zoom) < 0.0001) {
    return viewport;
  }

  const worldX = (anchorX - viewport.panX) / viewport.zoom;
  const worldY = (anchorY - viewport.panY) / viewport.zoom;

  return {
    ...viewport,
    zoom,
    panX: anchorX - (worldX * zoom),
    panY: anchorY - (worldY * zoom),
    hasInteracted: true,
  };
}

export function fitPreviewViewport(viewport: PreviewViewport, padding = PREVIEW_FIT_PADDING): PreviewViewport {
  const { contentWidth, contentHeight, viewportWidth, viewportHeight } = viewport;
  if (contentWidth <= 0 || contentHeight <= 0 || viewportWidth <= 0 || viewportHeight <= 0) {
    return viewport;
  }

  const availableWidth = Math.max(1, viewportWidth - (padding * 2));
  const availableHeight = Math.max(1, viewportHeight - (padding * 2));
  const zoom = clampPreviewZoom(Math.min(availableWidth / contentWidth, availableHeight / contentHeight));
  const scaledWidth = contentWidth * zoom;
  const scaledHeight = contentHeight * zoom;

  return {
    ...viewport,
    zoom,
    panX: (viewportWidth - scaledWidth) / 2,
    panY: (viewportHeight - scaledHeight) / 2,
    hasInteracted: false,
  };
}

export function resetPreviewViewport(viewport: PreviewViewport): PreviewViewport {
  const { contentWidth, contentHeight, viewportWidth, viewportHeight } = viewport;
  if (contentWidth <= 0 || contentHeight <= 0 || viewportWidth <= 0 || viewportHeight <= 0) {
    return {
      ...viewport,
      zoom: 1,
      panX: 0,
      panY: 0,
      hasInteracted: false,
    };
  }

  return {
    ...viewport,
    zoom: 1,
    panX: (viewportWidth - contentWidth) / 2,
    panY: (viewportHeight - contentHeight) / 2,
    hasInteracted: false,
  };
}

export function remapPreviewViewportToContent(
  viewport: PreviewViewport,
  nextContentWidth: number,
  nextContentHeight: number
): PreviewViewport {
  if (viewport.contentWidth <= 0 || viewport.contentHeight <= 0 || nextContentWidth <= 0 || nextContentHeight <= 0) {
    return setPreviewContentSize(viewport, nextContentWidth, nextContentHeight);
  }

  const worldCenterX = ((viewport.viewportWidth / 2) - viewport.panX) / viewport.zoom;
  const worldCenterY = ((viewport.viewportHeight / 2) - viewport.panY) / viewport.zoom;
  const normalizedCenterX = worldCenterX / viewport.contentWidth;
  const normalizedCenterY = worldCenterY / viewport.contentHeight;
  const nextWorldCenterX = normalizedCenterX * nextContentWidth;
  const nextWorldCenterY = normalizedCenterY * nextContentHeight;

  return {
    ...viewport,
    contentWidth: nextContentWidth,
    contentHeight: nextContentHeight,
    panX: (viewport.viewportWidth / 2) - (nextWorldCenterX * viewport.zoom),
    panY: (viewport.viewportHeight / 2) - (nextWorldCenterY * viewport.zoom),
  };
}
