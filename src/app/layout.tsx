import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'School Management System - RBAC & Rules Engine',
  description: 'Enterprise-grade Role-Based Access Control and Rules Engine for School Management',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased bg-gray-50">
        {children}
      </body>
    </html>
  );
}
