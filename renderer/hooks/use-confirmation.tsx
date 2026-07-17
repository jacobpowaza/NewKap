import {useCallback} from 'react';
import kap from '../utils/kap';

interface UseConfirmationOptions {
  message: string;
  detail?: string;
  confirmButtonText: string;
  cancelButtonText?: string;
}

export const useConfirmation = (
  callback: () => void,
  options: UseConfirmationOptions
) => {
  return useCallback(() => {
    const buttonIndex = kap.dialog.showMessageBoxSync({
      type: 'question',
      buttons: [
        options.confirmButtonText,
        options.cancelButtonText ?? 'Cancel'
      ],
      defaultId: 0,
      cancelId: 1,
      message: options.message,
      detail: options.detail
    });

    if (buttonIndex === 0) {
      callback();
    }
  }, [callback, options]);
};
