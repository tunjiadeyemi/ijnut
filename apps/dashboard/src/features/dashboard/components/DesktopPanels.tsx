import { forwardRef, useImperativeHandle, type ReactNode } from 'react';
import { useDefaultGridLayout, useGridRef } from 'react-resizable-panels';

import {
  ResizableCell,
  ResizableGrid,
  ResizableGridline
} from '@/shared/components/ui/resizable';

export const PANEL_LAYOUT_ID = 'ijnut-dashboard-panels';

const DEFAULT_LAYOUT = {
  columns: { 'metrics-col': 60, 'ask-col': 40 },
  rows: { 'top-row': 58, 'bottom-row': 42 }
};

function storageKey(id: string) {
  return `react-resizable-panels:grid:${id}`;
}

export type DesktopPanelsHandle = {
  resetLayout: () => void;
};

type Props = {
  routes: ReactNode;
  ask: ReactNode;
  history: ReactNode;
  load: ReactNode;
};

/**
 * Desktop 2×2 layout: drag the crosshair / dividers to resize.
 * Column and row sizes persist in localStorage.
 */
export const DesktopPanels = forwardRef<DesktopPanelsHandle, Props>(
  function DesktopPanels({ routes, ask, history, load }, ref) {
    const gridRef = useGridRef();
    const { defaultLayout, onLayoutChanged } = useDefaultGridLayout({
      id: PANEL_LAYOUT_ID,
      storage: typeof window !== 'undefined' ? localStorage : undefined
    });

    useImperativeHandle(ref, () => ({
      resetLayout() {
        try {
          localStorage.removeItem(storageKey(PANEL_LAYOUT_ID));
        } catch {
          // ignore quota / private mode
        }
        gridRef.current?.setLayout(DEFAULT_LAYOUT);
      }
    }));

    return (
      <ResizableGrid
        id={PANEL_LAYOUT_ID}
        gridRef={gridRef}
        className="min-h-0 flex-1"
        columns={[
          { id: 'metrics-col', defaultSize: '60%', minSize: '22%' },
          { id: 'ask-col', defaultSize: '40%', minSize: '22%' }
        ]}
        rows={[
          { id: 'top-row', defaultSize: '58%', minSize: '28%' },
          { id: 'bottom-row', defaultSize: '42%', minSize: '22%' }
        ]}
        defaultLayout={defaultLayout}
        onLayoutChanged={onLayoutChanged}
      >
        <ResizableCell id="routes" column={0} row={0} className="pr-4">
          {routes}
        </ResizableCell>
        <ResizableCell id="ask" column={1} row={0} className="pl-4">
          {ask}
        </ResizableCell>
        <ResizableCell id="history" column={0} row={1} className="pr-4">
          {history}
        </ResizableCell>
        <ResizableCell id="load" column={1} row={1} className="pl-4">
          {load}
        </ResizableCell>

        <ResizableGridline type="column" column={1} />
        <ResizableGridline type="row" row={1} />
      </ResizableGrid>
    );
  }
);
