import { Navigate, createBrowserRouter } from 'react-router'
import App from './App.tsx'
import About from './pages/About.tsx'
import Blend from './pages/Blend.tsx'
import CreateReportConfig from './pages/create-report-config'
import NotFound from './pages/NotFound.tsx'
import ModulePage from './pages/ModulePage.tsx'
import { CONFIGURATOR_PATH, ROUTED_MODULES } from './layout/navigation.tsx'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
    errorElement: <NotFound />,
    children: [
      // The app lands on the Configurator. `replace` so the root never enters history —
      // otherwise Back from the Configurator returns to `/` and immediately redirects
      // forward again, trapping the user.
      { index: true, element: <Navigate to={CONFIGURATOR_PATH} replace /> },
      { path: 'about', element: <About /> },
      { path: 'blend', element: <Blend /> },
      // Every routed module in the registry. Keyed so moving between two modules starts the
      // page fresh rather than carrying one page's selected tab into the next.
      ...ROUTED_MODULES.map(({ id, href }) => ({
        path: href.slice(1),
        element: <ModulePage key={id} moduleId={id} />,
      })),
    ],
  },
  // Deliberately a sibling of the shell route, not a child: this flow is a full-screen
  // takeover (AGENTS.md rule 8), so it must render without SidebarV2 around it.
  {
    path: '/configurator/create',
    element: <CreateReportConfig />,
    errorElement: <NotFound />,
  },
])
