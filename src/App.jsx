import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
} from "react-router-dom";

import { AuthProvider } from "./contexts/AuthContext";
import { LicenseProvider } from "./contexts/LicenseContext";

import ProtectedRoute from "./components/ProtectedRoute";
import LicensedRoute from "./components/LicensedRoute";

import BibliotecaPage from "./pages/BibliotecaPage";
import EbdPage from "./pages/EbdPage";
import LoginPage from "./pages/LoginPage";
import RedefinirSenhaPage from "./pages/RedefinirSenhaPage";
import TrimestrePage from "./pages/TrimestrePage";
import ApresentacaoPage from "./pages/ApresentacaoPage";
import SermoesPage from "./pages/SermoesPage";
import LivrosPage from "./pages/LivrosPage";
import LivroPage from "./pages/LivroPage";
import SermaoPage from "./pages/SermaoPage";
import AcessoPage from "./pages/AcessoPage";
import AssinaturaRetornoPage from "./pages/AssinaturaRetornoPage";
import SplashPage from "./pages/SplashPage";

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <LicenseProvider>
          <Routes>
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <LicensedRoute>
                    <BibliotecaPage />
                  </LicensedRoute>
                </ProtectedRoute>
              }
            />

            <Route
              path="/ebd"
              element={
                <ProtectedRoute>
                  <LicensedRoute>
                    <EbdPage />
                  </LicensedRoute>
                </ProtectedRoute>
              }
            />

            <Route
              path="/sermoes"
              element={
                <ProtectedRoute>
                  <LicensedRoute>
                    <SermoesPage />
                  </LicensedRoute>
                </ProtectedRoute>
              }
            />

            <Route
              path="/sermoes/:id"
              element={
                <ProtectedRoute>
                  <LicensedRoute>
                    <SermaoPage />
                  </LicensedRoute>
                </ProtectedRoute>
              }
            />

            <Route
              path="/livros"
              element={
                <ProtectedRoute>
                  <LicensedRoute>
                    <LivrosPage />
                  </LicensedRoute>
                </ProtectedRoute>
              }
            />

            <Route
              path="/livros/:id"
              element={
                <ProtectedRoute>
                  <LicensedRoute>
                    <LivroPage />
                  </LicensedRoute>
                </ProtectedRoute>
              }
            />

            <Route
              path="/trimestres/:id"
              element={
                <ProtectedRoute>
                  <LicensedRoute>
                    <TrimestrePage />
                  </LicensedRoute>
                </ProtectedRoute>
              }
            />

            <Route
              path="/aulas/:id/apresentar"
              element={
                <ProtectedRoute>
                  <LicensedRoute>
                    <ApresentacaoPage />
                  </LicensedRoute>
                </ProtectedRoute>
              }
            />

            <Route
              path="/boas-vindas"
              element={
                <ProtectedRoute>
                  <SplashPage />
                </ProtectedRoute>
              }
            />

            <Route
              path="/acesso"
              element={
                <ProtectedRoute>
                  <AcessoPage />
                </ProtectedRoute>
              }
            />

            <Route
              path="/assinatura/retorno"
              element={
                <AssinaturaRetornoPage />
              }
            />

            <Route path="/login" element={<LoginPage />} />

            <Route
              path="/redefinir-senha"
              element={<RedefinirSenhaPage />}
            />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </LicenseProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;