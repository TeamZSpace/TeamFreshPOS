import * as React from 'react';

interface Props {
  children: React.ReactNode;
}

export function ErrorBoundary({ children }: Props) {
  return <>{children}</>;
}
