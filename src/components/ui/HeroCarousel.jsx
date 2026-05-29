import { useEffect, useState } from 'react';
import { IconArrowLeft, IconArrowRight } from '../../icons';

export default function HeroCarousel({ slides, interval = 4500 }) {
  const [index, setIndex] = useState(0);
  const total = slides.length;

  useEffect(() => {
    if (total <= 1) return;
    const id = setInterval(() => setIndex((i) => (i + 1) % total), interval);
    return () => clearInterval(id);
  }, [total, interval]);

  const go = (i) => setIndex(((i % total) + total) % total);

  return (
    <div className="hero-carousel" aria-roledescription="carousel">
      <div className="hero-carousel-track" style={{ transform: `translateX(-${index * 100}%)` }}>
        {slides.map((s, i) => (
          <div className="hero-carousel-slide" key={s.src} aria-hidden={i !== index}>
            <img src={s.src} alt={s.alt} loading={i === 0 ? 'eager' : 'lazy'} />
            {s.caption && <div className="hero-carousel-caption">{s.caption}</div>}
          </div>
        ))}
      </div>

      {total > 1 && (
        <>
          <button
            type="button"
            className="hero-carousel-arrow hero-carousel-arrow-prev"
            onClick={() => go(index - 1)}
            aria-label="Previous slide"
          >
            <IconArrowLeft size="sm" />
          </button>
          <button
            type="button"
            className="hero-carousel-arrow hero-carousel-arrow-next"
            onClick={() => go(index + 1)}
            aria-label="Next slide"
          >
            <IconArrowRight size="sm" />
          </button>

          <div className="hero-carousel-dots" role="tablist">
            {slides.map((_, i) => (
              <button
                key={i}
                type="button"
                role="tab"
                aria-selected={i === index}
                aria-label={`Go to slide ${i + 1}`}
                className={'hero-carousel-dot' + (i === index ? ' is-active' : '')}
                onClick={() => go(i)}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
