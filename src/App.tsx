import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { NotificationProvider } from './contexts/NotificationContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AppLayout } from './components/layout/AppLayout';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Tournaments } from './pages/Tournaments';
import { Matches } from './pages/Matches';
import { Schools } from './pages/Schools';
import { Venues } from './pages/Venues';
import { Teachers } from './pages/Teachers';
import { Referees } from './pages/Referees';
import { SportsConfig } from './pages/SportsConfig';
import { TeacherTeams } from './pages/TeacherTeams';
import { TechCommitteeHeads } from './pages/TechCommitteeHeads';
import { Statistics } from './pages/Statistics';
import { Directorates } from './pages/Directorates';
import { PostersCertificates } from './pages/PostersCertificates';
import { Permissions } from './pages/Permissions';
import { HelperApps } from './pages/HelperApps';

import { Toaster } from 'react-hot-toast';

export default function App() {
  return (
    <AuthProvider>
      <NotificationProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <AppLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<Navigate to="/dashboard" replace />} />
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="tournaments" element={<Tournaments />} />
              <Route path="matches" element={<Matches />} />
              <Route path="helper-apps" element={<HelperApps />} />
              <Route path="schools" element={<Schools />} />
              <Route path="venues" element={<Venues />} />
              <Route path="teachers" element={<Teachers />} />
              <Route path="referees" element={<Referees />} />
              <Route path="sports-config" element={<SportsConfig />} />
              <Route path="permissions" element={<Permissions />} />
              <Route path="directorates" element={<Directorates />} />
              <Route path="teacher-teams" element={<TeacherTeams />} />
              <Route path="tech-committee" element={<TechCommitteeHeads />} />
              <Route path="posters-certificates" element={<PostersCertificates />} />
              <Route path="statistics" element={<Statistics />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
        <Toaster position="top-center" reverseOrder={false} />
      </NotificationProvider>
    </AuthProvider>
  );
}
