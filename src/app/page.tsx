'use client';

import { useEffect, useState } from 'react';

export default function HomePage() {
  const [healthStatus, setHealthStatus] = useState<{
    status: string;
    database: string;
    loading: boolean;
  }>({
    status: 'checking',
    database: 'checking',
    loading: true,
  });

  useEffect(() => {
    // Check health status on mount
    fetch('/api/health')
      .then(res => res.json())
      .then(data => {
        setHealthStatus({
          status: data.status || 'unknown',
          database: data.services?.database || 'unknown',
          loading: false,
        });
      })
      .catch(() => {
        setHealthStatus({
          status: 'error',
          database: 'disconnected',
          loading: false,
        });
      });
  }, []);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8">
      <div className="max-w-4xl w-full bg-white rounded-lg shadow-lg p-8">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            School Management System
          </h1>
          <p className="text-xl text-gray-600">
            Enterprise-Grade RBAC & Rules Engine API
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <div className="border border-gray-200 rounded-lg p-6">
            <h2 className="text-2xl font-semibold text-gray-800 mb-3">
              🔐 Authentication
            </h2>
            <ul className="space-y-2 text-gray-600">
              <li>• JWT-based authentication</li>
              <li>• Refresh token rotation</li>
              <li>• Session management</li>
              <li>• Secure password hashing</li>
            </ul>
          </div>

          <div className="border border-gray-200 rounded-lg p-6">
            <h2 className="text-2xl font-semibold text-gray-800 mb-3">
              👥 RBAC System
            </h2>
            <ul className="space-y-2 text-gray-600">
              <li>• Role-based permissions</li>
              <li>• Dynamic permission guards</li>
              <li>• Audit logging</li>
              <li>• Soft delete support</li>
            </ul>
          </div>

          <div className="border border-gray-200 rounded-lg p-6">
            <h2 className="text-2xl font-semibold text-gray-800 mb-3">
              ⚙️ Rules Engine
            </h2>
            <ul className="space-y-2 text-gray-600">
              <li>• Dynamic rule evaluation</li>
              <li>• Priority-based execution</li>
              <li>• Caching & performance</li>
              <li>• Versioning support</li>
            </ul>
          </div>

          <div className="border border-gray-200 rounded-lg p-6">
            <h2 className="text-2xl font-semibold text-gray-800 mb-3">
              🚀 Enterprise Features
            </h2>
            <ul className="space-y-2 text-gray-600">
              <li>• Transaction safety</li>
              <li>• Non-blocking audit logs</li>
              <li>• Comprehensive metrics</li>
              <li>• Production-ready</li>
            </ul>
          </div>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
          <h3 className="text-lg font-semibold text-blue-900 mb-3">
            📚 API Endpoints
          </h3>
          <div className="grid md:grid-cols-2 gap-4 text-sm">
            <div>
              <p className="font-semibold text-blue-800 mb-2">Authentication:</p>
              <ul className="space-y-1 text-blue-700">
                <li>POST /api/auth/login</li>
                <li>POST /api/auth/refresh</li>
                <li>POST /api/auth/logout</li>
              </ul>
            </div>
            <div>
              <p className="font-semibold text-blue-800 mb-2">Users & Roles:</p>
              <ul className="space-y-1 text-blue-700">
                <li>GET/POST /api/users</li>
                <li>GET/PUT/DELETE /api/users/[id]</li>
                <li>GET/POST /api/roles</li>
              </ul>
            </div>
            <div>
              <p className="font-semibold text-blue-800 mb-2">Rules Engine:</p>
              <ul className="space-y-1 text-blue-700">
                <li>GET/POST /api/rules</li>
                <li>POST /api/rules/evaluate</li>
                <li>GET/PUT/DELETE /api/rules/[id]</li>
              </ul>
            </div>
            <div>
              <p className="font-semibold text-blue-800 mb-2">Business Logic:</p>
              <ul className="space-y-1 text-blue-700">
                <li>POST /api/attendance/submit</li>
                <li>POST /api/grades/submit</li>
                <li>GET /api/health</li>
              </ul>
            </div>
          </div>
        </div>

        <div className={`border rounded-lg p-6 mb-6 ${
          healthStatus.loading 
            ? 'bg-gray-50 border-gray-200' 
            : healthStatus.status === 'healthy' 
            ? 'bg-green-50 border-green-200' 
            : 'bg-red-50 border-red-200'
        }`}>
          <h3 className={`text-lg font-semibold mb-2 ${
            healthStatus.loading 
              ? 'text-gray-900' 
              : healthStatus.status === 'healthy' 
              ? 'text-green-900' 
              : 'text-red-900'
          }`}>
            {healthStatus.loading ? '⏳ Checking System Status...' : 
             healthStatus.status === 'healthy' ? '✅ System Status: Healthy' : 
             '❌ System Status: Error'}
          </h3>
          <div className="flex items-center gap-4 text-sm">
            <div className={healthStatus.loading ? 'text-gray-700' : 
                           healthStatus.status === 'healthy' ? 'text-green-700' : 'text-red-700'}>
              <span className="font-semibold">API:</span>{' '}
              {healthStatus.loading ? 'Checking...' : 
               healthStatus.status === 'healthy' ? 'Running' : 'Error'}
            </div>
            <div className={healthStatus.loading ? 'text-gray-700' : 
                           healthStatus.database === 'connected' ? 'text-green-700' : 'text-red-700'}>
              <span className="font-semibold">Database:</span>{' '}
              {healthStatus.loading ? 'Checking...' : 
               healthStatus.database === 'connected' ? 'Connected' : 'Disconnected'}
            </div>
          </div>
          {!healthStatus.loading && (
            <p className={`text-sm mt-2 ${
              healthStatus.status === 'healthy' ? 'text-green-600' : 'text-red-600'
            }`}>
              {healthStatus.status === 'healthy' 
                ? 'Backend API is running. Use the endpoints above to interact with the system.' 
                : 'System is experiencing issues. Check your database connection and server logs.'}
            </p>
          )}
        </div>

        <div className="mt-8 text-center">
          <a
            href="/docs"
            className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
          >
            📖 View API Documentation
          </a>
        </div>

        <div className="mt-6 text-center text-gray-500 text-sm">
          <p>
            For detailed documentation, see{' '}
            <code className="bg-gray-100 px-2 py-1 rounded">README.md</code>,{' '}
            <code className="bg-gray-100 px-2 py-1 rounded">API_EXAMPLES.md</code>, and{' '}
            <code className="bg-gray-100 px-2 py-1 rounded">STARTUP_GUIDE.md</code>
          </p>
        </div>
      </div>
    </div>
  );
}
