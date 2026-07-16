import {useEffect, useRef} from 'react';
import kap from '../../utils/kap';

const DEFAULT_EDITOR_WIDTH = 768;
const DEFAULT_EDITOR_HEIGHT = 480;

export const useEditorWindowSizeEffect = (isConversionWindowState: boolean) => {
  const previousWindowSizeRef = useRef<{width: number; height: number}>();

  useEffect(() => {
    const updateWindowSize = async () => {
      if (isConversionWindowState) {
        const bounds = await kap.window.getEditorBounds();
        previousWindowSizeRef.current = {
          width: bounds.width,
          height: bounds.height
        };
        await kap.window.setEditorConversionMode(true);
      } else {
        await kap.window.setEditorConversionMode(false);
      }
    };

    if (!previousWindowSizeRef.current) {
      previousWindowSizeRef.current = {
        width: DEFAULT_EDITOR_WIDTH,
        height: DEFAULT_EDITOR_HEIGHT
      };
      return;
    }

    updateWindowSize();
  }, [isConversionWindowState]);
};
