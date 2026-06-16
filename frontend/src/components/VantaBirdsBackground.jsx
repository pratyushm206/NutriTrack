import { useEffect, useRef } from 'react';
import { useTheme } from '../contexts/useTheme';

export default function VantaBirdsBackground() {
  const vantaRef = useRef(null);
  const vantaEffectRef = useRef(null);
  const { theme } = useTheme();

  useEffect(() => {
    let cancelled = false;

    const loadScript = (src) => new Promise((resolve, reject) => {
      const existing = document.querySelector(`script[src="${src}"]`);
      if (existing) {
        existing.addEventListener('load', resolve, { once: true });
        if (existing.dataset.loaded === 'true') resolve();
        return;
      }

      const script = document.createElement('script');
      script.src = src;
      script.async = true;
      script.onload = () => {
        script.dataset.loaded = 'true';
        resolve();
      };
      script.onerror = reject;
      document.body.appendChild(script);
    });

    const initVanta = async () => {
      try {
        await loadScript('https://cdnjs.cloudflare.com/ajax/libs/three.js/r134/three.min.js');
        await loadScript('https://cdn.jsdelivr.net/npm/vanta@0.5.24/dist/vanta.birds.min.js');

        if (cancelled || !vantaRef.current || !window.VANTA?.BIRDS) return;

        const isMobile = window.innerWidth < 640;

        vantaEffectRef.current = window.VANTA.BIRDS({
          el: vantaRef.current,
          mouseControls: true,
          touchControls: true,
          gyroControls: false,
          minHeight: 200.00,
          minWidth: 200.00,
          scale: isMobile ? 0.86 : 0.92,
          scaleMobile: 0.82,
          backgroundColor: theme === 'dark' ? 0x080a0d : 0xd6dbd4,
          backgroundAlpha: 0,
          color1: theme === 'dark' ? 0xff6b7a : 0x16a34a,
          color2: theme === 'dark' ? 0x00d1ff : 0xd97706,
          colorMode: 'varianceGradient',
          quantity: isMobile ? 3 : 4,
          birdSize: isMobile ? 0.9 : 0.82,
          wingSpan: isMobile ? 20 : 24,
          speedLimit: isMobile ? 3.6 : 3.8,
          separation: 28,
          alignment: 16,
          cohesion: 14
        });
      } catch {
        // CSS fallback keeps pages polished if CDN scripts are blocked.
      }
    };

    initVanta();

    return () => {
      cancelled = true;
      if (vantaEffectRef.current) {
        vantaEffectRef.current.destroy();
        vantaEffectRef.current = null;
      }
    };
  }, [theme]);

  return <div ref={vantaRef} className="vanta-birds-bg" aria-hidden="true" />;
}
