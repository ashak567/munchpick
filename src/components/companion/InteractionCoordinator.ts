'use client';

import React, { useEffect } from 'react';

export class InteractionCoordinator {
  /**
   * Manages composer input key binds.
   * - Enter: triggers onSend.
   * - Shift+Enter: normal newline insertion.
   * - Escape: blurs current element.
   */
  public static handleComposerKeyDown(
    e: React.KeyboardEvent<HTMLTextAreaElement>,
    onSend: () => void,
    isDisabled: boolean
  ): void {
    if (e.key === 'Enter') {
      if (!e.shiftKey) {
        e.preventDefault();
        if (!isDisabled) {
          onSend();
        }
      }
    } else if (e.key === 'Escape') {
      e.currentTarget.blur();
    }
  }

}

/**
 * Listens for click/touch outside target container to trigger closures.
 */
export function useClickOutside(
  ref: React.RefObject<HTMLElement | null>,
  onClickOutside: () => void,
  enabled = true
): void {
  useEffect(() => {
    if (!enabled) return;

    const listener = (event: MouseEvent | TouchEvent) => {
      const target = ref.current;
      if (!target || target.contains(event.target as Node)) {
        return;
      }
      onClickOutside();
    };

    document.addEventListener('mousedown', listener);
    document.addEventListener('touchstart', listener);

    return () => {
      document.removeEventListener('mousedown', listener);
      document.removeEventListener('touchstart', listener);
    };
  }, [ref, onClickOutside, enabled]);
}
