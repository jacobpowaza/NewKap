import {AppProps} from 'next/app';
import Head from 'next/head';
import {useState, useEffect} from 'react';
import useDarkMode from '../hooks/dark-mode';
import GlobalStyles from '../utils/global-styles';
import SentryErrorBoundary from '../utils/sentry-error-boundary';
import {WindowStateProvider} from '../hooks/window-state';
import classNames from 'classnames';

const Kap = (props: AppProps) => {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);

    const handleError = (event: ErrorEvent) => {
      console.error('[renderer] uncaught error', event.error ?? event.message);
    };

    const handleRejection = (event: PromiseRejectionEvent) => {
      console.error('[renderer] unhandled rejection', event.reason);
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleRejection);

    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleRejection);
    };
  }, []);

  if (!isMounted) {
    return null;
  }

  return <MainApp {...props}/>;
};

const MainApp = ({Component, pageProps}: AppProps) => {
  const isDarkMode = useDarkMode();
  const className = classNames('cover-window', {dark: isDarkMode});
  const cspQuote = String.fromCodePoint(39);

  return (
    <>
      <Head>
        <meta
          httpEquiv="Content-Security-Policy"
          content={[
            'default-src ' + cspQuote + 'self' + cspQuote + ' file: data:',
            'base-uri ' + cspQuote + 'none' + cspQuote,
            'object-src ' + cspQuote + 'none' + cspQuote,
            'script-src ' + cspQuote + 'self' + cspQuote + ' ' + cspQuote + 'unsafe-inline' + cspQuote,
            'style-src ' + cspQuote + 'self' + cspQuote + ' ' + cspQuote + 'unsafe-inline' + cspQuote,
            'img-src ' + cspQuote + 'self' + cspQuote + ' file: data:',
            'media-src file:',
            'connect-src ' + cspQuote + 'self' + cspQuote + ' https: http://localhost:* ws://localhost:*'
          ].join('; ')}
        />
      </Head>
      <div className={className}>
        <SentryErrorBoundary>
          <WindowStateProvider>
            <Component {...pageProps}/>
            <GlobalStyles/>
          </WindowStateProvider>
        </SentryErrorBoundary>
      </div>
    </>
  );
};

export default Kap;
