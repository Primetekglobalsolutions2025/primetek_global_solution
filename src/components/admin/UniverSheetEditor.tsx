'use client';

import { useEffect, useRef } from 'react';
import { Univer, UniverInstanceType, LocaleType, mergeLocales } from '@univerjs/core';
import { UniverRenderEnginePlugin } from '@univerjs/engine-render';
import { UniverFormulaEnginePlugin } from '@univerjs/engine-formula';
import { UniverDocsPlugin } from '@univerjs/docs';
import { UniverDocsUIPlugin } from '@univerjs/docs-ui';
import { UniverSheetsPlugin } from '@univerjs/sheets';
import { UniverSheetsUIPlugin } from '@univerjs/sheets-ui';
import { UniverUIPlugin } from '@univerjs/ui';

// Import locales
import DesignEnUS from '@univerjs/design/locale/en-US';
import UIEnUS from '@univerjs/ui/locale/en-US';
import SheetsEnUS from '@univerjs/sheets/locale/en-US';
import SheetsUIEnUS from '@univerjs/sheets-ui/locale/en-US';
import DocsUIEnUS from '@univerjs/docs-ui/locale/en-US';

// Import UniverJS required CSS files
import '@univerjs/design/lib/index.css';
import '@univerjs/ui/lib/index.css';
import '@univerjs/docs-ui/lib/index.css';
import '@univerjs/sheets-ui/lib/index.css';

interface UniverSheetEditorProps {
  initialData: Record<string, unknown>;
  onSave: (data: Record<string, unknown>) => void;
}

export default function UniverSheetEditor({ initialData, onSave }: UniverSheetEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    let univer: Univer | null = null;
    try {
      // 1. Initialize Univer with locale configuration
      univer = new Univer({
        locale: LocaleType.EN_US,
        locales: {
          [LocaleType.EN_US]: mergeLocales(
            DesignEnUS,
            UIEnUS,
            SheetsEnUS,
            SheetsUIEnUS,
            DocsUIEnUS
          ),
        },
      });

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

      // Register Docs plugins (MUST be registered to resolve editor dependency injection)
      univer.registerPlugin(UniverDocsPlugin);
      univer.registerPlugin(UniverDocsUIPlugin);

      // 3. Register Sheets plugins
      univer.registerPlugin(UniverSheetsPlugin);
      univer.registerPlugin(UniverSheetsUIPlugin);

      // 4. Create the workbook unit
      const workbook = univer.createUnit(UniverInstanceType.UNIVER_SHEET, initialData);

      // Expose save function to window for the dashboard toolbar buttons
      (window as unknown as { __univerSaveHandler?: () => void }).__univerSaveHandler = () => {
        try {
          const snapshot = (workbook as unknown as { save: () => Record<string, unknown> }).save();
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
      delete (window as unknown as { __univerSaveHandler?: () => void }).__univerSaveHandler;
    };
  }, [initialData, onSave]);

  return (
    <div className="w-full border border-zinc-200 rounded-xl overflow-hidden shadow-sm bg-white" style={{ height: '70vh' }}>
      <div ref={containerRef} className="w-full h-full univer-container" />
    </div>
  );
}
