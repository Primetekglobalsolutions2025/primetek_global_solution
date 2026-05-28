import { useEffect, type RefObject } from 'react';

/**
 * Hook to trap keyboard tab focus within a modal or drawer container,
 * and handle the Escape key to close the overlay.
 */
export function useModalFocusTrap(
  containerRef: RefObject<HTMLElement | null>,
  isOpen: boolean,
  onClose: () => void
) {
  useEffect(() => {
    if (!isOpen || !containerRef.current) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    const handleTabKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab' || !containerRef.current) return;

      // Selectable focusable elements inside the modal
      const focusableSelector =
        'a[href], area[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), iframe, object, embed, [tabindex]:not([tabindex="-1"]), [contenteditable]';

      const focusableElements = containerRef.current.querySelectorAll(focusableSelector);
      if (focusableElements.length === 0) return;

      const firstElement = focusableElements[0] as HTMLElement;
      const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

      if (e.shiftKey) {
        // Shift + Tab (go backwards)
        if (document.activeElement === firstElement) {
          lastElement.focus();
          e.preventDefault();
        }
      } else {
        // Tab (go forwards)
        if (document.activeElement === lastElement) {
          firstElement.focus();
          e.preventDefault();
        }
      }
    };

    // Store previous focused element to return focus on close
    const previousFocusedElement = document.activeElement as HTMLElement | null;

    // Focus the first interactive element or the container
    const focusableSelector =
      'a[href], area[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), iframe, object, embed, [tabindex]:not([tabindex="-1"]), [contenteditable]';
    const focusableElements = containerRef.current.querySelectorAll(focusableSelector);
    if (focusableElements.length > 0) {
      (focusableElements[0] as HTMLElement).focus();
    } else {
      containerRef.current.focus();
    }

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keydown', handleTabKey);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keydown', handleTabKey);
      if (previousFocusedElement) {
        previousFocusedElement.focus();
      }
    };
  }, [isOpen, onClose, containerRef]);
}
