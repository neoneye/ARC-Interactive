import { useState, useEffect, RefObject } from 'react';

export function useContainerWidth(ref: RefObject<HTMLElement>): number {
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const getWidth = () => ref.current ? ref.current.offsetWidth : 0;

    const handleResize = () => {
      setWidth(getWidth());
    };

    if (ref.current) {
      setWidth(getWidth());
    }

    window.addEventListener('resize', handleResize);

    // Optional: If you have dynamic layouts that change without window resize
    const observer = new MutationObserver(handleResize);
    if (ref.current) {
      observer.observe(ref.current, { attributes: true, childList: true, subtree: true });
    }

    return () => {
      window.removeEventListener('resize', handleResize);
      observer.disconnect();
    };
  }, [ref]);

  return width;
}