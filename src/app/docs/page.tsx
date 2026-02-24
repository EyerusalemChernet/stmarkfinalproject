export default function DocsPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-6">
            API Documentation
          </h1>
          
          <div className="prose max-w-none">
            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-800 mb-4">
                Getting Started
              </h2>
              <p className="text-gray-600 mb-4">
                This is a backend API system built with Next.js, Prisma, and PostgreSQL.
                All endpoints require authentication unless specified otherwise.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-800 mb-4">
                Authentication
              </h2>
              <div className="bg-gray-50 rounded-lg p-4 mb-4">
                <h3 className="font-semibold text-lg mb-2">POST /api/auth/login</h3>
                <p className="text-gray-600 mb-2">Authenticate user and receive tokens</p>
                <pre className="bg-gray-800 text-gray-100 p-4 rounded overflow-x-auto">
{`{
  "email": "user@example.com",
  "password": "password123"
}`}
                </pre>
              </div>

              <div className="bg-gray-50 rounded-lg p-4 mb-4">
                <h3 className="font-semibold text-lg mb-2">POST /api/auth/refresh</h3>
                <p className="text-gray-600 mb-2">Refresh access token using refresh token</p>
                <pre className="bg-gray-800 text-gray-100 p-4 rounded overflow-x-auto">
{`{
  "refreshToken": "your-refresh-token"
}`}
                </pre>
              </div>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-800 mb-4">
                User Management
              </h2>
              <div className="space-y-4">
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="font-semibold text-lg mb-2">GET /api/users</h3>
                  <p className="text-gray-600">List all users (requires permission)</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="font-semibold text-lg mb-2">POST /api/users</h3>
                  <p className="text-gray-600">Create new user (requires permission)</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="font-semibold text-lg mb-2">GET /api/users/[id]</h3>
                  <p className="text-gray-600">Get user details</p>
                </div>
              </div>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-800 mb-4">
                Rules Engine
              </h2>
              <div className="space-y-4">
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="font-semibold text-lg mb-2">POST /api/rules/evaluate</h3>
                  <p className="text-gray-600 mb-2">Evaluate rules for a given context</p>
                  <pre className="bg-gray-800 text-gray-100 p-4 rounded overflow-x-auto text-sm">
{`{
  "moduleName": "attendance",
  "action": "SUBMIT_ATTENDANCE",
  "resourceData": {
    "studentId": "student_id",
    "date": "2024-01-01",
    "status": "PRESENT"
  }
}`}
                  </pre>
                </div>
              </div>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-800 mb-4">
                Headers
              </h2>
              <p className="text-gray-600 mb-4">
                All authenticated requests must include:
              </p>
              <pre className="bg-gray-800 text-gray-100 p-4 rounded overflow-x-auto">
{`Authorization: Bearer <your-access-token>
Content-Type: application/json`}
              </pre>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-800 mb-4">
                Response Format
              </h2>
              <p className="text-gray-600 mb-4">
                All API responses follow this structure:
              </p>
              <pre className="bg-gray-800 text-gray-100 p-4 rounded overflow-x-auto">
{`{
  "success": true,
  "data": { ... },
  "message": "Operation successful"
}`}
              </pre>
            </section>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mt-8">
              <h3 className="text-lg font-semibold text-blue-900 mb-2">
                📚 More Documentation
              </h3>
              <p className="text-blue-700">
                For detailed examples and complete API reference, check the following files in the project root:
              </p>
              <ul className="list-disc list-inside text-blue-700 mt-2 space-y-1">
                <li>API_EXAMPLES.md - Complete API usage examples</li>
                <li>SETUP_GUIDE.md - Setup and configuration guide</li>
                <li>RULES_ENGINE_DOCUMENTATION.md - Rules engine details</li>
                <li>ENTERPRISE_HARDENING_SUMMARY.md - Security features</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
