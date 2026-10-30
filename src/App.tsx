import React, { useEffect, useState } from 'react';
import { shouldRenderWorkspace } from './config/appConfig';
import { WorkspaceApp } from './components/WorkspaceApp';
import { OfficialWebsite } from './website/OfficialWebsite';

export default function App() {
  const [isWorkspaceView, setIsWorkspaceView] = useState<boolean>(() =>
    typeof window !== 'undefined' ? shouldRenderWorkspace(window.location) : false
  );

  useEffect(() => {
    const syncRoute = () => {
      setIsWorkspaceView(shouldRenderWorkspace(window.location));
    };

    window.addEventListener('popstate', syncRoute);
    return () => window.removeEventListener('popstate', syncRoute);
  }, []);

  if (isWorkspaceView) {
    return <WorkspaceApp />;
  }

  return <OfficialWebsite />;
}
