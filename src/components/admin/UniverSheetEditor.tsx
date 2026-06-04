'use client';

import { useEffect, useRef } from 'react';
import { Univer, UniverInstanceType } from '@univerjs/core';
import { UniverRenderEnginePlugin } from '@univerjs/engine-render';
import { UniverFormulaEnginePlugin } from '@univerjs/engine-formula';
import { UniverSheetsPlugin } from '@univerjs/sheets';
import { UniverSheetsUIPlugin } from '@univerjs/sheets-ui';
import { UniverUIPlugin } from '@univerjs/ui';

// Import UniverJS required CSS files
import '@univerjs/design/lib/index.css';
import '@univerjs/ui/lib/index.css';
import '@univerjs/sheets-ui/lib/index.css';

interface UniverSheetEditorProps {
  initialData: any;
  onSave: (data: any) => void;
}

export default function UniverSheetEditor({ initialData, onSave }: UniverSheetEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    let univer: Univer | null = null;
    try {
      // 1. Initialize Univer
      univer = new Univer({});

      // Register Core Engines (MUST be registered before UI and feature plugins)
      univer.registerPlugin(UniverRenderEnginePlugin);
      univer.registerPlugin(UniverFormulaEnginePlugin);

      // 2. Register UI plugins
      univer.registerPlugin(UniverUIPlugin, {
        container: containerRef.current,
        header: true,
        toolbar: true,
        footer: true,
      });

      // 3. Register Sheets plugins
      univer.registerPlugin(UniverSheetsPlugin);
      univer.registerPlugin(UniverSheetsUIPlugin);

      // 4. Create the workbook unit
      const workbook = univer.createUnit(UniverInstanceType.UNIVER_SHEET, initialData);

      // Expose save function to window for the dashboard toolbar buttons
      (window as any).__univerSaveHandler = () => {
        try {
          const snapshot = (workbook as any).save();
          onSave(snapshot);
        } catch (err) {
          console.error('Failed to get Univer snapshot:', err);
        }
      };
    } catch (err) {
      console.error('Error initializing UniverJS:', err);
    }

    return () => {
      if (univer) {
        try {
          univer.dispose();
        } catch (err) {
          console.warn('Error disposing UniverJS:', err);
        }
      }
      delete (window as any).__univerSaveHandler;
    };
  }, [initialData, onSave]);

  return (
    <div className="w-full border border-zinc-200 rounded-xl overflow-hidden shadow-sm bg-white" style={{ height: '70vh' }}>
      <div ref={containerRef} className="w-full h-full univer-container" />
    </div>
  );
}
