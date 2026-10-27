import { useState } from 'react';
import { useIsClamped } from '../hooks';

/**
 * Text cut to a few lines by `className`'s line clamp, with a "See more" link that only appears
 * when the text is actually cut off (or `forceMore` is set). Without `onMore` the link expands the
 * text in place; with it, the caller shows the full text elsewhere (e.g. a details modal).
 * `reserve` keeps the link's line even when hidden, so cards in a grid stay the same height.
 */
export default function ExpandableText({ text, className, onMore, forceMore = false, reserve = false }: {
  text: string;
  className: string;
  onMore?: () => void;
  forceMore?: boolean;
  reserve?: boolean;
}) {
  const [ref, clamped] = useIsClamped<HTMLParagraphElement>(text);
  const [open, setOpen] = useState(false);
  const visible = clamped || open || forceMore;

  return (
    <>
      <p ref={ref} className={`${className}${open ? ' is-expanded' : ''}`} title={visible || !text ? undefined : text} aria-hidden={!text}>{text}</p>
      {(visible || reserve) && (
        <button
          type="button"
          className="link-button see-more"
          style={visible ? undefined : { visibility: 'hidden' }}
          tabIndex={visible ? undefined : -1}
          aria-hidden={!visible}
          aria-expanded={onMore ? undefined : open}
          onClick={() => (onMore ? onMore() : setOpen(!open))}
        >
          {open ? 'See less' : 'See more'}
        </button>
      )}
    </>
  );
}
