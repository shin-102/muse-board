import React, { useEffect, useState } from 'react';

interface MuseLogoProps {
  /**
   * Tailwind classes (or any className) applied to the wrapper element.
   * Use Tailwind `text-*` classes to control SVG color (SVG must use fill="currentColor").
   * You can also pass sizing classes like `w-48` to scale the SVG via CSS.
   */
  className?: string;
  /**
   * Optional accessible title. If provided, it will be injected into the SVG as a <title>.
   * If not provided, the SVG will be rendered aria-hidden (default).
   */
  title?: string;
  /**
   * Path to the SVG file in the public folder (defaults to '/MuseCanva_inline.svg').
   * Keep this if you later want to reuse the component for other logos.
   */
  src?: string;
  /**
   * When true, the logo will be visible to assistive tech (role="img").
   * If true and `title` is missing, the `title` attribute will fallback to an empty string.
   */
  accessible?: boolean;
}

/**
 * MuseLogo
 *
 * Fetches an SVG from the public folder and inlines it (dangerouslySetInnerHTML) so that
 * the SVG inherits CSS `color` from the parent. This lets you control its color with
 * Tailwind's `text-*` classes (provided the SVG shapes use `fill="currentColor"` / `stroke="currentColor"`).
 *
 * Usage:
 *  <MuseLogo className="mx-auto mb-4 w-48 text-sky-500" />
 */
const MuseLogo: React.FC<MuseLogoProps> = ({
  className = '',
  title,
  src = '/MuseCanva_inline.svg',
  accessible = false,
}) => {
  const [svg, setSvg] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        const res = await fetch(src);
        if (!res.ok) {
          if (mounted) setSvg(null);
          return;
        }
        let text = await res.text();

        // Remove XML prolog and DOCTYPE if present (keeps markup clean for injection).
        text = text.replace(/<\\?xml[^>]*>\\s*/i, '');
        text = text.replace(/<!DOCTYPE[^>]*>\\s*/i, '');

        // Inject <title> inside the SVG if an accessible title was provided and
        // the SVG doesn't already contain a <title>.
        if (title) {
          const hasTitle = /<title[\\s>]/i.test(text);
          if (!hasTitle) {
            // Insert title immediately after the opening <svg ...> tag.
            text = text.replace(/<svg([^>]*)>/i, (_match, attrs) => {
              // Keep the original attributes intact and add the title node.
              const escaped = title.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
              return `<svg${attrs}><title>${escaped}</title>`;
            });
          }
        }

        if (mounted) setSvg(text);
      } catch (err) {
        if (mounted) setSvg(null);
      }
    }

    load();

    return () => { mounted = false; };
  }, [src, title]);

  // If not loaded yet, render nothing to keep layout stable — the caller can add wrapper sizing.
  // The wrapper element receives `className`, so use Tailwind text color classes there.
  if (!svg) return null;

  // If accessible, render role and aria attributes; otherwise mark as hidden from AT.
  const wrapperProps: Record<string, any> = {
    className,
    // We want the inline SVG to inherit the wrapper's computed `color`.
    // Keep the element content-only (no extra text), so aria-hidden true by default.
  };
  if (!accessible) {
    wrapperProps['aria-hidden'] = 'true';
  } else {
    wrapperProps['role'] = 'img';
    // If title was provided, the injected <title> will make it discoverable; otherwise use empty string.
    wrapperProps['aria-label'] = title ?? '';
  }

  return (
    // eslint-disable-next-line react/no-danger
    <span {...wrapperProps} dangerouslySetInnerHTML={{ __html: svg }} />
  );
};

export default MuseLogo;