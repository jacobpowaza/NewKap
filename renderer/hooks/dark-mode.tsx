import {useState, useEffect} from 'react';
import kap from '../utils/kap';

const useDarkMode = () => {
  const [isDarkMode, setIsDarkMode] = useState(kap.system.shouldUseDarkColors());

  useEffect(() => {
    const updateDarkMode = () => {
      setIsDarkMode(kap.system.shouldUseDarkColors());
    };

    return kap.system.onNativeThemeUpdated(updateDarkMode);
  }, []);

  return isDarkMode;
};

export default useDarkMode;
