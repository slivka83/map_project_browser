import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  // Rendered instead of `children` once a descendant throws during render /
  // lifecycle. Re-mounting the boundary (e.g. via a `key` change higher up)
  // resets the error state.
  fallback: ReactNode;
}

interface State {
  hasError: boolean;
}

// React error boundary — the only way to catch errors thrown during a child's
// render / lifecycle (function components can't use error boundaries yet).
// Used to wrap the WebGL `<Canvas>` (`GlobeScene`) so a missing / crashed WebGL
// context degrades gracefully: the 2D SVG `Map2D` (no WebGL) keeps working and
// the user sees a friendly fallback panel instead of a blank white screen.
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Surface the failure in the dev console so it is not silently swallowed;
    // no external logging dependency is wired up (client-side SPA, no backend).
    console.error('[ErrorBoundary] a child threw during render:', error, info.componentStack);
  }

  render(): ReactNode {
    if (this.state.hasError) return this.props.fallback;
    return this.props.children;
  }
}
