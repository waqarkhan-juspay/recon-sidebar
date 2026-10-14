import { Navigate, createBrowserRouter } from 'react-router'
import App from './App.tsx'
import About from './pages/About.tsx'
import Alerts from './pages/alerts'
import Blend from './pages/Blend.tsx'
import Configurator from './pages/Configurator.tsx'
import CreateReportConfig from './pages/create-report-config'
import Home from './pages/Home.tsx'
import NotFound from './pages/NotFound.tsx'
import { ALERTS_PATH, CONFIGURATOR_PATH, HOME_PATH } from './layout/navigation.tsx'

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
      { path: HOME_PATH.slice(1), element: <Home /> },
      { path: 'about', element: <About /> },
      { path: 'blend', element: <Blend /> },
      { path: CONFIGURATOR_PATH.slice(1), element: <Configurator /> },
      { path: ALERTS_PATH.slice(1), element: <Alerts /> },
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
